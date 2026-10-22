"""2.0.1: voice the new Blackriver barks (js/barks.js pools co_guard*, lk_crew, voss, lockkeeper) with the same Kokoro
pipeline as tools/gen_blackriver_vo.py. Run from /workspace/scd2/voice/scratch with its venv."""
import json, re, subprocess, soundfile as sf
from kokoro_onnx import Kokoro
GAME = '/workspace/roanoke-open-world-2d/'
k = Kokoro("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
MASK = "lowpass=f=3200,highpass=f=120,aecho=0.8:0.5:18:0.25,"
RADIO = "highpass=f=300,lowpass=f=3400,"
VOICE = {'co_guard': ("am_eric", 1.02, ""), 'co_guard_riot': ("am_fenrir", 0.96, RADIO), 'co_guard_baton': ("am_liam", 1.04, ""),
         'co_guard_sgt': ("am_michael:50,am_onyx:50", 0.94, ""), 'lk_crew': ("am_puck", 1.0, ""),
         'voss': ("am_fenrir:70,am_puck:30", 0.98, ""), 'lockkeeper': ("am_adam:60,am_michael:40", 0.86, MASK)}
src = open(GAME + 'js/barks.js').read()
man = json.load(open(GAME + 'assets/vo/manifest.json'))
def style(v):
    if ':' not in v: return v
    return sum(k.get_voice_style(a.split(':')[0]) * int(a.split(':')[1]) / 100 for a in v.split(','))
def pool_lines(pool):
    m = re.search(r"\n  " + pool + r": \{\n(.*?)\n  \},?\n", src, re.S)
    return re.findall(r"\{ id: '([a-z0-9_]+)', text: (\"[^\"]*\"|'[^']*') \}", m.group(1)) if m else []
jobs = []
for pool in ('co_guard', 'lk_crew', 'voss', 'lockkeeper'): jobs += [(pool, i, t[1:-1]) for i, t in pool_lines(pool)]
blk = src[src.index('2.0.1: guard variants'):]
for pool, body in re.findall(r"BARKS\.(co_guard_[a-z]+) = variant\((.*?)\);\n", blk):
    jobs += [(pool, i, t[1:-1]) for i, t in re.findall(r"\{ id: '([a-z0-9_]+)', text: (\"[^\"]*\"|'[^']*') \}", body)]
for pool, lid, text in jobs:
    v, spd, fx = VOICE[pool]; mid = f"bark.{pool}.{lid}"
    a, sr = k.create(text.replace('C-14', 'C fourteen'), voice=style(v), speed=spd, lang="en-us"); w = f"/tmp/{mid}.wav"; sf.write(w, a, sr)
    for ext, args in [("ogg", ["-c:a", "libopus", "-b:a", "32k"]), ("m4a", ["-c:a", "aac", "-b:a", "48k"])]:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", w, "-af", fx + "loudnorm=I=-16:TP=-1.5:LRA=7", "-ac", "1", "-ar", "48000", *args,
                        f"{GAME}assets/vo/blackriver/{mid}.{ext}"], check=True)
    man['lines'][mid] = {"char": pool, "speaker": pool, "scene": f"bark.{pool}", "text": text, "file": f"blackriver/{mid}", "durationMs": int(len(a) / sr * 1000), "source": "kokoro-v1.0 (Blackriver 2.0.1 barks)"}
    print(mid, flush=True)
json.dump(man, open(GAME + 'assets/vo/manifest.json', 'w'), indent=1)
print('TOTAL', len(jobs))
