/** Original fictional cast — preserved from 3D build. */
export const NPC_DEFS = [
  {
    id: 'dee', name: 'Dee Morales', role: 'Diner cook',
    area: 'diner', x: 320, color: '#d35400',
    lines: [
      "Matthew? Grab a stool — wait, that bag of leftovers wasn't yours.",
      "Someone swapped it. Now a polite stranger's asking questions. I need your help.",
      "Find Priya at Valley Pages. She's missing a shipment — same kind of mix-up."
    ],
    doneLines: [
      "Priya's at Valley Pages, next street over to the right. Go on, I'll keep your stool warm."
    ]
  },
  {
    id: 'priya', name: 'Priya Shah', role: 'Bookstore clerk',
    area: 'pages', x: 380, color: '#8e44ad',
    lines: [
      "You're Matthew? Dee texted. Our rare-map shipment never showed.",
      "Tracking says it hit the rail yard, then vanished. Hank might know.",
      "If Silas Boone offers help — smile, nod, and don't tell him anything."
    ],
    waitLines: [
      "Sorry, we're slammed with inventory. Dee keeps texting about you. Maybe talk to her first? The diner's just left of here."
    ],
    doneLines: [
      "Hank hangs around the Rail Yards, past the gym. Remember: smile, nod, say nothing to Silas."
    ]
  },
  {
    id: 'hank', name: 'Hank "Rail" Pettigrew', role: 'Retired rail worker',
    area: 'rails', x: 450, color: '#7f8c8d',
    lines: [
      "Saw a crate get moved after hours. Not by my old crew.",
      "I'll point you at odd jobs if you keep your head down.",
      "Watch the night shift, kid. That's when the quiet ones work. Remember that."
    ],
    waitLines: [
      "Rail yard's no place for sightseeing, kid. Come back when you've got a real reason to ask."
    ],
    doneLines: [
      "Silas Boone's been waiting downtown. Say your piece, then walk away."
    ]
  },
  {
    id: 'june', name: 'June Whitaker', role: 'Community center volunteer',
    area: 'community', x: 300, color: '#27ae60',
    lines: [
      "Rough day? Community Center's open. We've got side work that pays in favors.",
      "Drop flyers at Elmwood, or help set chairs. Soft landings matter.",
      "You're doing fine, Matthew. Come back if the city feels loud."
    ],
    doneLines: [
      "Chairs are set, flyers are out. Thanks, Matthew. Door's always open."
    ]
  },
  {
    id: 'tessa', name: 'Tessa Quinn', role: 'Skate-shop kid',
    area: 'skate', x: 340, color: '#e74c3c',
    lines: [
      "Yo — outfits stash around Star City. Hoodie near the Star path, jacket by the rails.",
      "Street rumor: a rideshare keeps circling Jefferson at the wrong times.",
      "Collect the gear. Look sharp. Don't trust the polite stranger."
    ],
    doneLines: [
      "Seven things stashed around town: glasses, a bottle, a notebook, an old class photo at the Community Center, and three fits. Go get 'em."
    ]
  },
  {
    id: 'coach', name: 'Coach Ray Delgado', role: 'Gym acquaintance',
    area: 'gym', x: 360, color: '#2980b9',
    lines: [
      "Matthew! Need a courier who can hustle. Delivery to the river bridge.",
      "Or race me a lap past City Market. Side cash, no questions.",
      "Keep your feet moving. Trouble hates a moving target."
    ],
    activeLines: [
      "Package goes to the River Bridge — right past the Rail Yards. Move those feet!"
    ],
    doneLines: [
      "Delivered on time? Knew you had hustle. Gym's open whenever."
    ]
  },
  {
    id: 'cam', name: 'Cam Ortiz', role: 'Rideshare driver',
    area: 'downtown', x: 520, color: '#f1c40f',
    lines: [
      "Need a lift? Wait — wrong pin again. Always the wrong pin lately.",
      "Funny how I keep ending up wherever you are, Matthew.",
      "If things heat up after dark… maybe don't ride with strangers. Even me. Sequel energy, yeah?"
    ],
    doneLines: [
      "Pin says Mill Mountain this time. That's… not where I'm headed. Weird, right?"
    ]
  },
  {
    id: 'silas', name: 'Silas Boone', role: 'Polite stranger',
    area: 'downtown', x: 700, color: '#2c3e50',
    lines: [
      "Matthew Rose. Everyday guy, unexpected bag of leftovers. Curious coincidence.",
      "I already know about Dee, Priya, and the rail crate. I know too much — that's my charm.",
      "Walk away from this and you'll be fine… for now. We'll speak again."
    ],
    waitLines: [
      "Matthew Rose. Lovely evening. We'll talk properly once you've done a little more homework."
    ],
    doneLines: [
      "We'll speak again, Matthew."
    ]
  }
];

export const OUTFITS = {
  polo: { name: 'White Polo Tee', shirt: '#fafaf8', pants: '#5a7aa8', accent: '#1a2f5c' },
  hoodie: { name: 'Star City Hoodie', shirt: '#2c4a7a', pants: '#2a2a2e', accent: '#ffd24a' },
  jacket: { name: 'Rail Yard Jacket', shirt: '#3d4a3a', pants: '#3a3a48', accent: '#c45c26' },
  street: { name: 'Skate Fit', shirt: '#111111', pants: '#5a7aaa', accent: '#e83e3e' },
  // Matthew's real look from his classroom photo (sheet: assets/sprites/matthew_photo.png)
  photo: { name: 'Classroom Photo Tee', shirt: '#fafaf8', pants: '#5a7aa8', accent: '#1a2f5c' }
};

/** Outfit order for keys 1-5, L1/R1 (LB/RB) cycling and the pause-menu outfit button. */
export const OUTFIT_ORDER = ['polo', 'hoodie', 'jacket', 'street', 'photo'];
