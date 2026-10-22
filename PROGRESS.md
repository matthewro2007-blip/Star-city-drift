# Online co-op 2.1.0 — progress (resume from here)
Working copy: /workspace/coop-dev (a fresh copy of /workspace/roanoke-open-world-2d; the original was not touched). Git baseline commit = untouched copy.
Patch: /workspace/coop-dev/coop.patch (`git diff baseline..HEAD`). Design and hooks: COOP.md.

## Done
- [x] Copy + git baseline (no node_modules in the source; test deps installed in test/node_modules, git-ignored)
- [x] PeerJS 1.5.5 vendored (js/vendor/peerjs.min.js + LICENSE); loaded locally, no CDN
- [x] Transport (js/coop/net.js): room codes (no O/0/I/1, `sor-` prefix), rel + unrel channels, ping/RTT, 5 s timeout
- [x] Netlify fallback: netlify/functions/signal.mjs + turn.mjs + js/coop/netlify_signal.js. CODE ONLY, not deployed (unit-tested locally with an in-memory store)
- [x] Lobby: Play Online → Create (new campaign or pick a co-op save) / Join (code); invite link ?join=, Copy / Share…, READY both, START (host), version check
- [x] Co-op save slot starCityDrift_coop_v1 on both devices; autosave on leave, disconnect, background, pagehide, Capacitor, Electron; furthest progress wins (+ union)
- [x] Continue Online Game on the main menu with a tooltip and a picker for several saves
- [x] Host-authoritative P2 (William, placeholder = his 2.0.2 `william` anims), enemy targeting split, +50 % waves / +25 % boss HP, revive, leash, midpoint camera + zoom-out
- [x] Lag: 20 Hz snapshots, 100 ms interpolation, input buffering (redundant press ids), guest movement prediction + soft correction
- [x] Drop-out (AFK 60 s, then solo) / drop-in (rejoin in place; held during dialogue or boss fights)
- [x] Dialogue: both press or 4 s; pause syncs both with a banner
- [x] Two-player story track: main1–main4 scenes, NPC reactions, crew barks (js/coop/story.js)
- [x] Platform notes (COOP.md)
- [x] Tests: test/coop_e2e.mjs 58/58 PASS, test/solo_smoke.mjs 7/7 PASS, test/netlify_signal_unit.mjs 11/11 PASS
- [x] Demo: demo/*.png (host + guest + side_by_side), demo/coop_fight_both_players.gif

## Test environment note
This box's managed Chrome policy (`WebRtcIPHandlingUrl: disable_non_proxied_udp`, /etc/opt/chrome/policies/managed) gathers 0 ICE
candidates, so RTCDataChannels cannot open here. The policy was NOT bypassed. The e2e test registers with the real local PeerJS
server (passes), then runs gameplay over `?signal=relay` (test/relay_server.mjs), which carries the identical message protocol.
To test true WebRTC on a normal machine, run with `SIGNAL=local node test/coop_e2e.mjs`.

## Run
```
node test/node_modules/.bin/peerjs --port 9000 --path /sor &     # local PeerJS signaling
node test/relay_server.mjs &                                       # test-only relay (needed on this box)
python3 -m http.server 5180 --bind 127.0.0.1 &                     # from the repo root
node test/coop_e2e.mjs ; node test/solo_smoke.mjs ; node test/netlify_signal_unit.mjs
```

## Open
- [ ] Run SIGNAL=local on a machine without the WebRTC policy (real data channels)
- [ ] PeerJS `reliable:false` gives an unordered but still retransmitted channel (the Netlify path uses a true maxRetransmits:0)
- [ ] sw.js / app-files.json precache not regenerated (run tools/build-app.mjs) → offline PWA would miss js/coop/*
- [ ] Host always plays Matthew (P1); a William-device that hosts via Continue plays Matthew that session
- [ ] William cannot revive Matthew (main.js owns Matthew's KO/respawn); boss double-team finisher, stealth split, W1–W4 co-op quest rules, VO for co-op lines not done
- [ ] Guest does not mirror host-only overlays (story intro card, ending screen, DLC cards); guest-side toasts are limited to mirrored ones
- [ ] TURN: /api/turn exists, but net.js does not fetch it yet in PeerJS mode (globalThis.__sorTurn hook)

## Session 2 (2026-10-21) — co-op finished
Done: boss double-team finisher, stealth split (rails), W1–W4 co-op rules (W4 = P1 vs P2 points match, with an AI fallback if William drops), William revives a downed Matthew (KO-branch COOP-HOOK: downStep/targetFor), guest mirrors the intro card, ending and toasts, TURN fetched via ensureTurn() before Peer creation, precache regenerated (js/coop/* + vendored peerjs included), 67 co-op VO clips (Kokoro, cast.json voices; okafor fallback am_michael) in assets/vo/*/coop.* + manifest.
Tests: coop_e2e 58/58, coop_beats 36/36, solo_smoke 7/7, netlify_signal_unit 11/11.
Open: real WebRTC untested on box (Chrome policy, relay used); PeerJS reliable:false still retransmits; host is always Matthew; W3 timer not tightened; Okafor lines are toasts; finisher test is semi-synthetic; W4 AI fallback not live-tested; stealth is optional post-main3; given regen.py path absent (tools/gen_coop_vo_210.py used).
