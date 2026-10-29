"""Merge Joe's staged 2.1.1 art (/workspace/anim_pass/joe/fix211/out): 30 cast walks, William's 6-pose walk, matthew_2028.
NOT run yet: waiting for Matthew's approval. Usage (repo root): python3 tools/merge_joe_fix211.py [--dry]
- backs up every replaced file + anims.json + tools/fix211_orig_states.json to /workspace/backups/joe_fix211_<time>/
- copies out/assets/sprites/*.png into assets/sprites/
- merges fragments/anims_fragment_fix211.json states into anims.json (state-level override)
- writes the same states into tools/fix211_orig_states.json so a re-run of tools/fix211_anims.py keeps them
Afterwards: python3 tools/fix211_anims.py (anchors/travel), node tools/build-app.mjs, run the tests."""
import json, os, shutil, sys, time, glob
J = '/workspace/anim_pass/joe/fix211'
dry = '--dry' in sys.argv
frag = json.load(open(f'{J}/fragments/anims_fragment_fix211.json'))['characters']
pngs = sorted(glob.glob(f'{J}/out/assets/sprites/*.png'))
refs = {s.get('file') for c in frag.values() for s in c['states'].values() if isinstance(s.get('file'), str)}
missing = [r for r in refs if not os.path.exists(f'{J}/out/{r}')]
if missing: sys.exit(f'fragment references missing strips: {missing}')
bk = f'/workspace/backups/joe_fix211_{time.strftime("%Y%m%d_%H%M%S")}'
print(('DRY ' if dry else '') + f'{len(pngs)} strips, {len(frag)} characters -> backup {bk}')
if dry: sys.exit(0)
os.makedirs(bk + '/assets/sprites', exist_ok=True)
for f in ['assets/sprites/anims.json', 'tools/fix211_orig_states.json']:
    if os.path.exists(f): shutil.copy2(f, f'{bk}/{os.path.basename(f)}')
for p in pngs:
    dst = 'assets/sprites/' + os.path.basename(p)
    if os.path.exists(dst): shutil.copy2(dst, f'{bk}/assets/sprites/')
    shutil.copy2(p, dst)
am = json.load(open('assets/sprites/anims.json'))
orig = json.load(open('tools/fix211_orig_states.json'))
for k, ch in frag.items():
    dst = am['characters'].setdefault(k, {'file': ch.get('file'), 'states': {}})
    for n, st in ch['states'].items():
        dst['states'][n] = st
        orig.setdefault(k, {})[n] = st
json.dump(am, open('assets/sprites/anims.json', 'w'), separators=(',', ':'))
json.dump(orig, open('tools/fix211_orig_states.json', 'w'))
print('merged; now run tools/fix211_anims.py and node tools/build-app.mjs')
