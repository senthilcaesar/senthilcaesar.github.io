"""Render terminal voice-over lines with Kokoro-82M. Run by build.js in the Kokoro env.

Reads JSON on stdin and writes one 24 kHz WAV per item:
    {"voice": "af_heart", "speed": 1.0, "items": [{"text": "...", "out": "/path/a.wav"}, ...]}

"⟨pause 0.7⟩" in a text inserts that many seconds of silence; the pieces either side
are rendered separately (so a list number is said on its own, not run into the item).

"lead_in": "November" renders "November sixteenth," and keeps only the words after the
lead-in, cut at Kokoro's word timings. A word said alone can start with a stray "uh";
said after a lead-in, it starts cleanly.
"""
import json
import re
import sys
import warnings

warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
from kokoro import KPipeline  # noqa: E402

RATE = 24000


def trim(audio, threshold=0.01, lead=0.05, tail=0.12):
    """Cut Kokoro's own silence off both ends, so the pauses we insert are exact."""
    loud = np.flatnonzero(np.abs(audio) > threshold)
    if not loud.size:
        return audio
    start = max(0, loud[0] - int(RATE * lead))
    end = min(len(audio), loud[-1] + int(RATE * tail))
    return audio[start:end]


def after_lead_in(pipe, voice, speed, lead_in, text):
    skip = len(lead_in.split())
    pieces = []
    for res in pipe(f"{lead_in} {text}", voice=voice, speed=speed):
        audio = res.audio.numpy() if hasattr(res.audio, "numpy") else np.asarray(res.audio)
        words = [t for t in (res.tokens or []) if any(c.isalnum() for c in t.text)]
        if len(words) > skip and words[skip].start_ts is not None:
            start = max(0, int(RATE * words[skip].start_ts) - int(RATE * 0.01))
            audio = audio[start:]
        pieces.append(audio)
        skip = 0  # the lead-in only sits in the first result
    return np.concatenate(pieces)


def main():
    job = json.load(sys.stdin)
    voice = job["voice"]
    pipe = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")
    total = len(job["items"])
    for i, item in enumerate(job["items"], 1):
        if item.get("lead_in"):
            audio = after_lead_in(pipe, voice, job.get("speed", 1.0), item["lead_in"], item["text"])
            sf.write(item["out"], trim(audio, lead=0.0, tail=0.06), RATE)
            print(f"  [{i}/{total}] {item['out'].rsplit('/', 1)[-1]}", flush=True)
            continue
        chunks = []
        for piece in re.split(r"(⟨pause [\d.]+⟩)", item["text"]):
            pause = re.fullmatch(r"⟨pause ([\d.]+)⟩", piece)
            if pause:
                chunks.append(np.zeros(int(RATE * float(pause.group(1))), dtype=np.float32))
            elif piece.strip():
                spoken = [
                    a.numpy() if hasattr(a, "numpy") else np.asarray(a)
                    for _, _, a in pipe(piece.strip(), voice=voice, speed=job.get("speed", 1.0))
                ]
                if spoken:
                    chunks.append(trim(np.concatenate(spoken)))
        audio = np.concatenate(chunks) if chunks else np.zeros(RATE // 4, dtype=np.float32)
        if item.get("tight"):
            # a segment of a line, played straight into the next one
            audio = trim(audio, lead=0.02, tail=0.06)
        else:
            # a short tail so the last word isn't clipped
            audio = np.concatenate([audio, np.zeros(RATE // 5, dtype=np.float32)])
        sf.write(item["out"], audio, RATE)
        print(f"  [{i}/{total}] {item['out'].rsplit('/', 1)[-1]}", flush=True)


if __name__ == "__main__":
    main()
