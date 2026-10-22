"""2.1.0: voice the online co-op script track (js/coop/story.js → allVoicedCoopLines()).
Same Kokoro pipeline + cast.json voices as tools/gen_william_vo_202.py (ogg/opus 32k + m4a/aac 48k, loudnorm -16 LUFS).
Run from /workspace/scd2/voice/scratch with its venv:  venv/bin/python /workspace/coop-dev/tools/gen_coop_vo_210.py
Reads cast.json only (never rewrites it). Writes assets/vo/<char>/coop.*.{ogg,m4a} and assets/vo/manifest.json in GAME."""
import json, subprocess, os, sys, hashlib, soundfile as sf
from kokoro_onnx import Kokoro
GAME = os.environ.get('GAME', '/workspace/coop-dev/')
k = Kokoro("kokoro-v1.0.int8.onnx", "voices-v1.0.bin")
cast = json.load(open('cast.json'))['cast']
# not in cast.json yet: voices from /workspace/scd2/voice/VOICE_PIPELINE_PLAN.md
for ck, cv in {'okafor': {'voice': 'am_michael', 'speed': 0.95}}.items(): cast.setdefault(ck, cv)
CHAR = {'silas': 'silas_boone'}  # manifest: char = art/voice folder, speaker = the dialogue line id
lines = json.loads(subprocess.run(['node', '-e', "import('" + GAME + "js/coop/story.js').then(m=>process.stdout.write(JSON.stringify(m.allVoicedCoopLines())))"], capture_output=True, text=True, check=True).stdout)
man = json.load(open(GAME + 'assets/vo/manifest.json'))
def style(v):
    if ':' not in v: return v
    return sum(k.get_voice_style(a.split(':')[0]) * int(a.split(':')[1]) / 100 for a in v.split(','))
n = 0
for L in lines:
    sp = L['speaker']; ch = CHAR.get(sp, sp); c = cast.get(ch)
    if not c: print('NO VOICE for', sp, file=sys.stderr); continue
    mid = f"{L['scene']}.{L['idx']:02d}"
    h = hashlib.sha1((c['voice'] + '|' + L['text']).encode()).hexdigest()[:16]
    if man['lines'].get(mid, {}).get('hash') == h and os.path.exists(f"{GAME}assets/vo/{ch}/{mid}.ogg"): continue
    os.makedirs(f"{GAME}assets/vo/{ch}", exist_ok=True)
    text = L['text'].replace('(quiet) ', '')
    a, sr = k.create(text, voice=style(c['voice']), speed=c.get('speed', 1.0), lang="en-us"); w = f"/tmp/{mid}.wav"; sf.write(w, a, sr)
    for ext, args in [("ogg", ["-c:a", "libopus", "-b:a", "32k"]), ("m4a", ["-c:a", "aac", "-b:a", "48k"])]:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", w, "-af", "loudnorm=I=-16:TP=-1.5:LRA=7", "-ac", "1", "-ar", "48000", *args, f"{GAME}assets/vo/{ch}/{mid}.{ext}"], check=True)
    man['lines'][mid] = {"char": ch, "speaker": sp, "scene": L['scene'], "text": L['text'], "file": f"{ch}/{mid}", "durationMs": int(len(a) / sr * 1000), "source": "js/coop/story.js (kokoro-v1.0, co-op 2.1.0)", "hash": h}
    n += 1; print(mid, flush=True)
json.dump(man, open(GAME + 'assets/vo/manifest.json', 'w'), indent=1)
print('GENERATED', n, 'of', len(lines))
