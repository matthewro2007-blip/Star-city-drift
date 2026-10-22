/**
 * 2.0.2: William Burks, Matthew's oldest friend (approved co-op Player 2; here a single-player NPC + 4 side quests).
 * Plan: /workspace/samples/coop/coop_story.md. Art: assets/sprites/william_anim.png (anims.json `william`), portraits `william`.
 * Where he stands moves with the story (williamSpot); side quests use the existing kinds (defend / escort / fetch / spar).
 * `noGold`: outside the 100% / Gold Star count, so completion is unchanged for old saves.
 * No imports, so npcs.js / missions.js can include it without a cycle.
 */
export const WILLIAM_NPC = {
  id: 'william', name: 'William Burks', role: "Matthew's oldest friend",
  voice: { wave: 'triangle', f0: 168, rate: 0.07, len: 0.06, steps: [1, 1.1, 0.95, 1.18], vowels: ['a', 'e', 'o'], fs: 1.04, greet: ['e', 'a'] },
  area: 'diner', x: 860, color: '#4a5f8a',
  lines: [
    "Matty. You look like you haven't slept since Wren went quiet. Neither have I. Sit a sec.",
    "Cops say runaway. I've known Wren since she sold us dandelions for a quarter. She doesn't run.",
    "You go see the people who know things. I'll keep my ears open around the Market. Left side of the street's yours, right side's mine."
  ],
  waitLines: [
    "Go on, Player One. Whatever you're chasing, chase it. I'll be around."
  ],
  activeLines: [
    "Still here. Still your backup. Go."
  ],
  doneLines: [
    "You climbed a mountain in a thunderstorm and knocked out a landlord. I'm never letting you live that down.",
    "Wren's flowers made it, by the way. All of them. Told you I'd water them."
  ]
};

/** Story-dependent spot: where William hangs out when none of his quests pins him somewhere. */
export function williamStageSpot(m, mainComplete) {
  if (mainComplete) return { area: 'gym', x: 620 };          // post-game: Valley Gym, waiting for his rematch
  if (m.main3 && m.main3.done) return null;                  // the finale: he waits at the foot of the mountain (off-screen)
  if (m.main2 && m.main2.done) return { area: 'rails', x: 250 }; // the Rail Yards fence ("I know, I know, stay here.")
  if (m.main1 && m.main1.done) return { area: 'downtown', x: 900 }; // by Wren's empty cart
  return { area: 'diner', x: 860 };                          // outside Dee's, leaning on the lamp post
}

export const WILLIAM_SIDE_MISSIONS = {
  side_william_booth: {
    id: 'side_william_booth', type: 'side', kind: 'defend', area: 'diner', noGold: true, spot: { area: 'diner', x: 860 },
    title: "The Boys' Booth",
    desc: "Help William keep the Foreman's crew away from Dee's front window and the booth you two carved your names into.",
    npc: 'william', done: false, waves: 2, waveLabel: 'Booth defense',
    reward: { score: 1200 },
    offer: [
      ...WILLIAM_NPC.lines,
      "Oh, and heads up. Two of the Foreman's guys have been 'checking on' Dee every night. Gas can, clipboard, the whole act.",
      "They're coming back tonight. Our booth is right behind that window, Matty. The one with M.R. + W.B. carved in the leg. Two rounds. You in?"
    ],
    active: ["Window side! Same as dodgeball in sixth grade. You throw, I yell!"],
    winLines: 'The crew scatters. William checks the booth leg. "M.R. + W.B. Still there. Still crooked." Dee brings two pie slices, one fork.'
  },
  side_william_score: {
    id: 'side_william_score', type: 'side', kind: 'escort', area: 'downtown', dest: 'pages', noGold: true, spot: { area: 'downtown', x: 900 },
    title: 'High Score',
    desc: 'Walk William and the old Starlite Arcade cabinet from Downtown to Valley Pages before Boone Holdings can repossess it.',
    npc: 'william', requires: 'main1', done: false,
    escortName: 'William', escortGoal: 'Walk the cabinet to Valley Pages',
    escortFail: 'William had to ditch the dolly. The cabinet rolls back to the arcade.',
    escortAmbush: 'Repo crew at Valley Pages — keep them off William and the cabinet!',
    reward: { score: 1500 },
    offer: [
      "Matty, the Starlite Arcade owes Boone Holdings. They're 'collecting' the machines tomorrow.",
      "Including STAR RAIDERS. Our cabinet. Our 2009 high score is still on it. M.R.W. Nine hundred and twelve thousand.",
      "Priya said she'll keep it in the back of Valley Pages. I've got a dolly. You've got fists. Walk me there?"
    ],
    active: ["Easy! Easy! That's a seventeen-year-old CRT, Matty!"],
    winLines: 'STAR RAIDERS boots up in the back of Valley Pages. The score is still there: M.R.W. 912,040. William high-fives the screen.'
  },
  side_william_flowers: {
    id: 'side_william_flowers', type: 'side', kind: 'fetch', area: 'downtown', noGold: true, spot: { area: 'downtown', x: 900 },
    title: 'Water the Flowers',
    desc: "Keep Wren's flower cart alive: a watering can from Dee, a rain tarp from Tessa and twine from June.",
    npc: 'william', requires: 'main2', done: false,
    returnTo: 'William', doneLine: "Can, tarp, twine. Look at us. Two grown men running a flower cart. She's gonna laugh so hard.",
    items: [
      { id: 'w_can', npc: 'dee', name: 'Watering Can', line: "My old watering can. You boys keep those flowers alive for her, hear me?" },
      { id: 'w_tarp', npc: 'tessa', name: 'Rain Tarp', line: "Skate-ramp tarp! It's got a few board scuffs. Flowers won't mind." },
      { id: 'w_twine', npc: 'june', name: 'Garden Twine', line: "Garden twine from the community plots. Tie it loose, hon, so the stems can breathe." }
    ],
    reward: { score: 1000 },
    offer: [
      "Somebody's gotta water these. She'd kill us both if they died.",
      "Rain's coming in again. I need a watering can, something to cover the cart, and twine to hold it down.",
      "Dee's got a can, Tessa's got tarps, June's got twine. I'll guard the cart. Go, go."
    ],
    active: ["Can from Dee, tarp from Tessa, twine from June. I'm not leaving the cart."],
    winLines: 'The tarp holds. The zinnias stay dry. William tucks one into his flannel pocket "for when she gets back."'
  },
  side_william_rematch: {
    id: 'side_william_rematch', type: 'side', kind: 'spar', area: 'gym', noGold: true, spot: { area: 'gym', x: 620 },
    title: "Coach's Corner Rematch",
    desc: "Win William's long-awaited rematch at Valley Gym: KO his 5 sparring buddies without getting tagged too often.",
    npc: 'william', requires: 'main4', done: false, target: 5,
    reward: { score: 1500 },
    offer: [
      "Fifteen years, Matty. Fifteen years since you dropped me in Coach's corner and I said 'best of three.'",
      "I brought friends from my league night. Light gloves. Take out all five without getting tagged too much, and I'll finally admit you're better than me.",
      "...At punching. Not at Star Raiders."
    ],
    active: ["Hands up, Player One! Coach is watching!"],
    winLines: 'Coach Ray calls it. William flops on the mat, laughing. "Fine. You win. Best of five?"'
  }
};
