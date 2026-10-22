# Changelog

## 2.0.3 - Fight animations (staging, unreleased)
- Joe's new fight animations: Matthew in all 15 outfits (14 states: longer 7-8 frame combos, two-hit combo2, special, hurt, KO, knockdown, get-up, run/sprint, idle, victory) and William's 17 states plus dash, hop kick, magazine swat and Extra Life. New 480x394 cells.
- Jack's new enemy animations: 22 enemies, bosses and Silas looks (thugs, snatcher, Foreman crew, the four prison guards, Vera, the Foreman, Tumbler Voss, the Lockkeeper, Silas boss, playable Silas, Silas red / C-14 / young / older). New hurt reactions (high / body / back), knockdown fall -> bounce -> ground -> get-up, and Silas's new short cane jab.
- Joe's redesigned cast (30 characters: town NPCs, inmates, officers and the 2015 cast) replaces the old NPC models. For now each one is a single idle pose, used for idle, talk and walk.
- William now fights next to Matthew when a fight breaks out where he's standing (his quests, or any street fight in his area). Once per fight, his Extra Life patches Matthew up when he's low.
- Timing: enemy attacks wind up longer (first hit at about 0.27-0.33 s) and a grunt hit during its wind-up loses the swing. Matthew's combos chain from the follow-through frames, and a press during a string is held until then.
- Fixed: Silas's C-14 jumpsuit look no longer paints his hair orange on rotated or lying frames.

## 2.0.2 - William Burks
- New character: **William Burks**, Matthew's oldest friend (plaid flannel, controller tee). He's in the main game as an NPC, and his spot changes with the story: outside Dee's Diner, then by Wren's empty cart, then at the Rail Yards fence, and at Valley Gym after the ending.
- 4 new side quests from William, all voiced: "The Boys' Booth" (defend Dee's window), "High Score" (walk the Starlite Arcade cabinet to Valley Pages), "Water the Flowers" (keep Wren's cart alive), and post-game "Coach's Corner Rematch".
- His quests don't count toward 100%, so existing saves and the Gold Star unlock are unchanged. Quest progress saves in the normal slot.
- His full animation set is in the game files, ready for co-op later.

## 2.0.1 - Blackriver guards + duplicate fix
- Fixed: after a Blackriver cutscene ended, its cast (Silas, the 2028 Matthew) stayed on the street, so two Silases showed up (prison lobby, Cell Block C fights, rail yard, river). Scene actors are now cleared when a scene ends or is skipped.
- New Cinder Hollow guard art for the prison levels, in mixed variants: C.O., riot guard (helmet + C.H.C.F. shield), baton guard, sergeant (at most one per wave). Guards no longer reuse the Foreman's crew.
- Tumbler Voss and the Lockkeeper have their own fight art and their own barks (no more Foreman lines).
- New 2028 barks for the guards, the Lockkeeper's crew, Voss and the Lockkeeper, voiced.

## 2.0.0 - DLC "Blackriver"
- New DLC on the title screen: **Blackriver** (Silas Boone, 2028). 9 missions (M0 "Visiting Hours" through M8), own save slot; main save untouched.
- Playable aged Silas: orange C-14 jumpsuit (M0-4), red suit from M5; C-14 jumpsuit unlockable outfit (outfit key toggles).
- The Lockkeeper (masked Marcus Hale), mask reveal, ending: Silas joins Blackriver; City Market epilogue sequel hook.
- Joe's 2028 Matthew (sprite + portraits). 59 new voice lines (Kokoro) in assets/vo/blackriver.
- Scene player: day-lit scenes skip the DLC night grade and hide collectibles.

## 1.9.0 "Cutscenes & Voices" (2026-10-15)
### Team additions in this release
- **Scene player (`js/scene_player.js`):** data-driven cutscenes (moveActor / anim / cameraPan / cameraZoom / line / wait / fade / letterbox / call), letterbox inside the visible frame, HUD and hints hidden, traffic and bystanders paused, no save / pause mid-scene; skip with Esc, pad Start/B or the touch Skip button. The prequel closing scene and the arrest are scenes now; "Continue" until a scene's last line.
- **Camera zoom 1x / 2x / 3x** (Q, R3, pause UI by Bob): head room, player centred, framing biased toward enemies; stored in `sor_zoom`; `window.sorZoom`, `sor:zoom` / `sor:zoomchanged` events.
- **Kody, voice-over:** recorded VO for dialogue, scenes, barks and Silas's cell (`js/vo.js`, `assets/vo`, loaded on demand, never precached); mouth flap follows the clip; .ogg in the desktop / Android builds.
- **Jack, story:** "Second Shift" 2015 prequel rework (teen Matthew, Dora / Mina / Bart / Otto young, new mission 6 and ending), five prequel scenes, Marcus Hale's 3 side missions, Wren's rescue line, fetch missions saved mid-way.
- **Joe, art:** dialogue portraits with talking mouths, cutscene poses, `_young` 2015 cast, Marcus at 2015 / 2026 / 2028.
- **Bob:** barks and the zoom pause / touch UI.
### Fixes
- Prequel objective marker follows teen Matthew between missions; Silas's cell stays in dialogue while Matthew's choice line plays (E skips it).

## 1.8.0 "HD Remaster" (2026-10-14)
### Team additions in this release
- **Joe, HD characters (approved by Matthew):** 40 characters redrawn at artScale 2 (288x384 cells, soft alpha): Matthew in all 15 outfits incl. Dark Star Suit and Cinder Hollow Orange, cast, prequel and prison stills (inmates Reed/Dora/Otto/Mina/Bart/Quay, guards Ellis/Ramos, Sgt. Reyes/Officer Okafor, Silas prison + cuffed), portraits, weapons, collectibles; `js/sprites.js` SPRITE_REV 1.8.0-hd returns logical units (HD_CONTRACT.md).
- **Jack, HD enemies:** thugs (5 colours), snatcher, Vera, Foreman + crew, Silas boss and Silas (prequel player) at 2x (`anims_enemies.json`, `*_hd_anim*.png`).
- **City (Joe's city batch):** all 18 street + prison plates and the 4 props at 2x.
### Engine
- Scene backing store 1920x1080 on desktop (logical 960x540 via ctx.scale); the presenter is DPR- and window-size-aware; phones / low power stay 1x.
- main.js draws frames at `dw/dh` with high-quality smoothing for HD art (Joe's patch, reconciled with the prison, NG+ and weather code); outfit picker, Silas suit tint and the prequel boss portrait read logical units.
- world.js: plates may be 1x or 2x (`plateArtScale`); getDepth() divides plate width by artScale, so every walk band (incl. Cinder Hollow) is unchanged; PLATE_FX / sign anchors stay in 1x plate px.
- props.js: `PROP_ART_SCALE = 2` (legacy 1x props still detected and drawn at the right size).
### Kept at 1x (still work through artScale 1)
- See the 1.8.0 report: legacy thug stills/8-pose sheets, `silas_sheet.png`, `portrait_silas.png`, `snatcher.png`, `fx.png`, hearts, `matthew.png`, `matthew_sheet_v2.png`. `silas_cuffed` is a single HD idle still.

## 1.7.0 "Locked Up" (2026-10-14)
### Renamed
- The game is now **Streets of Roanoke** (formerly Star City Drift). Saves, the save keys, the Android app id, the .deb package id and /opt path stay the same, so updates and saves carry over. "Star City" is still Roanoke's nickname in the story.
### Team additions in this release
- **Weather (Kody, PR #20, ported by hand):** Sunny / Night / Rainy (`js/weather.js`) on the title, pause menu, T key, pad View/Create and a touch button; stored in `starCityDrift_weather`; rain ambience. Rainy keeps the 1.6.0 story rain in the campaign; the story blackout applies in every weather; Cinder Hollow's indoor areas keep their own light.
- **New Game+ (Jack):** title "New Game+" after the story is beaten; story resets, unlocks kept; enemy HP/damage +10%/+8% per cycle (max NG+5) through getDifficulty(); NG+ HUD tag. Cinder Hollow and Cinder Hollow Orange stay unlocked across cycles.
- **Rename (Matthew):** Streets of Roanoke (title, manifest, apps, installers); save keys, Android app id, .deb package and /opt path unchanged.
- **iPhone (new):** Capacitor iOS wrapper + GitHub Actions workflow for an unsigned .ipa; IPHONE.txt.
### New ending
- After Silas Boone goes down on Mill Mountain, honest police (Sgt. Dana Reyes, Internal Affairs, and Officer Ben Okafor) arrive with lights in the rain, arrest and cuff him, and walk him down the mountain. Wren stands by.
- New cards: "Sentenced" (*The People v. Silas Boone*, Roanoke Circuit Court, three months later: twenty-five years, Boone Holdings dissolved, debts cancelled) and "Locked Up" (Cinder Hollow Correctional Facility), then the ending.
- Updated ending text, sequel hooks and the credits story.
### New area: Cinder Hollow Correctional Facility (original, fictional)
- Opens in free roam once the campaign is beaten. Route 9 bus stop at the Community Center; bus home in the Visitor Lobby.
- Six walkable areas: Visitor Lobby, Cell Block C (two tiers), Mess Hall, Library, Workshop, The Yard. New painted plates and indoor fluorescent / warm library lighting; no rain indoors. No combat anywhere inside.
- Six original prisoners (Reed "Tags" Malloy, Dora Keene, Otto "Wrench" Pike, Mina Solis, Bart Holley, Quay "Quiet" Dunn) and two guards (Officers Dwayne Ellis and Luis Ramos), each with their own sprite art, idle + talk animations and dialogue tied to the story.
- Silas Boone, Inmate C-14: own prison-blues sprite and a branching conversation (choices by click, 1-5, arrows + E/Enter) that looks back on the story and hints at the prequel.
- Keepsake: "The Evening Paper (last spring)" on the library return cart (+1000 score; not one of the 20 collectibles, completion unchanged).
### New outfit: Cinder Hollow Orange (`cinder`, outfit 15)
- Numbered orange jumpsuit (0417), full art for all 14 Matthew animations. Weapon "Mess Hall Tray", signature move "Chow Line" (knockdown rush with a push). Hotkey % (Shift+5).
- Locked in the picker until the first finished visit to Silas's cell; unlock toast.
### Saves
- Save format unchanged (v4) plus two optional fields: `silasVisited`, `prisonKeepsake` (default false).
- Saves that already beat the campaign get Cinder Hollow on load; saves with `silasVisited` get Cinder Hollow Orange on load (toast).
### Tests
- New `prison170.mjs` (arrest, unlock, areas, NPCs, Silas tree, keepsake, old saves, screenshots) and a Cinder Hollow Orange section in `outfits.mjs`; outfit counts 14 → 15 across the suite.

## 1.6.0 "The Star Goes Dark"
- Story rewrite as a rainy-night mystery; Dark Star Suit; Chromebook (.deb) installer.
