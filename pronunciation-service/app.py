"""SIRAJ pronunciation service.

Turns one recorded Ayah into Arabic text WITH harakat (zabar / zer / pesh), using a speech model.
The SIRAJ backend then compares those harakat with the real Ayah.

Two kinds of model work here (detected automatically):
  * Whisper models fine-tuned on the Quran (they WRITE harakat)  <- recommended, default
  * CTC models (wav2vec2 style) that write harakat               <- kept from before

Choose the model with MODEL_ID. Default: tarteel-ai/whisper-base-ar-quran (small, fine on a normal PC's CPU).
Better but heavy (wants a GPU): MaddoggProduction/whisper-l-v3-turbo-quran-lora-dataset-mix

IMPORTANT: the model must output diacritised Arabic. If it writes plain letters, SIRAJ shows
"could not check" instead of guessing. The expected Ayah is NEVER given to the model as a hint
(that would make it "hear" the correct text and hide real mistakes).
"""
import hmac
import logging
import os
import subprocess
import tempfile
import threading

import numpy as np
import torch
from fastapi import FastAPI, Header, HTTPException, Request
from starlette.concurrency import run_in_threadpool
from transformers import AutoConfig, AutoProcessor

log = logging.getLogger("siraj.pronunciation")
logging.basicConfig(level=logging.INFO)

MODEL_ID = os.environ.get("MODEL_ID", "tarteel-ai/whisper-base-ar-quran")  # Hugging Face id or a local folder
ADAPTER_ID = os.environ.get("ADAPTER_ID", "").strip()  # optional LoRA adapter (needs `pip install peft`)
API_KEY = os.environ.get("API_KEY", "")  # same value as PRONUNCIATION_API_KEY in the backend
HF_TOKEN = os.environ.get("HF_TOKEN") or None
MAX_BYTES = 4 * 1024 * 1024
MAX_SECONDS = 240
SAMPLE_RATE = 16000

DEVICE = os.environ.get("DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
DTYPE = torch.float16 if DEVICE.startswith("cuda") else torch.float32

config = AutoConfig.from_pretrained(MODEL_ID, token=HF_TOKEN)
IS_WHISPER = getattr(config, "model_type", "") == "whisper"
processor = AutoProcessor.from_pretrained(MODEL_ID, token=HF_TOKEN)

if IS_WHISPER:
    from transformers import AutoModelForSpeechSeq2Seq, pipeline

    model = AutoModelForSpeechSeq2Seq.from_pretrained(MODEL_ID, torch_dtype=DTYPE, token=HF_TOKEN)
    if ADAPTER_ID:
        from peft import PeftModel  # only needed for LoRA-adapter-only repos

        model = PeftModel.from_pretrained(model, ADAPTER_ID).merge_and_unload()
    model.to(DEVICE).eval()
    asr = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=DTYPE,
        device=DEVICE,
    )
else:
    from transformers import AutoModelForCTC

    model = AutoModelForCTC.from_pretrained(MODEL_ID, token=HF_TOKEN).to(DEVICE).eval()
    asr = None

# One recording at a time: two heavy runs together make both slow (and can run out of memory).
gate = threading.Lock()

app = FastAPI(title="SIRAJ pronunciation service")


def decode_audio(data: bytes) -> np.ndarray:
    """Any browser format (webm/opus, mp4, ogg, wav) -> mono 16 kHz float samples, using ffmpeg.
    A temp file (not a pipe) so every container format can be probed reliably. A recording that is still
    running (cut in the middle, used by the live check) is fine: ffmpeg reads what is there."""
    fd, path = tempfile.mkstemp(prefix="siraj_", suffix=".audio")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        proc = subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SAMPLE_RATE), "pipe:1"],
            capture_output=True, timeout=60,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=415, detail="The recording took too long to process.")
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    if proc.returncode != 0 or not proc.stdout:
        raise HTTPException(status_code=415, detail="Could not read the audio.")
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


NUM_BEAMS = int(os.environ.get("NUM_BEAMS", "1"))  # 1 = fastest (good for the live check); 5 = a little more accurate, slower
WINDOW_SECONDS = 30  # Whisper reads 30 s at a time


def run_model(samples: np.ndarray) -> str:
    with gate, torch.inference_mode():
        if IS_WHISPER:
            gen = {"task": "transcribe", "language": "arabic", "num_beams": NUM_BEAMS}
            if len(samples) <= WINDOW_SECONDS * SAMPLE_RATE:
                # Normal case (one Ayah): one plain pass. No timestamps and no chunking: these Quran models were
                # fine-tuned on plain text, and asking them for timestamp tokens can cut or repeat the text.
                out = asr({"raw": samples, "sampling_rate": SAMPLE_RATE}, generate_kwargs=gen)
            else:
                out = asr(
                    {"raw": samples, "sampling_rate": SAMPLE_RATE},
                    chunk_length_s=WINDOW_SECONDS,  # longer Ayahs are cut into overlapping pieces
                    stride_length_s=3,              # model card: 2-3 s overlap avoids repetition loops
                    generate_kwargs=gen,
                )
            return str(out["text"]).strip()
        inputs = processor(samples, sampling_rate=SAMPLE_RATE, return_tensors="pt")
        logits = model(inputs.input_values.to(DEVICE)).logits
        return processor.batch_decode(torch.argmax(logits, dim=-1))[0].strip()


def warm_up() -> None:
    """The first run is always slow (loading kernels). Do it now, not while a student waits."""
    try:
        run_model(np.zeros(SAMPLE_RATE, dtype=np.float32))
        log.info("Model ready on %s: %s", DEVICE, MODEL_ID)
    except Exception:
        log.exception("Warm-up failed (the service still starts)")


threading.Thread(target=warm_up, daemon=True).start()


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_ID, "type": "whisper" if IS_WHISPER else "ctc", "device": DEVICE}


@app.post("/transcribe")
async def transcribe(request: Request, authorization: str = Header(default="")):
    if API_KEY and not hmac.compare_digest(authorization, f"Bearer {API_KEY}"):
        raise HTTPException(status_code=401, detail="Unauthorised.")
    data = await request.body()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Audio is empty or too large.")

    samples = await run_in_threadpool(decode_audio, data)
    if len(samples) > MAX_SECONDS * SAMPLE_RATE:
        raise HTTPException(status_code=413, detail="Recording is too long.")
    if len(samples) < SAMPLE_RATE // 2 or float(np.sqrt(np.mean(samples ** 2))) < 0.003:
        return {"text": ""}  # silence: the backend answers "nothing heard" instead of letting the model invent words

    text = await run_in_threadpool(run_model, samples)
    return {"text": text}
