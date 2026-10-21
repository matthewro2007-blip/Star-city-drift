/**
 * Barks (Bob): roaming reactive one-liners. Line data + trigger engine + cooldowns.
 * Data shape: BARKS[charId][trigger] = [{ id, text, audio?, cond? }].
 * Text only for now: VO_ENABLED = false (see the voice-over block); no line has an `audio` field.
 * Events are polled from game state each frame (no edits to combat/missions/weather).
 */
import { getWeather } from './weather.js';
import { drawBarkBubble, showSubtitle, hideSubtitle } from './bark_ui.js';
import * as scenePlayer from './scene_player.js'; // namespace import: a missing isScenePlaying export can't throw
const scenePlaying = () => { try { return typeof scenePlayer.isScenePlaying === 'function' && !!scenePlayer.isScenePlaying(); } catch { return false; } };
import { play as voPlay, isPlaying as voBusy } from './vo.js'; // VO-HOOK: bark voice clips via js/vo.js

const done = (id) => (s) => s.done(id);

export const BARKS = {
  // ---------------- friendly (main campaign) ----------------
  dee: {
    greet: [
      { id: 'dee_g1', text: "Morning, Matthew! Coffee's hot and the grill's hotter." },
      { id: 'dee_g2', text: "There's my favorite regular. Booth's open, hon." },
      { id: 'dee_g3', text: "Matthew! You eat today? Don't lie to me." }],
    idle_near: [
      { id: 'dee_i1', text: "Order up! ...Oh, that's just me talking to myself." },
      { id: 'dee_i2', text: "Wren used to bring me zinnias for the counter." }],
    farewell: [
      { id: 'dee_f1', text: "Go on, hon. Be careful out there." },
      { id: 'dee_f2', text: "Don't be a stranger, Matthew." }],
    outfit: [
      { id: 'dee_o1', text: "Ooh, new threads? Very downtown chic." },
      { id: 'dee_o2', text: "Look at you! Spin around, let me see." },
      { id: 'dee_o3', text: "Is that... a Boone suit? Take that off my floor.", cond: (s) => s.outfit === 'silas' }],
    story: [
      { id: 'dee_s1', text: "Priya keeps the list. Valley Pages, hon. Go.", cond: (s) => s.done('main1') && !s.done('main2') },
      { id: 'dee_s2', text: "Heard you ran those boys off Campbell Ave. Thank you.", cond: done('side_diner') },
      { id: 'dee_s3', text: "The Star's back on. And Wren's home. Pie's free.", cond: (s) => s.mainComplete }],
    weather: [{ id: 'dee_w1', text: "Rain again? Come in before you drip on my floor." }],
    witness_fight: [{ id: 'dee_x1', text: "Not in front of my diner! ...Nice hook, though." }],
    low_hp: [{ id: 'dee_l1', text: "You look rough, hon. Sit down, I'll fix you a plate." }]
  },
  priya: {
    greet: [
      { id: 'pri_g1', text: "Matthew. Close the door behind you, please." },
      { id: 'pri_g2', text: "Back already? I flagged three more names." },
      { id: 'pri_g3', text: "Quiet voice, please. The walls have Boone ears." }],
    idle_near: [
      { id: 'pri_i1', text: "Eleven names. I keep counting like it'll change." },
      { id: 'pri_i2', text: "Shelving mysteries. Feels a little on the nose." }],
    farewell: [
      { id: 'pri_f1', text: "Watch the corners. Write down what you see." },
      { id: 'pri_f2', text: "Go. And don't trust a badge tonight." }],
    outfit: [
      { id: 'pri_o1', text: "New look? Good. Harder to recognize." },
      { id: 'pri_o2', text: "That jacket has a whole backstory, I can tell." },
      { id: 'pri_o3', text: "A Boone suit. That's... a choice, Matthew.", cond: (s) => s.outfit === 'silas' }],
    story: [
      { id: 'pri_s1', text: "Hank at the Rail Yards. He sees every truck.", cond: done('main2') },
      { id: 'pri_s2', text: "Names are coming off my list. One by one.", cond: (s) => s.mainComplete }],
    weather: [{ id: 'pri_w1', text: "Rain's good for business. Nobody wants to leave." }],
    witness_fight: [{ id: 'pri_x1', text: "I'm writing that down. All of it." }],
    low_hp: [{ id: 'pri_l1', text: "You're bleeding on the poetry section. Sit." }]
  },
  hank: {
    greet: [
      { id: 'hnk_g1', text: "Evening, kid. Mind the third rail." },
      { id: 'hnk_g2', text: "You again. Good. I like company that listens." },
      { id: 'hnk_g3', text: "Kid. Keep your voice down near the yard." }],
    idle_near: [
      { id: 'hnk_i1', text: "Forty years on these tracks. Never seen it this bad." },
      { id: 'hnk_i2', text: "Hear that? Boone truck. Right on schedule." }],
    farewell: [
      { id: 'hnk_f1', text: "Go on. Stay off the main road." },
      { id: 'hnk_f2', text: "Watch for the patrol cars, kid." }],
    outfit: [
      { id: 'hnk_o1', text: "New coat? Good. Nights get cold up here." },
      { id: 'hnk_o2', text: "Ha. You look like a brakeman's nephew." },
      { id: 'hnk_o3', text: "Boone's suit? Kid, they'll shoot first.", cond: (s) => s.outfit === 'silas' }],
    story: [
      { id: 'hnk_s1', text: "Midnight, kid. The Star. Don't be late.", cond: (s) => s.done('main3') && !s.mainComplete },
      { id: 'hnk_s2', text: "State inspector's got my notes now.", cond: done('side_night') },
      { id: 'hnk_s3', text: "Star's lit. Best thing I've seen in years.", cond: (s) => s.mainComplete }],
    weather: [{ id: 'hnk_w1', text: "Six days of rain. Rails get slick, kid." }],
    witness_fight: [{ id: 'hnk_x1', text: "Hah! Like the old days at the roundhouse." }],
    low_hp: [{ id: 'hnk_l1', text: "You're limping, kid. Sit on that crate a spell." }]
  },
  june: {
    greet: [
      { id: 'jun_g1', text: "Matthew! Come in, there's soup on." },
      { id: 'jun_g2', text: "Oh good, a friendly face. We need those." },
      { id: 'jun_g3', text: "Hey you. Door's always open here." }],
    idle_near: [
      { id: 'jun_i1', text: "Forty cots, thirty-eight blankets. I'll figure it out." },
      { id: 'jun_i2', text: "Soft landings matter. I keep telling folks that." }],
    farewell: [
      { id: 'jun_f1', text: "Come back if the city feels too dark." },
      { id: 'jun_f2', text: "Take care of yourself, okay?" }],
    outfit: [
      { id: 'jun_o1', text: "Love the new look! Very you." },
      { id: 'jun_o2', text: "Ooh, fancy. Want to model for the flyers?" },
      { id: 'jun_o3', text: "That suit makes the kids nervous, Matthew.", cond: (s) => s.outfit === 'silas' }],
    story: [
      { id: 'jun_s1', text: "Thanks for the cots. Folks slept well.", cond: done('side_june') },
      { id: 'jun_s2', text: "The potluck saved us. Truly.", cond: done('side_potluck') },
      { id: 'jun_s3', text: "People are going home, Matthew. Home!", cond: (s) => s.mainComplete }],
    weather: [{ id: 'jun_w1', text: "Rain again. Grab a towel by the door." }],
    witness_fight: [{ id: 'jun_x1', text: "Everyone okay? Nobody's hurt? Okay. Breathe." }],
    low_hp: [{ id: 'jun_l1', text: "Sit down. First aid kit's right here." }]
  },
  tessa: {
    greet: [
      { id: 'tes_g1', text: "Yo, Matthew! Watch this kickflip. ...Okay, almost." },
      { id: 'tes_g2', text: "Sup. Shop's dead but the vibes are alive." },
      { id: 'tes_g3', text: "Ayy, it's the guy! Wait, I forgot your name." }],
    idle_near: [
      { id: 'tes_i1', text: "I could ollie that rail. I just choose not to." },
      { id: 'tes_i2', text: "Bearings need oil. Like, a lot of oil." }],
    farewell: [
      { id: 'tes_f1', text: "Later! Stay rad. Or whatever." },
      { id: 'tes_f2', text: "Peace. Don't trip on a curb." }],
    outfit: [
      { id: 'tes_o1', text: "Okay, that fit goes hard." },
      { id: 'tes_o2', text: "Thrifted? Respect. Total respect." },
      { id: 'tes_o3', text: "Dude. You look like a supervillain. Sick.", cond: (s) => s.outfit === 'silas' }],
    story: [
      { id: 'tes_s1', text: "My video's got like ten thousand views. Boone's done.", cond: done('side_skate') },
      { id: 'tes_s2', text: "You found the gear! Told you it was out there.", cond: done('side_tessa') }],
    weather: [{ id: 'tes_w1', text: "Rain ruins grip tape. Rain ruins everything." }],
    witness_fight: [{ id: 'tes_x1', text: "Yo! I should've filmed that!" }],
    low_hp: [{ id: 'tes_l1', text: "Bro, you look like you ate the pavement." }]
  },
  coach: {
    greet: [
      { id: 'coa_g1', text: "Matthew! Shoulders back, chin up!" },
      { id: 'coa_g2', text: "There he is. You stretching? Stretch." },
      { id: 'coa_g3', text: "Good to see you moving, kid." }],
    idle_near: [
      { id: 'coa_i1', text: "Twenty more. Come on. ...I'm talking to myself." },
      { id: 'coa_i2', text: "Hydrate. I don't care who you are. Hydrate." }],
    farewell: [
      { id: 'coa_f1', text: "Keep your feet moving!" },
      { id: 'coa_f2', text: "Go get 'em. Hands up, always." }],
    outfit: [
      { id: 'coa_o1', text: "New gear? Looks fast. Prove it." },
      { id: 'coa_o2', text: "Nice. Can you throw a hook in that?" },
      { id: 'coa_o3', text: "A suit's no good in a clinch, kid.", cond: (s) => s.outfit === 'silas' }],
    story: [
      { id: 'coa_s1', text: "Medicine made it. Knew you had hustle.", cond: done('side_coach') },
      { id: 'coa_s2', text: "Good spar. You drop that left hand, though.", cond: done('side_spar') }],
    weather: [{ id: 'coa_w1', text: "Rain's just free cardio. Keep going." }],
    witness_fight: [{ id: 'coa_x1', text: "Good footwork! Now finish strong!" }],
    low_hp: [{ id: 'coa_l1', text: "You're gassed. Breathe in through the nose." }]
  },
  cam: {
    greet: [
      { id: 'cam_g1', text: "Need a lift? Kidding. My car's a crime scene." },
      { id: 'cam_g2', text: "Hey, Matthew. Phone hasn't buzzed in an hour." },
      { id: 'cam_g3', text: "Oh, it's you. Good. I thought it was Vera." }],
    idle_near: [
      { id: 'cam_i1', text: "Four-point-nine stars. Ruined by one bad pin." },
      { id: 'cam_i2', text: "I keep checking the mirror. Habit now." }],
    farewell: [
      { id: 'cam_f1', text: "Stay safe. Don't take any wrong pins." },
      { id: 'cam_f2', text: "Later. Tell the right people, okay?" }],
    outfit: [
      { id: 'cam_o1', text: "New look? You'd get five stars in that." },
      { id: 'cam_o2', text: "Nice threads. Very rideshare-ready." },
      { id: 'cam_o3', text: "Is that Boone's suit? Please don't.", cond: (s) => s.outfit === 'silas' }],
    story: [
      { id: 'cam_s1', text: "I'm out. No more pins. Thanks to you.", cond: done('side_cam') },
      { id: 'cam_s2', text: "Vera's phone went quiet. Best sound ever.", cond: (s) => s.mainComplete }],
    weather: [{ id: 'cam_w1', text: "Surge pricing in the rain. Not tonight." }],
    witness_fight: [{ id: 'cam_x1', text: "Okay. I did not see that. Or I did. Wow." }],
    low_hp: [{ id: 'cam_l1', text: "Want me to drive you to urgent care?" }]
  },
  wren: {
    greet: [
      { id: 'wre_g1', text: "Matthew! Zinnias, two for five. For you, free." },
      { id: 'wre_g2', text: "Hi! Smell these. No, really, smell them." },
      { id: 'wre_g3', text: "There's my good egg." }],
    idle_near: [
      { id: 'wre_i1', text: "Marigolds for luck. Daisies for no reason." },
      { id: 'wre_i2', text: "The market smells like rain and petals." }],
    farewell: [
      { id: 'wre_f1', text: "Bye! Come back before I close." },
      { id: 'wre_f2', text: "Take a flower for the road!" }],
    outfit: [
      { id: 'wre_o1', text: "Ooh! That color needs a carnation." },
      { id: 'wre_o2', text: "You clean up nice, Matthew." },
      { id: 'wre_o3', text: "That suit. Matthew, I've seen it up close.", cond: (s) => s.outfit === 'silas' }],
    story: [
      { id: 'wre_s1', text: "You came up the mountain for me. I won't forget.", cond: (s) => s.mainComplete },
      { id: 'wre_s2', text: "My purse is back! Petals and all.", cond: done('side_snatch') }],
    weather: [{ id: 'wre_w1', text: "Rain's good for the flowers. Bad for my hair." }],
    witness_fight: [{ id: 'wre_x1', text: "Matthew! Are you okay? Who were they?" }],
    low_hp: [{ id: 'wre_l1', text: "You're hurt! Here, sit by the cart." }]
  },
  marcus: { // Marcus Hale, River Bridge tender (main game: unmasked side-mission NPC, id 'marcus' from js/marcus.js)
    greet: [
      { id: 'mar_g1', text: "Evening. Mind the grate, it bites ankles." },
      { id: 'mar_g2', text: "Matthew Rose. Crossed at 9:14 last Tuesday." },
      { id: 'mar_g3', text: "You again. I'll put you down as a regular." }],
    idle_near: [
      { id: 'mar_i1', text: "Lamp glass won't polish itself. Mostly." },
      { id: 'mar_i2', text: "Near thirty years on this bridge. Still squeaks." }],
    farewell: [
      { id: 'mar_f1', text: "Go on. I'll log you out." },
      { id: 'mar_f2', text: "Watch the river side. Railing's loose." }],
    outfit: [
      { id: 'mar_o1', text: "New jacket. Noted. Everything gets noted." },
      { id: 'mar_o2', text: "That suit. I've seen it cross before. Long ago.", cond: (s) => s.outfit === 'silas' }],
    story: [
      { id: 'mar_s1', text: "Coach's medicine made it across. Good work.", cond: done('side_coach') },
      { id: 'mar_s2', text: "Star's lit again. Bridge looks better for it.", cond: (s) => s.mainComplete },
      { id: 'mar_s3', text: "Lamps held all night. First time this month.", cond: done('side_marcus_lamps') },
      { id: 'mar_s4', text: "My pages, back in order. Thank you, Matthew.", cond: done('side_marcus_pages') },
      { id: 'mar_s5', text: "Water's down. The bridge owes you one.", cond: done('side_marcus_water') }],
    weather: [{ id: 'mar_w1', text: "River's high. Six days of rain does that." }],
    witness_fight: [{ id: 'mar_x1', text: "That's going in the book. Both sides." }],
    low_hp: [{ id: 'mar_l1', text: "Sit on the bollard a minute. Breathe." }]
  },
  silas: { // the pre-fight NPC under the Star
    greet: [
      { id: 'sln_g1', text: "Evening, son. Kind of you to come all this way." },
      { id: 'sln_g2', text: "Matthew Rose. Your mama know you're out?" },
      { id: 'sln_g3', text: "Come closer. I don't bite. Not first." }],
    idle_near: [
      { id: 'sln_i1', text: "Pretty view. Shame about the lights." },
      { id: 'sln_i2', text: "Midnight's coming, son. It always does." }],
    farewell: [{ id: 'sln_f1', text: "Run along. The mountain will wait." }],
    outfit: [
      { id: 'sln_o1', text: "Dressed up for me? I'm touched." },
      { id: 'sln_o2', text: "My suit. Fits you poorly, son.", cond: (s) => s.outfit === 'silas' }],
    weather: [{ id: 'sln_w1', text: "Six days of rain. Washes a town clean." }],
    low_hp: [{ id: 'sln_l1', text: "Bruised already? We haven't begun." }]
  },

  // ---------------- friendly (prequel) ----------------
  dlc_dee: { greet: [{ id: 'dd_g1', text: "Mr. Boone. Coffee's... on the house, I guess." }, { id: 'dd_g2', text: "Back again? I paid this month." }], farewell: [{ id: 'dd_f1', text: "Have a good night, Mr. Boone." }] },
  dlc_priya: { greet: [{ id: 'dp_g1', text: "We're closing. ...For you, I suppose not." }, { id: 'dp_g2', text: "Mr. Boone. Looking for anything in particular?" }], farewell: [{ id: 'dp_f1', text: "Mind the step on your way out." }] },
  dlc_cam: { greet: [{ id: 'dc_g1', text: "Uh, hi. I'm off the clock. Really." }, { id: 'dc_g2', text: "Need a ride? I mean... no charge." }], farewell: [{ id: 'dc_f1', text: "Okay. Bye. Drive safe. I mean, walk safe." }] },
  dlc_marcus: { // 2015 prequel, younger Marcus (not in dlc_silas.js yet; would match an NPC with id 'marcus')
    greet: [{ id: 'dm_g1', text: "Bridge closes at two. Sir." }, { id: 'dm_g2', text: "Evening, Mr. Boone. Nice night for a walk." }],
    farewell: [{ id: 'dm_f1', text: "Safe crossing. I'll write you down." }],
    witness_fight: [{ id: 'dm_x1', text: "...I didn't see anything. Officially." }]
  },
  lou: { greet: [{ id: 'lou_g1', text: "Evening edition, Silas. Read all about you." }, { id: 'lou_g2', text: "Papers are wet, coffee's cold. Welcome." }], farewell: [{ id: 'lou_f1', text: "Watch the docks tonight, Silas." }], witness_fight: [{ id: 'lou_x1', text: "That'll make the morning paper." }] },
  ivy: { greet: [{ id: 'ivy_g1', text: "Boone! I got your envelope. Mostly dry." }, { id: 'ivy_g2', text: "Make it quick, I'm double-parked. On a bike." }], farewell: [{ id: 'ivy_f1', text: "Later! I'm gone in sixty seconds." }] },
  gus: { greet: [{ id: 'gus_g1', text: "Mr. Boone. Ledger's right where you left it." }, { id: 'gus_g2', text: "Night shift. Just me and the forklifts." }], farewell: [{ id: 'gus_f1', text: "I didn't see you. Never do." }] },
  pip: { greet: [{ id: 'pip_g1', text: "Mister Boone! Got a job for me?" }, { id: 'pip_g2', text: "I ran the whole way. Twice!" }], farewell: [{ id: 'pip_f1', text: "Bye! I'll be fast, I promise!" }], witness_fight: [{ id: 'pip_x1', text: "Whoa! Teach me that!" }] },

  // ---------------- thugs (pools shared per colour / voice) ----------------
  thug_slick: {
    spot: [{ id: 'ts_sp1', text: "Hey! You're on the wrong block, pal." }, { id: 'ts_sp2', text: "Well, well. Look who's lost." }],
    taunt: [{ id: 'ts_t1', text: "C'mon, hero. That all you got?" }, { id: 'ts_t2', text: "Nice shirt. Shame about the face." }],
    hurt: [{ id: 'ts_h1', text: "Ow! Lucky shot!" }, { id: 'ts_h2', text: "Hey! Not the jacket!" }],
    knocked_down: [{ id: 'ts_k1', text: "Ugh... stay down, stay down..." }, { id: 'ts_k2', text: "I'm good. Just resting. On the street." }],
    kill_ko: [{ id: 'ts_ko1', text: "He dropped Benny! Get him!" }, { id: 'ts_ko2', text: "Okay, that one's on you, pal." }],
    last_one: [{ id: 'ts_l1', text: "Forget this, I ain't paid enough!" }, { id: 'ts_l2', text: "Where'd everybody go?!" }]
  },
  thug_hot: {
    spot: [{ id: 'th_sp1', text: "That's him! Boone wants him gone!" }, { id: 'th_sp2', text: "Oi! You! Hold it right there!" }],
    taunt: [{ id: 'th_t1', text: "I'm gonna fold you like a lawn chair!" }, { id: 'th_t2', text: "Swing all you want. I'm still here!" }],
    hurt: [{ id: 'th_h1', text: "Argh! That stung!" }, { id: 'th_h2', text: "You'll pay for that one!" }],
    knocked_down: [{ id: 'th_k1', text: "Cheap shot! Totally cheap!" }, { id: 'th_k2', text: "Gimme a second... the sky's spinning." }],
    kill_ko: [{ id: 'th_ko1', text: "Get up, man! Get up!" }, { id: 'th_ko2', text: "Oh, now I'm mad!" }],
    last_one: [{ id: 'th_l1', text: "I'm telling the Foreman!" }, { id: 'th_l2', text: "You got lucky! Real lucky!" }]
  },
  thug_grunt: {
    spot: [{ id: 'tg_sp1', text: "Hm. Fresh meat." }, { id: 'tg_sp2', text: "Boss said nobody walks through here." }],
    taunt: [{ id: 'tg_t1', text: "You hit like my grandma. She hits hard." }, { id: 'tg_t2', text: "Big talk. Small punches." }],
    hurt: [{ id: 'tg_h1', text: "Oof." }, { id: 'tg_h2', text: "Huh. Felt that." }],
    knocked_down: [{ id: 'tg_k1', text: "...ow." }, { id: 'tg_k2', text: "I'll just... lie here." }],
    kill_ko: [{ id: 'tg_ko1', text: "Man down. Great." }, { id: 'tg_ko2', text: "That was my ride home." }],
    last_one: [{ id: 'tg_l1', text: "Nope. I'm going home." }, { id: 'tg_l2', text: "Not worth it. Not for this pay." }]
  },
  crew: { // prequel: the Foreman's work-coat crew vs Silas
    spot: [{ id: 'cr_sp1', text: "It's Boone! Foreman said he'd come." }, { id: 'cr_sp2', text: "Fancy suit. Wrong yard, old man." }],
    taunt: [{ id: 'cr_t1', text: "Your money's no good here, Boone." }, { id: 'cr_t2', text: "The Foreman runs these docks now!" }],
    hurt: [{ id: 'cr_h1', text: "Ow! He fights dirty!" }, { id: 'cr_h2', text: "Whoa, the old man's got hands!" }],
    knocked_down: [{ id: 'cr_k1', text: "My back... my whole back..." }, { id: 'cr_k2', text: "Somebody blow the whistle..." }],
    kill_ko: [{ id: 'cr_ko1', text: "He took out Dale! Swarm him!" }, { id: 'cr_ko2', text: "Hey, careful! That's our guy!" }],
    last_one: [{ id: 'cr_l1', text: "Union break! I'm on break!" }, { id: 'cr_l2', text: "Tell the Foreman I tried!" }]
  },

  // 2.0.1 Blackriver (2028): Cinder Hollow correctional officers (all pr_* areas) + the Lockkeeper's people outside the walls
  co_guard: {
    spot: [{ id: 'co_sp1', text: "C-14's out of his cell! Lock it down!" }, { id: 'co_sp2', text: "Boone! On the floor, hands where I can see 'em!" }, { id: 'co_sp3', text: "Control, we've got a runner in Block C!" }],
    taunt: [{ id: 'co_t1', text: "Two years in, Boone. You want ten more?" }, { id: 'co_t2', text: "Nobody walks out of Cinder Hollow. Nobody." }, { id: 'co_t3', text: "Nice jumpsuit. Orange is your color." }],
    hurt: [{ id: 'co_h1', text: "Ow! Old man still swings!" }, { id: 'co_h2', text: "That's assault on an officer, Boone!" }],
    knocked_down: [{ id: 'co_k1', text: "Officer down... it's me, I'm the officer..." }, { id: 'co_k2', text: "Somebody hit the alarm..." }],
    kill_ko: [{ id: 'co_ko1', text: "He dropped Delaney! Call it in!" }, { id: 'co_ko2', text: "Man down in Block C! Send backup!" }],
    last_one: [{ id: 'co_l1', text: "I'm not paid enough for this. I'm calling Control." }, { id: 'co_l2', text: "Fine, run! The dogs'll find you by morning." }]
  },
  lk_crew: {
    spot: [{ id: 'lk_sp1', text: "That's him. Boone. The one the Lockkeeper's been asking about." }, { id: 'lk_sp2', text: "Escaped con in a red suit. Can't miss him." }],
    taunt: [{ id: 'lk_t1', text: "Every door in this city has a key. He's got all of 'em." }, { id: 'lk_t2', text: "You were the big man once, Boone. That was 2026." }],
    hurt: [{ id: 'lk_h1', text: "Ow! Somebody tell Voss!" }, { id: 'lk_h2', text: "He's faster than he looks!" }],
    knocked_down: [{ id: 'lk_k1', text: "Nobody said he could still fight..." }],
    kill_ko: [{ id: 'lk_ko1', text: "He got Teddy! Close in!" }],
    last_one: [{ id: 'lk_l1', text: "Forget this. The Lockkeeper can collect him himself." }, { id: 'lk_l2', text: "I'm out. Tell Voss I quit." }]
  },

  // ---------------- bosses ----------------
  silas_boss: {
    intro: [{ id: 'sb_in1', text: "Evening, son. Let's settle this like gentlemen." }, { id: 'sb_in2', text: "You climbed a mountain to lose. Admirable." }],
    taunt: [
      { id: 'sb_t1', text: "Manners, Matthew. Your mama raised you better." },
      { id: 'sb_t2', text: "I own this city. You're renting a sidewalk." },
      { id: 'sb_t3', text: "Swing again. I'll wait." }],
    phase: [{ id: 'sb_p1', text: "Well now. You do have some fight in you." }, { id: 'sb_p2', text: "Enough playing. Lights out, son." }],
    hurt: [{ id: 'sb_h1', text: "Hm. Not bad." }, { id: 'sb_h2', text: "That'll cost you." }],
    player_low_hp: [{ id: 'sb_l1', text: "Rest a spell. This town was mine long before you." }],
    defeat: [{ id: 'sb_d1', text: "Fine work... but Roanoke always remembers." }, { id: 'sb_d2', text: "Well. Someone pass me my hat." }]
  },
  voss: {
    intro: [{ id: 'vo_in1', text: "Silas Boone. They told me you'd be shorter." }, { id: 'vo_in2', text: "Every lock clicks open eventually, old man. So do you." }],
    taunt: [{ id: 'vo_t1', text: "I'm a tumbler, Boone. I turn. I always turn." }, { id: 'vo_t2', text: "The Lockkeeper says hello. That's the polite part." }, { id: 'vo_t3', text: "Out two days and already you're bleeding money." }],
    phase: [{ id: 'vo_p1', text: "Okay. Gloves off. Keys out." }],
    hurt: [{ id: 'vo_h1', text: "Hey! That's my good scarf!" }],
    player_low_hp: [{ id: 'vo_l1', text: "Stay down. Go back to your cell where it's warm." }],
    defeat: [{ id: 'vo_d1', text: "You won't find him. He finds you." }, { id: 'vo_d2', text: "Fine... fine. The rail yard. Midnight. He'll be waiting." }]
  },
  lockkeeper: {
    intro: [{ id: 'lk_in1', text: "You never did lock your doors, Silas." }, { id: 'lk_in2', text: "Every key in Star City passes through my hands." }],
    taunt: [{ id: 'lk_bt1', text: "You built this city's locks. I built the keys." }, { id: 'lk_bt2', text: "Two years is a long time to think. Did you learn anything?" }],
    phase: [{ id: 'lk_bp1', text: "Enough. Let's see what's under the suit." }],
    hurt: [{ id: 'lk_bh1', text: "Hm. Still sharp." }],
    defeat: [{ id: 'lk_bd1', text: "Take the ring. You'll still need the door." }]
  },
  vera: {
    intro: [{ id: 've_in1', text: "Silas. I have a file on you, too." }, { id: 've_in2', text: "You want the lamp? Come and take it." }],
    taunt: [
      { id: 've_t1', text: "Everyone talks eventually. Even you." },
      { id: 've_t2', text: "I keep photos. You're not photogenic." },
      { id: 've_t3', text: "Careful. I bruise, then I remember." }],
    phase: [{ id: 've_p1', text: "Fine. No more polite blackmail." }, { id: 've_p2', text: "You just made my list, Boone." }],
    hurt: [{ id: 've_h1', text: "My blazer!" }, { id: 've_h2', text: "That's going in the file." }],
    player_low_hp: [{ id: 've_l1', text: "Tired, Silas? Sit. Let's talk terms." }],
    defeat: [{ id: 've_d1', text: "Keep the lamp. I kept copies." }, { id: 've_d2', text: "This isn't over. It's archived." }]
  },
  foreman: {
    intro: [{ id: 'fo_in1', text: "Whistle's blown, Boone. Shift's over." }, { id: 'fo_in2', text: "My yard. My rules. My crew." }],
    taunt: [
      { id: 'fo_t1', text: "I've lifted girders heavier than you." },
      { id: 'fo_t2', text: "Hard hats on, boys. Boone's here." },
      { id: 'fo_t3', text: "Fancy shoes don't grip on oil, Boone." }],
    phase: [{ id: 'fo_p1', text: "Overtime it is, then!" }, { id: 'fo_p2', text: "Now you've made me sweat." }],
    hurt: [{ id: 'fo_h1', text: "Grr! Lucky swing!" }, { id: 'fo_h2', text: "That all you got, suit?" }],
    player_low_hp: [{ id: 'fo_l1', text: "You're done, old man. Clock out." }],
    defeat: [{ id: 'fo_d1', text: "Fine... the yard's yours... for now." }, { id: 'fo_d2', text: "Somebody... call... the union..." }]
  }
};

// 2.0.1: guard variants = the shared C.O. pool + one or two lines of their own
{
  const base = BARKS.co_guard, shared = (t) => (base[t] || []).map((l) => ({ ...l, vo: 'co_guard' }));
  const variant = (extra) => { const o = {}; for (const t of Object.keys(base)) o[t] = shared(t); for (const [t, ls] of Object.entries(extra)) o[t] = [...(o[t] || []), ...ls]; return o; };
  BARKS.co_guard_riot = variant({ spot: [{ id: 'co_rt1', text: 'Shields up! Push him back to his cell!' }] });
  BARKS.co_guard_baton = variant({ taunt: [{ id: 'co_bt1', text: 'Lights out was an hour ago, Boone.' }] });
  BARKS.co_guard_sgt = variant({ spot: [{ id: 'co_sg1', text: 'All units, Block C! C-14 is loose! Nobody gets past the yard gate!' }], last_one: [{ id: 'co_sg2', text: "Seal the yard. He's not getting over that wall." }] });
}

// ---------------- settings ----------------
export const SETTINGS_KEY = 'sor_barks_settings';
const DEF = { style: 'both', size: 'normal', chatter: 'normal' };
const STYLE_ORDER = ['both', 'bubbles', 'subs', 'off'];
const STYLE_NAME = { both: 'Both', bubbles: 'Bubbles', subs: 'Subtitles', off: 'Off' };
const SIZE_ORDER = ['normal', 'large'];
const CHAT_ORDER = ['normal', 'low', 'off'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const settings = (() => {
  try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return { ...DEF, ...s }; } catch { return { ...DEF }; }
})();
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode */ } }
export function setBarkSetting(k, v) { settings[k] = v; saveSettings(); syncSettingsUi(); if (settings.style === 'off' || settings.chatter === 'off') stop(); }
function syncSettingsUi() {
  const set = (id, t) => { const b = document.getElementById(id); if (b && b.textContent !== t) b.textContent = t; };
  set('btn-barks-style', `Barks: ${STYLE_NAME[settings.style]} ▸`);
  set('btn-barks-size', `Bark text: ${cap(settings.size)} ▸`);
  set('btn-barks-chatter', `Chatter: ${cap(settings.chatter)} ▸`);
}
const nextOf = (arr, v) => arr[(arr.indexOf(v) + 1) % arr.length];
function bindSettingsUi() {
  const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', fn); };
  bind('btn-barks-style', () => setBarkSetting('style', nextOf(STYLE_ORDER, settings.style)));
  bind('btn-barks-size', () => setBarkSetting('size', nextOf(SIZE_ORDER, settings.size)));
  bind('btn-barks-chatter', () => setBarkSetting('chatter', nextOf(CHAT_ORDER, settings.chatter)));
  syncSettingsUi();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindSettingsUi); else bindSettingsUi();
}

// ---------------- audio (optional per line) ----------------
/**
 * Voice-over. OFF until Matthew approves the voices. When on, Kody's assets/vo/manifest.json is
 * fetched once; a line plays only if its lineId is in the manifest (or the line has an `audio` field).
 * Manifest shape (VOICE_PIPELINE_PLAN.md §5: "vo -> hash, duration"); all of these are accepted:
 *   { "<lineId>": { "hash": "...", "duration": 2.1, "file"?: "dee/dee_g1", "char"?: "dee" } }
 *   { "clips": { ...same... } }   or   { "<lineId>": "dee/dee_g1" }
 * `file` / string values are paths under assets/vo/ without extension; default is <charId>/<lineId>.
 * Plays .ogg, falls back to .m4a (iPhone Safari), then silently stays text only.
 */
export const VO_ENABLED = true; // VO-HOOK: Matthew approved local integration (2026-10-15)
let vo = null, voManifest = null, voLoading = null;
function loadManifest() {
  if (voManifest || voLoading || typeof fetch !== 'function') return;
  voLoading = fetch('assets/vo/manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => { voManifest = (j && j.clips) || j || {}; })
    .catch(() => { voManifest = {}; });
}
function voBase(charId, line) {
  if (typeof line.audio === 'string') return `assets/vo/${line.audio}`;
  const m = voManifest && voManifest[line.id];
  if (!m && !line.audio) return null;
  const f = typeof m === 'string' ? m : (m && (m.file || m.path));
  if (f) return `assets/vo/${String(f).replace(/\.(ogg|m4a)$/i, '')}`;
  return `assets/vo/${(m && m.char) || charId}/${line.id}`;
}
function playAudio(charId, line) {
  if (!VO_ENABLED) return;
  // VO-HOOK: manifest id = bark.<charId>.<line.id>; never talks over a dialogue/scene line; missing clip = silent, bubble/subtitle still shows
  if (voBusy()) return;
  voPlay(`bark.${line.vo || charId}.${line.id}`); // 2.0.1: variant pools reuse co_guard clips (line.vo)
}
// VO-HOOK: js/vo.js loads assets/vo/manifest.json on first use (Bob's loadManifest/voBase above are unused now)

// ---------------- engine ----------------
const PRI = { story: 3, intro: 3, phase: 3, defeat: 3, player_low_hp: 3, greet: 2, outfit: 2, farewell: 1, idle_near: 1, weather: 1, witness_fight: 1, low_hp: 2,
  spot: 1, taunt: 1, hurt: 1, knocked_down: 1, kill_ko: 1, last_one: 1 };
const COMBAT = new Set(['spot', 'taunt', 'hurt', 'knocked_down', 'kill_ko', 'last_one', 'intro', 'phase', 'defeat', 'player_low_hp']);
const NAME = { dee: 'DEE', priya: 'PRIYA', hank: 'HANK', june: 'JUNE', tessa: 'TESSA', coach: 'COACH', cam: 'CAM', wren: 'WREN', marcus: 'MARCUS', dlc_marcus: 'MARCUS', silas: 'SILAS',
  dlc_dee: 'DEE', dlc_priya: 'PRIYA', dlc_cam: 'CAM', lou: 'LOU', ivy: 'IVY', gus: 'GUS', pip: 'PIP',
  thug_slick: 'THUG', thug_hot: 'THUG', thug_grunt: 'THUG', crew: 'CREW', co_guard: 'C.O.', co_guard_riot: 'RIOT C.O.', co_guard_baton: 'C.O.', co_guard_sgt: 'SGT.', lk_crew: 'CREW', voss: 'VOSS', lockkeeper: 'LOCKKEEPER', silas_boss: 'SILAS', vera: 'VERA', foreman: 'FOREMAN' };
const GREET_R = 140, LEAVE_R = 190;

let cur = null;            // { charId, key, trigger, text, kind, t, hold, ent }
let lastAmbient = -99, lastCombat = -99, clock = 0;
const used = {};           // `${charId}.${trigger}` -> Set of used ids (no repeats until the pool is spent)
const cool = {};           // `${key}.${trigger}` -> clock time it may fire again
const npcMem = {};         // per NPC: { near, nearT, outfits:Set }
let enemyMem = new WeakMap();
let prev = { weather: null, combat: false, lowHp: false, doneSig: '', outfit: null, area: null };
let lastCam = null;
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);

function pick(charId, trigger, s) {
  const pool = (BARKS[charId] && BARKS[charId][trigger]) || [];
  let ok = pool.filter((l) => !l.cond || l.cond(s));
  if (trigger === 'outfit' && s.outfit === 'silas' && ok.some((l) => l.cond)) ok = ok.filter((l) => l.cond); // Silas's Suit: its special line
  if (!ok.length) return null;
  const k = `${charId}.${trigger}`;
  const u = used[k] || (used[k] = new Set());
  let fresh = ok.filter((l) => !u.has(l.id));
  if (!fresh.length) { for (const l of ok) u.delete(l.id); fresh = ok; }
  const l = fresh[Math.floor(Math.random() * fresh.length)];
  u.add(l.id);
  return l;
}

function stop() { cur = null; hideSubtitle(); }

/** Try to say a line. key = per-character cooldown identity (an NPC id or an enemy object). */
function say(charId, trigger, ent, kind, s, opts = {}) {
  if (settings.style === 'off' || settings.chatter === 'off') return false;
  if (!BARKS[charId] || !BARKS[charId][trigger]) return false;
  const pri = PRI[trigger] || 1;
  if (cur && pri <= cur.pri && !(opts.force && cur.trigger !== trigger)) return false; // force: boss beats cut in                       // one line at a time; higher priority interrupts
  const low = settings.chatter === 'low';
  const combat = COMBAT.has(trigger);
  if (pri < 3) {
    const gap = (combat ? 3 : 8) * (low ? 2 : 1);
    if (clock - (combat ? lastCombat : lastAmbient) < gap) return false;
    if (low && Math.random() < 0.4) return false;
  }
  if (!onScreen(ent)) return false;
  const ck = `${typeof ent.__barkKey === 'string' ? ent.__barkKey : charId}.${trigger}`;
  if (!opts.noCool && (cool[ck] || 0) > clock) return false;
  const line = pick(charId, trigger, s);
  if (!line) return false;
  if (!opts.noCool) cool[ck] = clock + (opts.cd != null ? opts.cd : rand(30, 60));
  const hold = Math.min(4, 2.5 + line.text.length * 0.025);
  cur = { charId, trigger, text: line.text, kind, ent, t: 0, hold, pri, name: NAME[charId] || charId.toUpperCase() };
  if (combat) lastCombat = clock; else lastAmbient = clock;
  playAudio(charId, line);
  if (settings.style === 'subs' || settings.style === 'both') showSubtitle(cur, settings);
  return true;
}

function onScreen(ent) {
  if (!lastCam || !ent) return false;
  const sx = ent.x - lastCam.x;
  return sx > 10 && sx < lastCam.viewW - 10;
}

function silent(gs) {
  if (gs.mode !== 'play') return true; // title, pause, dialogue, ending, DLC mission card
  if (gs.cutscene || gs.arrest) return true;
  if (scenePlaying()) return true; // scene_player.js scenes: hide like dialogue, no triggers, no cooldowns used
  if (typeof document !== 'undefined') {
    for (const id of ['story-intro', 'dialogue', 'dlc-mission-card', 'dlc-ending-screen', 'ending-screen', 'pause-screen', 'title-screen', 'confirm-screen', 'outfit-screen']) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) return true;
    }
  }
  return false;
}

function thugPool(e, dlc) {
  if (e.guard) return e.variant && BARKS['co_guard_' + e.variant] ? 'co_guard_' + e.variant : 'co_guard'; // 2.0.1 Blackriver C.O.s
  if (e.lkCrew) return 'lk_crew'; // 2.0.1 the Lockkeeper's people
  if (dlc || e.crew) return 'crew';
  const c = (e.color || '').toLowerCase();
  if (c === '#8e44ad' || c === '#16a085') return 'thug_slick';
  if (c === '#c0392b' || c === '#d35400') return 'thug_hot';
  return 'thug_grunt';
}
/** 2.0.1: Blackriver mini-bosses (Voss, the Lockkeeper) count as bosses for barks. */
const isB = (e) => !!(e.isBoss || e.who === 'voss' || e.who === 'lockkeeper');
function bossId(e) { if (e.who === 'voss' || e.who === 'lockkeeper') return e.who; return e.charKey === 'vera' ? 'vera' : e.charKey === 'foreman' ? 'foreman' : 'silas_boss'; }
const kindOf = (bid) => (bid === 'silas' ? 'boss' : 'friend');
function npcBarkId(n, dlc) { if (!dlc) return n.id; return BARKS['dlc_' + n.id] ? 'dlc_' + n.id : n.id; }

/**
 * Per-frame update. Call every frame from main.js step() (any mode; it goes quiet outside play).
 * o = { gameState, stateBag, player, npcs: () => [], npcY, dlc: bool }
 */
export function updateBarks(dt, o) {
  const gs = o.gameState;
  clock += dt;
  if (silent(gs)) { if (cur) stop(); return; }
  if (cur) { cur.t += dt; if (cur.t > cur.hold + 0.4) stop(); }
  if (settings.style === 'off' || settings.chatter === 'off') return;
  const sb = o.stateBag || {}, p = o.player, dlc = !!o.dlc;
  const missions = sb.missions || {};
  const s = { done: (id) => !!(missions[id] && missions[id].done), mainComplete: !!sb.mainComplete, outfit: gs.outfitId, dlc };
  if (prev.area !== gs.areaId) { prev.area = gs.areaId; for (const k in npcMem) npcMem[k].near = false; }

  // ---- combat (polled) ----
  const foes = gs.enemies || [];
  const alive = foes.filter((e) => e.alive && !e.noLock && !e.runner);
  const combatNow = alive.length > 0;
  for (const e of foes) {
    let m = enemyMem.get(e);
    const id = isB(e) ? bossId(e) : thugPool(e, dlc); // 2.0.1: Blackriver mini-bosses speak their own lines
    if (!e.__barkKey) Object.defineProperty(e, '__barkKey', { value: isB(e) ? id : `${id}#${Math.random().toString(36).slice(2, 7)}`, enumerable: false });
    if (!m) {
      m = { hp: e.hp, alive: e.alive, kd: false, seen: false, phase: false, tauntAt: clock + rand(4, 8), hurtAt: 0 };
      enemyMem.set(e, m);
    }
    if (!m.seen && e.alive && onScreen(e)) {
      m.seen = true;
      if (isB(e)) say(id, 'intro', e, 'boss', s, { noCool: true });
      else say(id, 'spot', e, 'thug', s, { cd: 30 });
    }
    if (isB(e) && e.alive && !m.phase && e.hp <= e.maxHp * 0.5) { if (say(id, 'phase', e, 'boss', s, { noCool: true, force: true })) m.phase = true; }
    else if (e.alive && e.hp < m.hp) {
      if (clock >= m.hurtAt && Math.random() < 0.25) { m.hurtAt = clock + 1.5; say(id, 'hurt', e, isB(e) ? 'boss' : 'thug', s, { cd: 1.5 }); }
    }
    const kdNow = !!(e.kd && e.kd.phase === 'ground');
    if (kdNow && !m.kd && e.alive && !isB(e)) say(id, 'knocked_down', e, 'thug', s, { cd: 8 });
    m.kd = kdNow;
    if (m.alive && !e.alive) {
      if (isB(e)) say(id, 'defeat', e, 'boss', s, { noCool: true, force: true });
      else {
        const buddy = alive.find((b) => !isB(b));
        if (buddy) {
          const bid = thugPool(buddy, dlc);
          if (alive.filter((b) => !isB(b)).length === 1 && !alive.some((b) => isB(b))) say(bid, 'last_one', buddy, 'thug', s, { cd: 20 });
          else say(bid, 'kill_ko', buddy, 'thug', s, { cd: 10 });
        }
      }
    }
    if (e.alive && m.seen && clock >= m.tauntAt) {
      m.tauntAt = clock + rand(4, 8);
      say(id, 'taunt', e, e.isBoss ? 'boss' : 'thug', s, { cd: 4 });
    }
    m.hp = e.hp; m.alive = e.alive;
  }
  const lowHp = !!(p && p.alive !== false && p.maxHp && p.hp / p.maxHp < 0.3);
  if (lowHp && !prev.lowHp) {
    const boss = alive.find((e) => e.isBoss);
    if (boss) say(bossId(boss), 'player_low_hp', boss, 'boss', s, { cd: 20 });
  }

  // ---- friendly NPCs ----
  const npcs = combatNow ? [] : (o.npcs ? o.npcs() : []);
  const wx = getWeather();
  const rainStart = wx === 'rainy' && prev.weather !== null && prev.weather !== 'rainy';
  const fightEnded = prev.combat && !combatNow;
  let near = null;
  for (const n of npcs) {
    const bid = npcBarkId(n, dlc);
    if (!BARKS[bid]) continue;
    const mem = npcMem[bid] || (npcMem[bid] = { near: false, nearT: 0, outfits: new Set(['polo']) });
    const ent = { x: n.x, y: o.npcY || 420, __barkKey: bid, npc: true };
    const d = p ? Math.abs(p.x - n.x) : 1e9;
    const isNear = d < (mem.near ? LEAVE_R : GREET_R);
    if (isNear && !near) near = { n, bid, mem, ent };
    if (isNear && !mem.near) {
      mem.near = true; mem.nearT = 0;
      // story line beats a plain greeting when a mission flag unlocked an unheard one
      if (!dlc && say(bid, 'story', ent, kindOf(bid), s)) { /* story */ }
      else if (!dlc && !mem.outfits.has(gs.outfitId) && say(bid, 'outfit', ent, kindOf(bid), s, { noCool: true })) mem.outfits.add(gs.outfitId);
      else if (!dlc && wx === 'rainy' && Math.random() < 0.3 && say(bid, 'weather', ent, kindOf(bid), s)) { /* rain present */ }
      else say(bid, 'greet', ent, kindOf(bid), s);
    } else if (!isNear && mem.near) {
      mem.near = false;
      if (d < 420) say(bid, 'farewell', ent, kindOf(bid), s);
    } else if (isNear) {
      mem.nearT += dt;
      if (mem.nearT > 6) { mem.nearT = -rand(6, 14); say(bid, 'idle_near', ent, kindOf(bid), s); }
    }
    if (fightEnded && d < 500) say(bid, 'witness_fight', ent, kindOf(bid), s, { cd: 20 });
  }
  if (near && !dlc) {
    const { bid, mem, ent } = near;
    if (prev.outfit !== null && prev.outfit !== gs.outfitId && !mem.outfits.has(gs.outfitId)) {
      if (say(bid, 'outfit', ent, kindOf(bid), s, { noCool: true })) mem.outfits.add(gs.outfitId);
    }
    if (rainStart) say(bid, 'weather', ent, kindOf(bid), s);
    if (lowHp && !prev.lowHp) say(bid, 'low_hp', ent, kindOf(bid), s);
  }
  // Silas's Suit gets its own line: pools keep the suit line behind cond, so plain outfit picks skip it
  prev.weather = wx; prev.combat = combatNow; prev.lowHp = lowHp; prev.outfit = gs.outfitId;
  if (cur && cur.ent && !onScreen(cur.ent) && cur.t > 0.6) stop(); // speaker walked off screen
}

/** Record the camera frame each frame (drawWorld, after the cast). Drawing happens in drawBarksScreen. */
export function drawBarks(ctx, camFrame, areaId, mode) {
  lastCam = camFrame;
  lastArea = areaId; lastMode = mode;
}
/** Draw the active bubble on the presented display canvas (after presenter.present): constant screen size at 1x/2x/3x. */
export function drawBarksScreen(displayCanvas) {
  if (!cur || lastMode !== 'play' || !lastCam || !displayCanvas) return;
  if (settings.style !== 'bubbles' && settings.style !== 'both') return;
  const dctx = displayCanvas.getContext('2d');
  drawBarkBubble(dctx, cur, lastCam, lastArea, settings, reduced, true);
}
let lastArea = null, lastMode = null;

/** Test / debug hook (no gameplay effect). */
export const barksDebug = {
  get current() { return cur; },
  force(charId, trigger, ent, kind = 'friend') { cur = null; lastAmbient = lastCombat = -99; return say(charId, trigger, ent, kind, { done: () => true, mainComplete: false, outfit: 'polo' }, { noCool: true }); },
  settings,
  set: setBarkSetting,
  counts() { const o = {}; for (const c in BARKS) o[c] = Object.values(BARKS[c]).reduce((a, p) => a + p.length, 0); return o; }
};
if (typeof window !== 'undefined') window.__barks = barksDebug;
