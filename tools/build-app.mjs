#!/usr/bin/env node
/**
 * Star City Drift — app build step (PWA precache + file list).
 *
 *   node tools/build-app.mjs
 *
 * Walks the game folder, collects every runtime file (html/css/js/assets/icons/
 * manifest + any new folders you add later), and writes:
 *   - sw.js          service worker with the precache list + a content-hash cache version
 *   - app-files.json the same list, used by /workspace/star-city-drift-app to copy the game
 *
 * Re-run after adding/changing content. Any file change => new cache version =>
 * installed PWAs pick up the update on next launch. No dependencies.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Paths/patterns that are NOT part of the shipped game (dev tools, docs, concept art).
const EXCLUDE_DIRS = new Set(['tools', 'node_modules', '.git', '__pycache__', 'dist', 'android', 'ios', 'vo', 'test', 'netlify', 'demo']); // 2.1.0 co-op: tests, Netlify functions (server-side) and demo captures never ship // VO-HOOK: assets/vo is loaded on demand, never precached / listed in app-files.json
const EXCLUDE_FILE_RE = [
  /^\./,                    // dotfiles
  /\.(md|py|pyc|log|psd|aseprite|kra|xcf|sh|bat)$/i,
  /^concept-/i,             // concept preview art at root
  /^sw\.js$/, /^app-files\.json$/,
  /^Thumbs\.db$/i,
  /\.(patch|toml)$/i,       // 2.1.0 co-op: coop.patch, netlify.coop.toml
  /\.(pre_[\w-]+|bak|orig|md5)$/i, // 1.5.0: install backups (e.g. *.pre_silas_outfit) never ship
  /_v[12]\.png$/,             // 1.5.0: superseded art nobody references (keeps the web zip < 25 MB)
  /^icon(-maskable)?-1024\.png$/, // store-size icons: packagers read them from the source tree (sync-game.mjs)
  // 1.5.2: sprite files no code or anims*.json references (old NPC 8-pose sheets superseded by <id>.png + <id>_anim.png,
  // the pre-anim atlas/idle strips). Keeps the web zip < 25 MB with the new character art.
  /^(cam|coach|dee|gus|hank|ivy|june|lou|pip|priya|tessa|wren)_sheet\.png$/,
  /^(npcs|fx|matthew|matthew_idle|portrait_matthew_v3_side|snatcher)\.png$/,
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (!EXCLUDE_DIRS.has(name) && !name.startsWith('.')) walk(abs, out);
    } else if (!EXCLUDE_FILE_RE.some((re) => re.test(name))) {
      out.push(relative(ROOT, abs).split(sep).join('/'));
    }
  }
  return out;
}

const files = walk(ROOT);
if (!files.includes('index.html')) throw new Error('index.html not found — run from the game repo');

// ---- VO-HOOK: voice-over per packaged target (never in sw.js PRECACHE / app-files.json) ----
//   node tools/build-app.mjs --dry                                  print per-target file lists, write nothing
//   node tools/build-app.mjs --stage-vo=<webRoot> --vo-target=<t>   copy VO into a packaged web root (run AFTER sync)
//     t = electron | android  -> assets/vo/**/*.ogg + manifest.json (bundled: "ogg")
//     t = ios                 -> assets/vo/**/*.m4a + manifest.json (bundled: "m4a")  [no iOS target exists yet]
//   Web/PWA: assets/vo is served from the game folder on demand (both formats; vo.js picks with canPlayType).
const VO_DIR = join(ROOT, 'assets', 'vo');
const VO_FORMAT = { electron: 'ogg', android: 'ogg', ios: 'm4a' };
function voFiles(target) {
  const ext = VO_FORMAT[target]; if (!ext) throw new Error(`unknown VO target ${target} (electron|android|ios)`);
  const out = [];
  const rec = (d) => { for (const n of readdirSync(d).sort()) { const a = join(d, n); if (statSync(a).isDirectory()) rec(a); else if (n.endsWith('.' + ext)) out.push(relative(ROOT, a).split(sep).join('/')); } };
  try { statSync(VO_DIR); } catch { return { ext, files: [] }; }
  rec(VO_DIR);
  return { ext, files: ['assets/vo/manifest.json', ...out] };
}
const argv = process.argv.slice(2), arg = (k) => { const a = argv.find((x) => x === k || x.startsWith(k + '=')); return a ? (a.split('=')[1] ?? true) : null; };
const leaks = files.filter((f) => f.startsWith('assets/vo/') || f === 'js/vo.manifest.json');
if (leaks.length) throw new Error(`VO leaked into the precache list: ${leaks.slice(0, 3).join(', ')}…`);
if (arg('--stage-vo')) {
  const dest = arg('--stage-vo'), target = arg('--vo-target') || 'electron';
  const { ext, files: vf } = voFiles(target);
  let n = 0, b = 0;
  for (const f of vf.slice(1)) { mkdirSync(dirname(join(dest, f)), { recursive: true }); copyFileSync(join(ROOT, f), join(dest, f)); n++; b += statSync(join(ROOT, f)).size; }
  const man = JSON.parse(readFileSync(join(VO_DIR, 'manifest.json'), 'utf8'));
  man.bundled = ext; // vo.js requests only this format
  mkdirSync(join(dest, 'assets', 'vo'), { recursive: true });
  writeFileSync(join(dest, 'assets', 'vo', 'manifest.json'), JSON.stringify(man));
  console.log(`build-app: staged ${n} .${ext} VO clips (${(b / 1048576).toFixed(2)} MB) + manifest.json -> ${dest} [${target}]`);
  process.exit(0);
}
if (arg('--dry')) {
  console.log(`build-app --dry: ${files.length} precache/app-files entries; VO entries among them: ${leaks.length}`);
  for (const t of Object.keys(VO_FORMAT)) {
    const { ext, files: vf } = voFiles(t);
    const other = vf.filter((f) => f !== 'assets/vo/manifest.json' && !f.endsWith('.' + ext)).length;
    const bytesT = vf.reduce((a, f) => a + statSync(join(ROOT, f)).size, 0);
    console.log(`  ${t.padEnd(8)} VO: ${vf.length - 1} .${ext} + manifest.json, ${(bytesT / 1048576).toFixed(2)} MB, wrong-format files: ${other}; e.g. ${vf.slice(1, 3).join(', ')}`);
  }
  process.exit(0);
}

const hash = createHash('sha256');
let bytes = 0;
const hashes = {}; // per-file content hash: the desktop/Android shells only download files that changed
for (const f of files) {
  const buf = readFileSync(join(ROOT, f));
  bytes += buf.length;
  hashes[f] = createHash('sha256').update(buf).digest('hex').slice(0, 16);
  hash.update(f + '\0').update(buf);
}
const version = hash.digest('hex').slice(0, 12);
const precache = ['./', ...files];

const sw = `/* Streets of Roanoke service worker — GENERATED by tools/build-app.mjs. Do not edit by hand. */
const VERSION = '${version}';
const CACHE_PREFIX = 'streets-of-roanoke-';
const OLD_PREFIXES = ['star-city-drift-']; // 1.7.0 rename: clear the old caches too
const CACHE = CACHE_PREFIX + VERSION;
const PRECACHE = ${JSON.stringify(precache, null, 2)};
// Code/markup: network-first (updates arrive immediately when online). Art/other: stale-while-revalidate.
const NETWORK_FIRST_RE = /(\\/|\\.html|\\.js|\\.mjs|\\.css|\\.webmanifest|\\.json)$/i;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  self.skipWaiting(); // not awaited: Chrome resolves it only after activation (would deadlock install)
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Add files one by one so a single missing/renamed file can't break the whole install.
    const results = await Promise.allSettled(PRECACHE.map(async (u) => {
      const res = await fetch(new Request(u, { cache: 'reload' }));
      if (!res.ok) throw new Error(u + ' -> HTTP ' + res.status);
      await cache.put(u, res);
    }));
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) console.warn('[sw] ' + failed.length + ' precache file(s) skipped; re-run tools/build-app.mjs', failed.map((r) => String(r.reason)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => (k.startsWith(CACHE_PREFIX) || OLD_PREFIXES.some((p) => k.startsWith(p))) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'SCD_SW_VERSION', version: VERSION });
});

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request, { ignoreSearch: true }))
    || (request.mode === 'navigate' ? cache.match('index.html') : undefined);
}

async function putInCache(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const net = fetch(request, { cache: 'no-cache' }).then((r) => putInCache(request, r)); // revalidate past the HTTP cache
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NETWORK_TIMEOUT_MS));
    return await Promise.race([net, timeout]);
  } catch (_) {
    const cached = await fromCache(request);
    if (cached) return cached;
    return fetch(request); // last try (surfaces the real network error)
  }
}

async function staleWhileRevalidate(event) {
  const request = event.request;
  const cached = await fromCache(request);
  const refresh = fetch(request, { cache: 'no-cache' }).then((r) => putInCache(request, r)).catch(() => undefined);
  if (cached) { event.waitUntil(refresh); return cached; }
  return (await refresh) || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/preview/')) return; // 1.5.0: the standalone preview build is never served or cached by this worker
  if (request.mode === 'navigate' || NETWORK_FIRST_RE.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(event));
  }
});
`;

writeFileSync(join(ROOT, 'sw.js'), sw);
hashes['sw.js'] = createHash('sha256').update(sw).digest('hex').slice(0, 16);
writeFileSync(join(ROOT, 'app-files.json'), JSON.stringify({ version, generated: new Date().toISOString(), bytes, files: [...files, 'sw.js'], hashes }, null, 2) + '\n');
console.log(`build-app: ${files.length} files, ${(bytes / 1048576).toFixed(2)} MB, cache version ${version}`);
console.log('  wrote sw.js and app-files.json');
