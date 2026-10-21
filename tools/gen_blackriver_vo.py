"""2.0.0 WIP: Blackriver VO (Kokoro v1.0 int8 ONNX, same post-fx as the shipped 513). Input: /tmp/br_lines.json (dumped from
js/dlc_blackriver.js allLines() + js/scenes_blackriver.js brSceneLines()). Output: assets/vo/blackriver/*.ogg|m4a + manifest entries.
Run with /workspace/scd2/voice/scratch/venv/bin/python from that scratch dir."""
import json, subprocess, sys, soundfile as sf
from kokoro_onnx import Kokoro
GAME = '/workspace/roanoke-open-world-2d/'
k = Kokoro("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
MASK = "lowpass=f=3200,highpass=f=120,aecho=0.8:0.5:18:0.25,"
CAST = {"silas": ("am_onyx:60,bm_lewis:40", 0.88, ""), "matthew": ("am_michael", 0.97, ""), "pruitt": ("am_eric", 1.02, ""),
        "lockkeeper": ("am_adam:60,am_michael:40", 0.86, MASK), "marcus": ("am_adam:60,am_michael:40", 0.95, ""),
        "thorne": ("af_kore:70,bf_emma:30", 0.95, ""), "ida": ("bf_isabella:60,af_sarah:40", 0.92, ""),
        "hank": ("am_santa:70,am_fenrir:30", 0.88, ""), "voss": ("am_fenrir:70,am_puck:30", 0.98, "")}
lines = json.load(open('/tmp/br_lines.json'))
man = json.load(open(GAME + 'assets/vo/manifest.json'))
n = {}
for l in lines:
    ch = l['id']; v, spd, fx = CAST[ch]; n[ch] = n.get(ch, 0) + 1
    lid = f"br.{ch}.{n[ch]:02d}"
    sty = sum(k.get_voice_style(a.split(':')[0]) * int(a.split(':')[1]) / 100 for a in v.split(',')) if ':' in v else v
    say = l['text'].replace('C-14', 'C fourteen')
    a, sr = k.create(say, voice=sty, speed=spd, lang="en-us"); w = f"/tmp/{lid}.wav"; sf.write(w, a, sr)
    for ext, args in [("ogg", ["-c:a", "libopus", "-b:a", "32k"]), ("m4a", ["-c:a", "aac", "-b:a", "48k"])]:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", w, "-af", fx + "loudnorm=I=-16:TP=-1.5:LRA=7", "-ac", "1", "-ar", "48000", *args,
                        f"{GAME}assets/vo/blackriver/{lid}.{ext}"], check=True)
    man['lines'][lid] = {"char": ch, "speaker": ch, "scene": l.get('scene', 'br'), "text": l['text'], "file": f"blackriver/{lid}", "durationMs": int(len(a) / sr * 1000), "source": "kokoro-v1.0 (Blackriver 2.0.0 WIP)"}
    print(lid, flush=True)
json.dump(man, open(GAME + 'assets/vo/manifest.json', 'w'), indent=1)
