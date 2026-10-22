"""2.0.2: voice William Burks (js/william.js) + the fetch-item lines Dee/Tessa/June give for "Water the Flowers".
Same Kokoro pipeline as tools/gen_bark_vo_201.py. Run from /workspace/scd2/voice/scratch with its venv."""
import json, re, subprocess, os, soundfile as sf
from kokoro_onnx import Kokoro
GAME = '/workspace/roanoke-open-world-2d/'
k = Kokoro("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
cast = json.load(open('cast.json'))['cast']
cast['william'] = {'voice': 'am_liam:60,am_puck:40', 'lang': 'en-us', 'speed': 1.06}
json.dump(json.load(open('cast.json')) | {'cast': cast}, open('cast.json', 'w'), indent=1)
man = json.load(open(GAME + 'assets/vo/manifest.json'))
src = open(GAME + 'js/william.js').read()
def strs(block):
    return [s[1:-1].replace('\\"', '"').replace("\\'", "'") for s in re.findall(r'"(?:[^"\\]|\\.)*"', block)]
def arr(name, body):
    m = re.search(name + r": \[\n?(.*?)\n?\s*\]", body, re.S); return strs(m.group(1)) if m else []
jobs = []
npc = src[src.index('WILLIAM_NPC = {'):src.index('export function williamStageSpot')]
for f in ('lines', 'waitLines', 'activeLines', 'doneLines'):
    for i, t in enumerate(arr(f, npc), 1): jobs.append(('william', f'npc.william.{f}.{i:02d}', 'npc.william', t))
for mid, body in re.findall(r"\n  (side_william_[a-z]+): \{(.*?)\n  \}", src, re.S):
    for f in ('offer', 'active'):
        for i, t in enumerate(arr(f, body), 1):
            if any(j[3] == t and j[0] == 'william' for j in jobs): continue
            jobs.append(('william', f'mission.{mid}.{f}.{i:02d}', f'mission.{mid}', t))
    d = re.search(r'doneLine: "((?:[^"\\]|\\.)*)"', body)
    if d: jobs.append(('william', f'mission.{mid}.doneLine', f'mission.{mid}', d.group(1)))
    for iid, who, t in re.findall(r"\{ id: '([a-z_]+)', npc: '([a-z]+)', name: '[^']*', line: \"((?:[^\"\\\\]|\\\\.)*)\" \}", body):
        jobs.append((who, f'mission.{mid}.item_{iid}', f'mission.{mid}', t))
def style(v):
    if ':' not in v: return v
    return sum(k.get_voice_style(a.split(':')[0]) * int(a.split(':')[1]) / 100 for a in v.split(','))
DIR = {'william': 'william'}
for who, mid, scene, text in jobs:
    c = cast[who]; d = DIR.get(who, who); os.makedirs(f"{GAME}assets/vo/{d}", exist_ok=True)
    a, sr = k.create(text, voice=style(c['voice']), speed=c.get('speed', 1.0), lang="en-us"); w = f"/tmp/{mid}.wav"; sf.write(w, a, sr)
    for ext, args in [("ogg", ["-c:a", "libopus", "-b:a", "32k"]), ("m4a", ["-c:a", "aac", "-b:a", "48k"])]:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", w, "-af", "loudnorm=I=-16:TP=-1.5:LRA=7", "-ac", "1", "-ar", "48000", *args,
                        f"{GAME}assets/vo/{d}/{mid}.{ext}"], check=True)
    man['lines'][mid] = {"char": who, "speaker": who, "scene": scene, "text": text, "file": f"{d}/{mid}", "durationMs": int(len(a) / sr * 1000), "source": "kokoro-v1.0 (William Burks 2.0.2)"}
    print(mid, flush=True)
json.dump(man, open(GAME + 'assets/vo/manifest.json', 'w'), indent=1)
print('TOTAL', len(jobs))
