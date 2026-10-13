# SIRAJ pronunciation service (for the zabar / zer / pesh check)

A small separate server. The Node backend sends it one recorded Ayah; it answers `{ "text": "..." }` with the
Arabic it heard **including harakat**. The backend compares those harakat with the real Ayah.

## Models (chosen from Hugging Face, Apache-2.0 licence; I could not download or run them where I work, so test them yourself)

| Use | `MODEL_ID` | Size | Needs |
| --- | --- | --- | --- |
| **Start here** (default) | `tarteel-ai/whisper-base-ar-quran` | small (about 74M) | normal PC, CPU is fine (a few seconds per Ayah) |
| Better, heavier | `MaddoggProduction/whisper-l-v3-turbo-quran-lora-dataset-mix` | about 0.8B | a GPU for fast answers (CPU: slow) |
| Adapter-only repo | `MODEL_ID=tarteel-ai/whisper-base-ar-quran` + `ADAPTER_ID=KheemP/whisper-base-quran-lora` | small | also `pip install peft` |

All three are Whisper models trained on Quran recitation. Their model cards show they were measured WITH diacritics
(so they write zabar / zer / pesh). Still, look at the "HEARD" line in `try_model.py` yourself before you trust one.

## Run (Windows PowerShell)
1. Python 3.10+ and `ffmpeg` installed (`ffmpeg -version` must work).
2. `cd pronunciation-service`
3. `python -m venv .venv` then `.\.venv\Scripts\Activate.ps1`
4. `pip install -r requirements.txt` (torch is big: be patient)
5. Try the model first: `python try_model.py my_recitation.m4a` (first run downloads the model).
6. Start it:
   ```powershell
   $env:API_KEY = "put-a-long-random-text-here"
   uvicorn app:app --host 0.0.0.0 --port 8000
   ```
   To use the bigger model: `$env:MODEL_ID = "MaddoggProduction/whisper-l-v3-turbo-quran-lora-dataset-mix"` before uvicorn.
7. Check: open `http://localhost:8000/health` (shows model, type and device).
8. In `backend/.env` set `PRONUNCIATION_API_URL=http://localhost:8000` and `PRONUNCIATION_API_KEY=<the same text>`, restart the backend.

## Good to know
- LIVE checks: while someone recites, the page sends the audio of the Ayah so far about every 1.5 s, so this service hears the same recording many times. The small model is fast enough for one reciter on a CPU; for several users at once use a GPU. The service handles one recording at a time (the others wait).
- The service never receives the real Ayah text, so the model cannot "hear" the right words by accident.
- Silence returns an empty text, so SIRAJ says "nothing heard" instead of a made-up result.
- Ayahs longer than 30 seconds are cut into overlapping pieces automatically.
- The first check after start can be slow (the service warms the model up in the background).
- In production use HTTPS between the backend and this service and keep `API_KEY` secret.
- It is a learning hint, not a ruling. It does not judge Tajweed (madd, ghunna, qalqala ...).
