import { useCallback, useEffect, useRef } from "react";

export const RECORDING_SUPPORTED =
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/**
 * Records the microphone in separate pieces, one per Ayah, so each Ayah can be sent on its own.
 *  open()      asks for the microphone and starts the first piece. Returns true/false.
 *  cut(keep)   ends the current piece and immediately starts the next one.
 *              Returns a Promise of the finished piece (a Blob) - or null when keep is false / nothing was recorded.
 *  snapshot()  the audio of the current piece so far, as a Blob (recording continues). Used by the live zabar/zer check.
 *  close()     stops recording and turns the microphone off.
 * Nothing is stored: the audio only lives in memory until it is sent (or thrown away).
 */
export default function useAyahRecorder() {
  const streamRef = useRef(null);
  const segmentRef = useRef(null);

  const begin = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return null;
    const rec = new MediaRecorder(stream);
    const chunks = [];
    const done = new Promise((resolve) => {
      rec.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || "audio/webm" }) : null);
      rec.onerror = () => resolve(null);
    });
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.start(500); // a piece every 0.5 s, so snapshot() can hand out "the audio so far" while recording goes on
    return { rec, done, chunks };
  }, []);

  const open = useCallback(async () => {
    if (!RECORDING_SUPPORTED) return false;
    if (streamRef.current) return true;
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      segmentRef.current = begin();
      return Boolean(segmentRef.current);
    } catch (e) {
      streamRef.current = null;
      return false;
    }
  }, [begin]);

  const cut = useCallback((keep = true) => {
    const current = segmentRef.current;
    if (!current) return Promise.resolve(null);
    segmentRef.current = begin(); // the next piece starts right away
    try { if (current.rec.state !== "inactive") current.rec.stop(); } catch (e) { /* ignore */ }
    return current.done.then((blob) => (keep ? blob : null));
  }, [begin]);

  // The audio of the CURRENT piece so far (about 0.5 s behind). Recording is not interrupted. null when nothing yet.
  const snapshot = useCallback(() => {
    const current = segmentRef.current;
    if (!current || !current.chunks.length) return null;
    return new Blob(current.chunks.slice(), { type: current.rec.mimeType || "audio/webm" });
  }, []);

  const close = useCallback(() => {
    const current = segmentRef.current;
    segmentRef.current = null;
    try { if (current && current.rec.state !== "inactive") current.rec.stop(); } catch (e) { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => close, [close]); // microphone off when the page is left

  return { open, cut, close, snapshot };
}
