# Star City Drift 1.6.0 Canon Notes: "The Star Goes Dark" + Prequel: Silas Boone

Source of truth: `/workspace/roanoke-open-world-2d/` (`js/npcs.js`, `js/missions.js`, `js/main.js`, `js/dlc_silas.js`).
This file replaces the 1.5.x notes. The old "leftovers swap / missing rare-map shipment" plot is **retired** and no longer canon.
Rating target: Teen. No gore, no profanity. All names, places and music are original to this game.

---

## 1. Main campaign: "The Star Goes Dark"

**Premise.** Roanoke, the night before the city's anniversary. It has rained for six days. Wren Calloway, Matthew Rose's friend and
the City Market flower seller, closes her cart on Jefferson Street and never comes home. The police call her a runaway.

**The truth.** People have been vanishing for months. Every one of them owed money to **Boone Holdings**, Silas Boone's front company
(lending, property, "protection"). Silas is taking Roanoke block by block through threats, fires and staged accidents. Three layers protect him:
1. **Bought patrol cars in the Rail Yards.** Two patrol cars wave Boone trucks through every night.
2. **The Foreman's crew** (Mort "The Foreman" Kessler's work-coat gang) burns downtown shops whose owners won't sell or pay.
3. **Vera Lisk's blackmail ring.** Vera keeps files on anyone who might talk. She forces Cam Ortiz to drive "wrong pins" that scout the next fire.

**Midpoint twist (main3, Hank).** A Boone work order for the Mill Mountain Star: Silas plans to seize the Star and black it out on anniversary
night, a show of who really owns the city. Hank also saw a girl with flowers on her coat in the back of a Boone truck heading up the mountain.

**Finale (main4, Mill Mountain).** Silas waits under the Star (NPC moved from downtown x 700 to `star` x 300 in 1.6.0). Wren is locked in the
switch house. At midnight the Star goes dark and the city lights drop (rain + blackout grade, `storyBlackout()`). Matthew defeats Silas,
breaks the lock, walks Wren out and throws the breaker. The Star comes back on. Silas is led down the mountain in handcuffs by officers who
still answer to the city. Boone Holdings is finished; the missing start coming home.

| Mission | Title | Giver | Beat |
|---|---|---|---|
| main1 | Gone Quiet | Dee Morales | Wren is gone; cops say runaway; she owed Boone Holdings. |
| main2 | The Missing List | Priya Shah | Eleven gone since spring, all Boone debtors. Fires, "accidents". Foreman's crew, Vera's files, the Rail Yards. |
| main3 | Badges in the Rail Yards | Hank "Rail" Pettigrew | Corrupt patrol cars. Twist: blackout plan for the Star; Wren taken up the mountain. |
| main4 | The Star Goes Dark | Silas Boone | Mill Mountain at midnight. Boss fight in the dark. Rescue Wren, relight the Star. |

Side missions keep their structure and rewards; their text ties into the story (Foreman's crew attacks the diner, June shelters burned-out
families, Coach carries medicine past the burned pharmacy, Tessa's video exposes Boone's guys, Hank takes his notes to a state inspector,
Cam breaks free of Vera). Wren is absent from her cart from Dee's news (main1 done) until the finale; Petal Pusher is available before that
and after she is home.

**Rewards.** Every outfit, collectible, save field and difficulty number is unchanged. New in 1.6.0: the **Dark Star Suit** (outfit
`darkstar`), unlocked by beating the campaign (also granted on load to older saves with `mainComplete`). Black and midnight-blue suit with a
cracked, faintly glowing star emblem: the blacked-out Star, worn by the man who relit it. Kit: Dead Star Emblem / **Lights Out** darkness pulse.

**Sequel hooks.** Vera Lisk's files were never found. The "S.B. — 2nd shift" lantern shows how long Boone has been at this. Silas said they'd speak again.

---

## 2. Prequel DLC: "Second Shift" — Silas Boone's villain origin (JACK-STORY rework, DRAFT pending Matthew's approval)

Set in **spring 2015, eleven years before** Wren disappears. None of the main game's events have happened yet, and the prequel does not lead into its opening. Same six missions, moves, bosses, keepsakes and save slot (`starCityDrift_dlc_silas`). Full outline: `/workspace/samples/scenes/prequel_rework.md`.

1. **Polite Introductions** (tweaked). Silas protects Lou's newsstand from the Foreman's boys. Teenage **Matthew Rose** (~16) is caught in it; Silas steps in and learns his name. Lou says folks would *pay* him to keep them safe.
2. **Homework** (tweaked). Silas offers Priya "protection for a small monthly fee" while Matthew does homework at her counter. He keeps the page of the Foreman's collection list, then gives Matthew his first envelope errand ("For not opening it.").
3. **Second Shift** (tweaked). He pays Officer **Bart Holley** and his partner; **Hank Pettigrew** of the day crew refuses the envelope. Gus paints the lantern: "S.B. — 2nd shift".
4. **Signals on the Bridge** (kept). He beats Vera Lisk and recruits her. She drops her bundle of files when she falls; bridge tender **Marcus Hale** quietly takes it (never shown). **Mina Solis**, her courier, can't find it.
5. **The Foreman** (kept). Under the Star he beats Kessler and takes his crew and matches; truck driver **Otto Pike** switches sides. "One day they'll look up and think of me."
6. **Boone Holdings** (rewritten). Pip brings the papers; **Dora Keene** signs on as bookkeeper. Dee names **Rosa Calloway** (Wren's mother) as a Foreman debtor; Silas signs Boone Holdings into being and buys the ledger, Rosa included. Matthew sees Rosa's name, hands back the errand money and quits. Closing villain beat at Lou's corner (Kessler: the Campbell pharmacy won't pay; Silas: "Everyone pays eventually."), the ending card, then **"Eleven years later."**

**Constraints:** Silas knows Matthew from 2015 and calls him "kid"; Matthew is an NPC only in the prequel (grey hoodie, no combat set). Wren's 2026 debt is Rosa's loan, inherited with the cart. Vera's original files are lost from 2015 on.

## 3. Cast quick reference
- **Silas Boone** — Boone Holdings. Courteous, patient, collects debts and secrets. Role label in dialogue: "Boone Holdings" (main), "Second shift" (prequel).
- **Wren Calloway** — flower seller, Matthew's friend, the missing girl. Rescued in the finale.
- **Mort "The Foreman" Kessler** — arson crew boss; Silas's muscle after the prequel.
- **Vera Lisk** — blackmail files; Silas's lieutenant after the prequel.
- **Dee, Priya, Hank, June, Tessa, Coach Ray, Cam** — the neighbors who help Matthew pull the threads.
- **Marcus Hale** (JACK-STORY draft) — River Bridge tender (`river` x 700); side missions only (Lamps Out, Logbook Pages, High Water). Took Vera's files in 2015.

## 4. 1.7.0 "Locked Up": the arrest and Cinder Hollow
- **The arrest (new ending beat).** After Matthew beats Silas on Mill Mountain, two honest Roanoke officers arrive in the rain: **Sgt. Dana Reyes** (Internal Affairs) and **Officer Ben Okafor**. They are not the patrol officers Silas paid off in the prequel. Reyes arrests him for kidnapping, arson, extortion and bribery; Okafor cuffs him (hands behind the back, no force) and walks him down the mountain. Wren is safe and gets a blanket.
- **The trial.** "Roanoke Circuit Court · Three months later": *The People v. Silas Boone*. Twenty-five years. Boone Holdings dissolved; the ledger's debts cancelled. Dora Keene, Boone's bookkeeper, opened the ledger to the court.
- **Cinder Hollow Correctional Facility** (original, fictional; on "Route 9" outside the city). Opens in free roam once the main campaign is beaten (`mainComplete`); the Route 9 bus stop is at the Community Center (x 820), the bus home is in the Visitor Lobby. Areas, left to right: Visitor Lobby → Cell Block C (two tiers) → Mess Hall → Library → Workshop → The Yard. No fighting inside.
- **Staff:** Officer Dwayne Ellis (lobby), Officer Luis Ramos (cell block; turned down Boone money years ago).
- **Inmates (orange jumpsuits, numbered):** Reed "Tags" Malloy 4821 (knew Wren), Dora Keene 5107 (Boone's bookkeeper; ledger), Otto "Wrench" Pike 3390 (drove the Foreman's tool truck; builds June's birdhouses), Mina Solis 6214 (Vera Lisk's courier; Vera's files still missing), Bart Holley 1188 (one of the patrolmen Silas paid in the prequel; Hank's notes put him away), Quay "Quiet" Dunn 0904.
- **Silas, Inmate C-14** wears navy prison blues (not orange). Branching talk: why he did it, Wren, Vera, regret, and (if Matthew found it) the evening paper from spring 2015. He never apologizes outright; he hints at the prequel (Lou's newsstand, the night he learned people would pay to feel safe).
- **Keepsake:** "The Evening Paper (spring 2015)" on the library return cart: Silas running off rent collectors at Lou Badger's newsstand. Not one of the 20 collectibles (completion counts unchanged).
- **Reward:** the first finished visit to C-14 unlocks the outfit **Cinder Hollow Orange** (Matthew in a numbered orange jumpsuit, 0417; kit "Mess Hall Tray" / "Chow Line"). Matthew is a visitor; the outfit is a costume nod, not canon incarceration.
