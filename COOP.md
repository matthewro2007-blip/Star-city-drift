# Online co-op (2.1.0) — Streets of Roanoke / Star City Drift

Two-player online co-op of the main campaign. P1 = Matthew Rose (host), P2 = **William Burks** (guest, using his
current `william` anim set from 2.0.2 as a placeholder). Local only: nothing here was deployed, published or signed up for.

## Files
| File | What |
|---|---|
| `js/coop/hooks.js` | The single `coop` object main.js calls. Session (host/guest), P2 sim on the host, snapshots, interpolation, input buffer, drop-in/out, HUD, title buttons, lifecycle autosave |
| `js/coop/net.js` | Transport: PeerJS (vendored) with `rel` + `unrel` channels, room codes, ping/RTT, 5 s liveness timeout; also the test relay |
| `js/coop/netlify_signal.js` | Fallback signaling over `/api/signal` (plain RTCPeerConnection, non-trickle ICE, 1 s polling, a real `maxRetransmits:0` channel) |
| `js/coop/coop_save.js` | `starCityDrift_coop_v1` slot, progressScore, furthest-progress merge (collectibles + outfits unioned) |
| `js/coop/lobby.js` | Play Online menu, lobby (code, invite link, Copy / Share…, cards, READY, START, version check), save picker |
| `js/coop/story.js` | Co-op script track: main1–main4 two-player scenes, NPC reactions, enemy barks |
| `js/vendor/peerjs.min.js` | PeerJS 1.5.5 (MIT, `peerjs.LICENSE`) — loaded locally, never from a CDN |
| `netlify/functions/signal.mjs`, `turn.mjs`, `netlify.coop.toml` | Signaling fallback + TURN credential function. **Code only, not deployed** |
| `css/style.css` (appended block) | Lobby / HUD styles |
| `js/version.js` | 2.0.2 → 2.1.0 |
| `test/coop_e2e.mjs`, `test/relay_server.mjs`, `test/netlify_signal_unit.mjs` | Tests |

## How it works
- **Host-authoritative.** The host runs AI, hits, missions, scenes, saves. Player 2 is a second `createPlayer()` entity
  (`animKey: 'william'`) updated by the host with the guest's inputs; `resolveHits(william, enemies)` uses the same combat code.
  Enemies pick a target (P1 or P2) every 2 s, with odd ids leaning toward William so a pack splits.
- **Guest** sends inputs every frame on the unreliable channel. Each packet repeats the presses from the last 600 ms with ids,
  so a dropped packet loses nothing and the host applies each press exactly once (**input buffering**; the host keeps ≤ 3 frames of jitter).
  The guest predicts only William's own movement and is blended toward the host's position (snap if > 120 px off).
- **Snapshots** at 20 Hz (Matthew, William, enemies, combat/boss flags, score, outfit). Static enemy info (art key, tint, boss flags)
  goes once on the reliable channel. The guest draws everything **100 ms in the past**, interpolating between two snapshots (`?interp=` to tune).
- **Reliable events:** hello/version, lobby/ready/start, every save (`save`), dialogue lines (`dlg`), dialogue advance, pause/resume, toasts, barks, bye.
- **Dialogue:** advances when both press, or 4 s after the first press. The guest sees the same dialogue box.
- **Pause:** either player pauses both, with a "William paused" or "Matthew paused" banner.
- **Camera:** follows the midpoint and zooms out toward 1.0× (by adjusting the exported `CAMERA.zoom`, so camera.js is not edited). There is a one-screen leash.
- **Enemy scaling:** a fresh wave of 2 or more gets +50 % plain thugs (the 2.0.1 sergeant cap is unaffected) and a crew bark ("There's two of 'em!"). Bosses get +25 % HP.
- **Revive:** a downed William shows KO stars. Matthew presses Interact next to him and stays close for 2 s, or William gets up when the street is clear.
- **Saves:** see `coop_save.js`. The host writes on every `persist()` (checkpoints, mission steps, the 8 s autosave, area change) and sends the
  entry. The guest stores the identical copy (same hash/saveRev). An autosave with a reason ("Saved when William left") happens on Leave, on a disconnect or
  timeout, on `visibilitychange`/`pagehide`, on Capacitor `appStateChange`, and on Electron `sorElectron.onBeforeQuit` if the shell exposes it.
  The solo save `starCityDrift_v1` is never written while co-op runs (main.js `persist()` hook).
- **Continue Online Game** appears on the title when an unfinished co-op save exists. Hovering or focusing it shows a tooltip (partner, next mission, why/when saved).
  With several saves it opens a picker. It reopens the lobby with the same partnership id and a fresh room code. On join the copies are compared, the furthest wins, and both end up identical.
- **Drop-out:** if the guest drops, the host gets a toast, William goes AFK (greyed, invulnerable) for 60 s (`?afkSec=`), then walks off and fades, and the host continues solo with solo enemy counts.
  The room stays open, and the same link rejoins in place. If the host drops, the guest gets "Matthew's game ended – saved on your device too." and returns to the title.
- **Drop-in:** a joiner during dialogue or a boss fight gets "you join at the next checkpoint" and is admitted when the host is back in free play.

## main.js hooks (Arlo's file) — 14 one-line hooks, all marked `// COOP-HOOK`
Every call is a no-op when co-op is off, so solo behavior is unchanged.
1. `import { coop } from './coop/hooks.js'`
2. `startGame`: `const r = coop.saveSource() || inspectSave();` (a co-op session loads its own slot)
3. `startDialogue`: `let lines = coop.lines(npc, linesFor(npc));` (two-player script)
4. `npcsInArea`: `return coop.filterNpcs(list);` (no NPC William while P2 plays him)
5. `persist`: `if (coop.persist(payload)) return true;` (co-op slot; the solo save is untouched)
6. `step`: `coop.preStep(dt, inp);` after `input.poll()` (network pump, dialogue/pause sync, HUD)
7. dialogue branch: `... && coop.allowAdvance()` (both press, or 4 s)
8. `step` PLAY: `if (coop.guestStep(dt, inp)) { updateHUD(); drawWorld(dt); return; }` (the guest only renders)
9. enemy loop: `updateEnemy(e, e.target ? sideTarget(e) : coop.targetFor(e, player), …)`
10. after `silasWorld(...)`: `coop.hostStep(dt, area);`
11. `syncCamera`: `playerX: coop.camX(player.x)`
12. `drawWorld`: `coop.drawItems(drawList);` after the `__drawn` debug line
13. `drawWorld` shadow loop: `if (item.type === 'coop') continue;`, and cast loop: `if (item.type === 'coop') { item.draw(cam); continue; }`
14. before `boot()`: `coop.attach({...})`, which hands over getters and existing functions (gameState, stateBag, player, ctx, startGame, persist, drawAnimFrame, …)

**camera.js: no changes.** Co-op zoom-out sets the exported `CAMERA.zoom` at runtime and restores it when co-op ends.

## Signaling modes (`?signal=`)
- `local`: the npm `peer` server on `localhost:9000/sor` (default on localhost). Start it with `node test/node_modules/.bin/peerjs --port 9000 --path /sor`.
- `cloud`: the PeerJS cloud broker, the default off localhost.
- `netlify`: `/api/signal` (deploy `netlify/functions` first; not done).
- `relay`: **test-only** WebSocket relay (`test/relay_server.mjs`, `ws://localhost:9001`) for machines where WebRTC is blocked by policy.

## Platform notes
| Platform | Needed |
|---|---|
| Browser / PWA | HTTPS (GitHub Pages / Netlify OK). Add `js/coop/*`, `js/vendor/peerjs.min.js` to `app-files.json` / `sw.js` precache (`tools/build-app.mjs` rebuild) so offline installs have them. `?join=RKE-4F7` links work as-is. |
| **Windows (Electron)** | Chromium has RTCDataChannel. Register `app.setAsDefaultProtocolClient('streetsofroanoke')`. Handle `second-instance` / `open-url` and forward `streetsofroanoke://join/CODE` to the page as `?join=CODE`. Expose `window.sorElectron.onBeforeQuit(cb)` from the preload (wired to `before-quit`) so the final co-op save is written. Windows Firewall may prompt once. The vendored PeerJS loads from `file://` (no CDN). |
| **Android (Capacitor)** | The WebView supports data channels. Add an intent filter for `streetsofroanoke://join` in `AndroidManifest.xml` and use `@capacitor/app` `appUrlOpen` to route to Join. Add `@capacitor/share` for **Share…** (already used if present). `appStateChange` autosave is wired. Needs the `INTERNET` permission (default). |
| **iPhone (Capacitor, WKWebView)** | Data channels need iOS 14.3+. Add a URL scheme (`CFBundleURLTypes`) for `streetsofroanoke`. Backgrounding kills the connection, so the `appStateChange` and `visibilitychange` autosave matter most. `@capacitor/share` works for invites. Expect the 5 s timeout, then AFK on the host and rejoin. |
| Crossplay | Same JS and protocol everywhere. Versions must match exactly (lobby check). |
| TURN | Strict NAT needs `/api/turn` (code included, no account created). Without it, players on strict NAT see "Couldn't connect – try another network". |

## 2.1.0 completion notes
- main.js COOP-HOOKs: 16 (new: `coop.downStep(dt, area)` and `coop.targetFor(e, player)` in the KO branch; attach() also passes startDialogueRaw, startSide, completeSide, fetchDone, npcsInArea, sideMission).
- TURN: net.js `ensureTurn()` GETs `api/turn` (or `?turnUrl=`), 2.5 s timeout, falls back to STUN.
- VO: `python tools/gen_coop_vo_210.py` (scd2 voice scratch venv) regenerates assets/vo/<char>/coop.* and the manifest entries; it is hash-skipping.
- Precache: build-app.mjs now excludes test/, netlify/, demo/, *.patch, *.toml. Rerun `node tools/build-app.mjs` after applying.
