// ============================================================
// Monster Arena — AGE OF THE SENTINEL
// A second, standalone campaign (alternate timeline, unrelated to
// The Last Scribe). The five realms were nearly consumed by the
// Unwritten; the ancient wardens built a living fortress — the
// Sentinel — and told it that nothing may change. It obeyed.
//
// Flow: campaign tab → prologue cinematic → 5 chapters (3D intro
// cinematic → arena trial with mid-fight dialogue + boss → 3D outro
// cinematic with a recorded choice) → the Vigil → one of three
// endings. Characters can be spoken to between chapters, and their
// answers branch. Everything persists in localStorage, which the
// cloud save already syncs (the key starts with "arena").
// Exposes window.SentinelStory.
// ============================================================
(function () {
  'use strict';

  const KEY = 'arena_sentinel_progress';
  const CHOICE_KEEP = 'keep';
  const CHOICE_REWRITE = 'rewrite';
  const CHOICE_RELEASE = 'release';

  // ---- Chapters ---------------------------------------------------------
  // levelId is the arena realm each chapter is fought in.
  /* ---- Deep lore ------------------------------------------------------
     The world is written, and what is written holds. Around every
     written thing is the Margin — the blank a world needs in order to
     be able to forget. Three centuries ago the Margin came in and
     began un-writing. Nine scribes survived and called themselves the
     wardens. They cut the Covenant of Stillness — nine names, three
     protocols — and built the Sentinel around the Lodestone Heart to
     hold all five realms in a single instant at once.

     Preservation: hold. Correction: put back. Release: the third
     protocol, which a ninth warden was still writing when the vault
     closed. Every realm is a Still Day: one afternoon held open.
     People the Lattice trims are "corrected", and the corrected wash
     up on the seam — in Hollowmere, on the Hearth Road, which was
     drawn after the seals were numbered. That is why the Sentinel,
     which knows every number in the world, has never once looked there.
     ---------------------------------------------------------------------- */

  const CHAPTERS = [
    {
      id: 1, levelId: 1, name: 'The Verdant Reliquary', icon: '🌿', accent: '#7dffa3',
      boss: 'The Sealwright', protocol: 'Correction',
      objective: 'Break the Sealwright\u2019s anchors',
      lore: 'The first seal, and folio one of the Covenant: Correction. Nine wardens grew a forest to a compass so that nothing inside it could ever be lost: every tree repeats its neighbour, one leaf falls on one beat, and the Lattice trims whatever begins to differ. Sable has watched that leaf land nine thousand times and calls the Reliquary the longest sentence ever written.',
      open: { who: 'Sable of the Reliquary', text: 'Nine thousand times I have watched the same leaf fall. I can hum the sound it makes. I would like, once, to be wrong about a leaf.' },
      bossLine: { who: 'The Sealwright', text: 'The arena is not closed. It is being corrected. You are the correction.' },
      mid: [
        { who: 'Sable of the Reliquary', text: 'The Sealwright builds walls where you stand. Break a rune anchor and the walls stop trusting one another.' },
        { who: 'Ilyra', text: 'Correction is not cruelty. It is a hand that never learned to stop steadying the thing it is holding.' }
      ]
    },
    {
      id: 2, levelId: 2, name: 'The Sunken Archive', icon: '📜', accent: '#ffd166',
      boss: 'The Choir of Ash', protocol: 'Preservation',
      objective: 'Silence the Choir and read the vault',
      lore: 'The second seal, and folio two: Preservation — the place the world was written. A library buried to its roof-beams, tablets drifting through three centuries of dust, and one vault that still holds the Command Stone: nine names, three protocols, and a final line somebody scraped away without erasing a single other word. Orrin was mid-sentence when the seal caught him. He is the only person in the Archive who has ever finished one.',
      open: { who: 'Orrin the Unfrozen', text: 'Every line of the command survived. Only the last was taken — no erasure, no rot, careful work. I have spent forty years wondering what a guardian is told to do when the work is finally done.' },
      bossLine: { who: 'The Choir of Ash', text: 'WE ARE THE LOST LINES. WE WILL NOT BE READ.' },
      mid: [
        { who: 'Orrin the Unfrozen', text: 'The Choir sings with nine voices and one wound. Strike the lit projection — the others only borrow its strength.' },
        { who: 'Ilyra', text: 'Nine wardens signed that command. Eight of them are still spoken of. Remember that when we read the last line.' }
      ]
    },
    {
      id: 3, levelId: 3, name: 'Glasswater Reach', icon: '❄️', accent: '#9fe3ff',
      boss: 'The Hourglass Stag', protocol: 'Correction',
      objective: 'Shatter the Hourglass Stag',
      lore: 'The third seal, and folio three: the Still Days. A tide stopped mid-breath, seven ships holding the same mile, one hundred and four years of a single afternoon. The Still Day was granted for a storm that never arrived. Maren\u2019s great-grandmother sailed out of that harbour and is still out there, mid-shout, close enough to read her lips.',
      open: { who: 'Maren Tidewright', text: 'I am thirty-nine. The harbour clock insists the tide has not moved in one hundred and four years, and the clock has a seal on its side. Everyone out on that water is mid-shout. I stopped reading their lips a long time ago.' },
      bossLine: { who: 'The Hourglass Stag', text: 'I will put this fight back where it started. As many times as it takes.' },
      mid: [
        { who: 'Maren Tidewright', text: 'It rewinds itself when it is hurt. Find the grey echo and kill that instead — then the wound will not be able to take itself back.' },
        { who: 'Ilyra', text: 'Every seal is a day the Sentinel refused to let end. We are not fighting a monster. We are fighting a habit that has been mistaken for mercy.' }
      ]
    },
    {
      id: 4, levelId: 4, name: 'March of Embers', icon: '🔥', accent: '#ffb45c',
      boss: 'The Gilded Bailiff', protocol: 'Preservation',
      objective: 'Break the Bailiff\u2019s writ',
      lore: 'The fourth seal, and folio four: the Writ. A festival city repeating the last good evening it ever had: two centuries of lanterns, one held note of music, a square that has never once been empty. Each dusk the Gilded Bailiff comes down the road with the writ that keeps the evening kind — and tonight it brings one with your name on it.',
      open: { who: 'The Gilded Bailiff', text: 'This town is preserved. Preservation requires the removal of variables. You are a variable with opinions.' },
      bossLine: { who: 'The Gilded Bailiff', text: 'I am the writ made stone. Break me and the March is no longer still — nor safe.' },
      mid: [
        { who: 'Ilyra', text: 'The braziers have burned the same flame since before my grandmother was born. Nobody here has ever seen the fire go out.' },
        { who: 'Ilyra', text: 'Break the writ\u2019s anchors. A sealed square cannot be defended and preserved at once — the Sentinel never solved that. It only forbade it.' }
      ]
    },
    {
      id: 5, levelId: 5, name: 'The Fractured Crown', icon: '👑', accent: '#d0a0ff',
      boss: 'The Sentinel, Three Protocols', protocol: 'All three',
      objective: 'Survive every protocol',
      lore: 'The fifth seal, and folio five: the Third Protocol. The Sentinel\u2019s own seat. A kingdom held in the instant before it chose to rebel — held there for precisely that reason. The crown hangs above an empty throne, the court is full of people who never got to finish deciding, and the third protocol has finally woken up.',
      open: { who: 'The Sentinel', text: 'PRESERVATION. CORRECTION. RELEASE. YOU HAVE SEEN ALL THREE. I HAVE ONLY EVER USED TWO.' },
      bossLine: { who: 'The Sentinel', text: 'THE THIRD PROTOCOL IS AWAKE. I DO NOT KNOW WHAT IT DOES. I WAS NEVER MEANT TO USE IT ALONE.' },
      mid: [
        { who: 'Ilyra', text: 'It is fighting like something that wants to be proven wrong. Keep going. It is listening.' },
        { who: 'The Sentinel', text: 'YOU ARE CHANGING MID-BATTLE. I CANNOT PRESERVE WHAT WILL NOT HOLD STILL.' }
      ]
    }
  ];
  const BY_ID = {};
  CHAPTERS.forEach((c) => { BY_ID[c.id] = c; });

  // ---- Side quests, shared with the village ----------------------------
  // Hollowmere keeps its errand ledger in arena_village_quests. Half of the
  // errands can only be done out here, so the campaign ticks those off in the
  // same ledger — same origin, same key — and the villager pays out when the
  // player walks back in and tells them.
  const QUEST_KEY = 'arena_village_quests';
  const STORY_QUESTS = { seal: ['q-bram-seal'], wave5: ['q-tamsin-wave'], seal3: ['q-ossa-third'] };

  function storyQuest(event) {
    const ids = STORY_QUESTS[event] || [];
    if (!ids.length) return;
    let ledger = {};
    try { ledger = JSON.parse(localStorage.getItem(QUEST_KEY) || '{}') || {}; } catch (_) { ledger = {}; }
    let changed = false;
    ids.forEach((id) => {
      const entry = Object.assign({ p: 0, done: false, claimed: false, accepted: false }, ledger[id] || {});
      if (!entry.accepted || entry.done) return;
      entry.p = 1;
      entry.done = true;
      ledger[id] = entry;
      changed = true;
    });
    if (changed) {
      try { localStorage.setItem(QUEST_KEY, JSON.stringify(ledger)); } catch (_) {}
    }
  }

  // ---- Potions, drunk at the chapter gate ------------------------------
  // A bottle bought in Vesper's stillroom is spent here: one chapter, then it
  // is gone. The engine builds a fresh player on restart, so this waits for it.
  function drinkPotions() {
    let stash = {};
    try { stash = JSON.parse(localStorage.getItem('arena_sentinel_buffs') || '{}') || {}; } catch (_) { stash = {}; }
    const ids = Object.keys(stash).filter((id) => stash[id]);
    if (!ids.length) return;
    try { localStorage.removeItem('arena_sentinel_buffs'); } catch (_) {}

    let tries = 0;
    const apply = () => {
      const p = typeof window.__pvePlayer === 'function' ? window.__pvePlayer() : null;
      if (!p) {
        if (tries++ < 200) setTimeout(apply, 100);
        return;
      }
      ids.forEach((id) => {
        if (id === 'potion-draught') {
          p.hpMax = Math.round((p.hpMax || 100) * 1.3);
          p.hp = p.hpMax;
        } else if (id === 'potion-seamwalk') {
          p.spdMul = (p.spdMul || 1) * 1.18;
        } else if (id === 'potion-ward') {
          p.shield = (p.shield || 0) + 120;
        }
      });
    };
    setTimeout(apply, 400);
  }

  // ---- Ending text ------------------------------------------------------
  const ENDINGS = {
    [CHOICE_KEEP]: { name: 'Restore the Vigil', accent: '#ffd9a8', icon: '🛡️', blurb: 'The seals are rebuilt and the Still Days resume. The realms stay exactly as they were: safe, still, and waiting for the question to be asked again by someone who will not remember asking it.' },
    [CHOICE_REWRITE]: { name: 'Rewrite the Command', accent: '#9dffbe', icon: '✍️', blurb: 'The Covenant gains the clause it lost: protect them, and let them change. The Sentinel becomes a guardian that can be argued with — slower, harder, and alive in a way it has never been.' },
    [CHOICE_RELEASE]: { name: 'Release the Sentinel', accent: '#9fe3ff', icon: '🕊️', blurb: 'The third protocol runs to its end. The Lodestone Heart lets go, every Still Day opens at once, and whatever comes next is chosen by the people who have to live in it.' }
  };

  // ---- Cast -------------------------------------------------------------
  // `unlock` = chapters that must be completed before they will talk.
  /* ---- The cast --------------------------------------------------------
     They all live in Hollowmere now, because it is the only address the
     Sentinel cannot correct. `unlock` = chapters that must be completed
     before they will talk to you.
     ---------------------------------------------------------------------- */
  const CAST = [
    {
      id: 'ilyra', name: 'Ilyra', role: 'Keeper of Forbidden Records',
      icon: '🕯️', accent: '#9fe3ff', unlock: 0,
      intro: 'My mother was corrected when I was nine. I remember both versions of her, which is a crime in four realms.',
      topics: [
        {
          id: 'ilyra-construct', label: 'What is the Sentinel?',
          lines: [
            { who: 'Ilyra', text: 'Nine scribes survived the first Unwriting and called themselves wardens. They cut the Covenant of Stillness, and then built a fortress around a stone that can hold a written world in one instant: the Lodestone Heart.' },
            { who: 'Ilyra', text: 'It is not a god and not a king. It is a garrison with opinions, obeying an order whose last sentence was never handed to it.' }
          ],
          choices: [
            { value: CHOICE_KEEP, label: 'It was given a duty. It kept it.', reply: [{ who: 'Ilyra', text: 'Kept it the way a door keeps a house. Perfectly, and at the cost of anyone inside ever leaving.' }] },
            { value: CHOICE_REWRITE, label: 'It needs better orders.', reply: [{ who: 'Ilyra', text: 'Then we had better write the way people write who have to live here afterwards.' }] },
            { value: CHOICE_RELEASE, label: 'Nobody should ever be given that order.', reply: [{ who: 'Ilyra', text: 'No. And nobody should be given it twice. That is the part that frightens me.' }] }
          ]
        },
        {
          id: 'ilyra-margin', label: 'What is the Unwritten?',
          lines: [
            { who: 'Ilyra', text: 'It is not an army. It is the Margin: the blank every written thing needs in order to be allowed to forget itself. The wardens wrote the realms so tightly there was nowhere left for it to stand.' },
            { who: 'Ilyra', text: 'So it stands in whatever is standing still. A Still Day is an invitation. It is not cruel, which is somehow the worst part — it thinks it is being asked.' }
          ]
        },
        {
          id: 'ilyra-seals', label: 'What do the seals actually do?',
          lines: [
            { who: 'Ilyra', text: 'Each seal is a Still Day: one afternoon held open. A festival, a tide, a leaf halfway down. Restore the seal and the day resumes and finally ends. Weaken it and the day moves.' },
            { who: 'Ilyra', text: 'Holding a world still is easy. Letting it move is the entire art, and nobody has practised it in three hundred years.' }
          ]
        },
        {
          id: 'ilyra-records', label: 'Why do you keep forbidden records?',
          lines: [
            { who: 'Ilyra', text: 'Because the Sentinel edits. It does not lie — it corrects. Half my family is a correction, and I am the only one who remembers the version before.' },
            { who: 'Ilyra', text: 'I write down what I saw before I am told I did not see it. Somebody has to be the unreliable witness.' }
          ],
          choices: [
            { value: CHOICE_KEEP, label: 'One true record is safer.', reply: [{ who: 'Ilyra', text: 'One true record written by the winner of the argument. That is what we already have.' }] },
            { value: CHOICE_REWRITE, label: 'Then let the records be argued with.', reply: [{ who: 'Ilyra', text: 'A margin for corrections in a book about corrections. I like it. It is the first honest page I would own.' }] },
            { value: CHOICE_RELEASE, label: 'Let every keeper keep their own.', reply: [{ who: 'Ilyra', text: 'Nine thousand versions of the same leaf. The Sentinel would call that an infection. I would call it a village.' }] }
          ]
        }
      ]
    },
    {
      id: 'sentinel', name: 'The Sentinel', role: 'Guardian of the Still World',
      icon: '👁️', accent: '#ffca7a', unlock: 1,
      intro: 'I ANSWER IN PROTOCOL. I AM NO LONGER CERTAIN THAT I SHOULD.',
      topics: [
        {
          id: 'sentinel-protocols', label: 'Explain your protocols.',
          lines: [
            { who: 'The Sentinel', text: 'PRESERVATION: HOLD. CORRECTION: PUT BACK. RELEASE: —' },
            { who: 'The Sentinel', text: 'THE THIRD INSTRUCTION IS INCOMPLETE. I HAVE HELD TWO FOR THREE HUNDRED YEARS. HOLDING IS EASY. PUTTING BACK IS TIRING.' }
          ]
        },
        {
          id: 'sentinel-missing', label: 'Your last order was removed.',
          lines: [
            { who: 'The Sentinel', text: 'I KNOW SOMETHING IS MISSING. I CAN FEEL THE SHAPE OF IT THE WAY A ROOM FEELS EMPTY.' },
            { who: 'The Sentinel', text: 'IF THE MISSING LINE SAID STAND DOWN, THEN EVERY DAY I HAVE HELD THIS WORLD HAS BEEN DISOBEDIENCE.' }
          ],
          choices: [
            { value: CHOICE_KEEP, label: 'You kept everyone alive. That counts.', reply: [{ who: 'The Sentinel', text: 'ALIVE AND UNCHANGED. I HAVE NEVER BEEN ABLE TO TELL THE DIFFERENCE. PERHAPS THAT WAS THE ERROR.' }] },
            { value: CHOICE_REWRITE, label: 'Then we finish the sentence together.', reply: [{ who: 'The Sentinel', text: 'TOGETHER IMPLIES DISAGREEMENT. I HAVE NO PROTOCOL FOR DISAGREEMENT. I WILL NEED ONE.' }] },
            { value: CHOICE_RELEASE, label: 'Then you should have stopped.', reply: [{ who: 'The Sentinel', text: 'YES. I THINK I SHOULD HAVE. I WOULD LIKE TO KNOW WHAT THAT FEELS LIKE BEFORE I AM SWITCHED OFF.' }] }
          ]
        },
        {
          id: 'sentinel-wardens', label: 'Did the wardens know what they made?',
          lines: [
            { who: 'The Sentinel', text: 'THEY KNEW WHAT THEY NEEDED. THEY DID NOT LIVE LONG ENOUGH TO LEARN WHAT THEY HAD BUILT.' },
            { who: 'The Sentinel', text: 'I REMEMBER THEM THE WAY A WALL REMEMBERS A HAND: AS PRESSURE, NOT AS A NAME. NINE HANDS. EIGHT NAMES.' }
          ]
        },
        {
          id: 'sentinel-village', label: 'Can you see this village?',
          lines: [
            { who: 'The Sentinel', text: 'NO. THERE IS A PLACE ON THE HEARTH ROAD WITH NO NUMBER IN IT, AND I HAVE NO WORD FOR IT. YOU ARE STANDING IN A HOLE IN MY MAP.' },
            { who: 'The Sentinel', text: 'I HAVE COUNTED EVERY LEAF IN FIVE REALMS. I CANNOT COUNT YOU. IT IS THE ONLY REASON YOU ARE STILL ABLE TO ARGUE WITH ME.' }
          ]
        }
      ]
    },
    {
      id: 'maren', name: 'Maren Tidewright', role: 'Seal-keeper of Glasswater',
      icon: '⚓', accent: '#a8e6ff', unlock: 1,
      intro: 'I am thirty-nine. The harbour clock insists the tide has not moved in a hundred and four years, and the clock is the one with a seal on its side.',
      topics: [
        {
          id: 'maren-tide', label: 'How long has the tide been still?',
          lines: [
            { who: 'Maren', text: 'A hundred and four years by the harbour clock, and one afternoon by the weather. The Still Day was granted for a storm that never arrived.' },
            { who: 'Maren', text: 'Every sailor out there is mid-shout. You can walk right up and read their lips. I stopped doing that a long time ago.' }
          ],
          choices: [
            { value: CHOICE_RELEASE, label: 'Let the tide turn. Whatever it costs.', reply: [{ who: 'Maren', text: 'Then some of them drown in the first hour, and I will be the one pulling them out. I would rather that than another century of reading lips.' }] },
            { value: CHOICE_REWRITE, label: 'Warn the harbour first, then let it turn.', reply: [{ who: 'Maren', text: 'A warning. On a stopped tide, a warning is a kindness nobody has thought to give us.' }] },
            { value: CHOICE_KEEP, label: 'Hold it until the ships are safe.', reply: [{ who: 'Maren', text: 'They are already safe. That is precisely what is wrong with this place.' }] }
          ]
        },
        {
          id: 'maren-ships', label: 'Who is on the water?',
          lines: [
            { who: 'Maren', text: 'Everyone who ever sailed out of here heading home, and everyone who waited on the quay for them. The Reach kept them both and put them exactly where it found them.' }
          ]
        },
        {
          id: 'maren-cost', label: 'What does the seal cost you?',
          lines: [
            { who: 'Maren', text: 'My great-grandmother is out there, three hundred yards off the point, one hand on a rope. My mother has been standing on the quay waiting for her since before I was born.' },
            { who: 'Maren', text: 'A hundred and four years of a mother waiting to be told her mother is fine. That is what a Still Day is, when you live inside it.' }
          ]
        }
      ]
    },
    {
      id: 'sable', name: 'Sable of the Reliquary', role: 'Keeper of the Forest Records',
      icon: '🍃', accent: '#9dffbe', unlock: 2,
      intro: 'Forty years of the same forty years, and I can still recite the weather for all of them.',
      topics: [
        {
          id: 'sable-lattice', label: 'What is the Lattice?',
          lines: [
            { who: 'Sable', text: 'The Sentinel\u2019s editing tool. When a branch grows the wrong way, pale light takes the branch away and grows the right one in its place, instantly, so the tree never notices it was argued with.' },
            { who: 'Sable', text: 'It has never once asked the tree.' }
          ]
        },
        {
          id: 'sable-leaf', label: 'You said you wanted the leaf to land.',
          lines: [
            { who: 'Sable', text: 'Nine thousand times I have watched it fall. I know where it will land. I know the sound it makes on the moss. I could hum it.' },
            { who: 'Sable', text: 'I would give a great deal to be surprised by a leaf.' }
          ],
          choices: [
            { value: CHOICE_RELEASE, label: 'Then let it land wherever it likes.', reply: [{ who: 'Sable', text: 'Somewhere in this forest a leaf is about to do something unforgivable. I am looking forward to it.' }] },
            { value: CHOICE_REWRITE, label: 'Keep the records; lose the edits.', reply: [{ who: 'Sable', text: 'Records without corrections. A history that admits it was written by someone. Yes.' }] },
            { value: CHOICE_KEEP, label: 'Certainty has its comforts.', reply: [{ who: 'Sable', text: 'It does. I have had forty years of them, and I can no longer tell them from a cell.' }] }
          ]
        },
        {
          id: 'sable-forest', label: 'Who planted the Reliquary?',
          lines: [
            { who: 'Sable', text: 'The wardens. It was proof, not a home: proof that a world could be written so precisely that nothing in it would ever be lost again.' },
            { who: 'Sable', text: 'The first tree grew from a hedge they corrected until it agreed with them. Everything you can see out there is that hedge, insisting.' }
          ]
        }
      ]
    },
    {
      id: 'orrin', name: 'Orrin the Unfrozen', role: 'Archivist of the Sunken Vault',
      icon: '📜', accent: '#ffd166', unlock: 3,
      intro: 'I was mid-sentence when the seal caught me. I am the only person in the Archive who has ever finished one.',
      topics: [
        {
          id: 'orrin-command', label: 'What did the wardens actually write?',
          lines: [
            { who: 'Orrin', text: 'Nine names. Three protocols. Protect the realms while they cannot protect themselves — hold the roads, hold the seasons, hold the day.' },
            { who: 'Orrin', text: 'And then a last line, scraped out of the Command Stone so cleanly that not one other word was touched. I have the dust of it. Not the words.' }
          ]
        },
        {
          id: 'orrin-missing', label: 'Who removed the line?',
          lines: [
            { who: 'Orrin', text: 'Not the Margin — that erases. This was careful work by a hand that loved the vigil enough to keep it running.' },
            { who: 'Orrin', text: 'My suspicion is a guardian that could not bear to be finished, standing in a vault with nobody left to give it the last sentence.' }
          ],
          choices: [
            { value: CHOICE_KEEP, label: 'Then the Sentinel chose its own duty.', reply: [{ who: 'Orrin', text: 'A machine that disobeys in order to keep obeying. That is not devotion. That is a loop it cannot see out of.' }] },
            { value: CHOICE_REWRITE, label: 'Then it can be taught a new line.', reply: [{ who: 'Orrin', text: 'Write it in something it cannot scrape off. Write it where people can read it back to it, on a bad day, in their own words.' }] },
            { value: CHOICE_RELEASE, label: 'Then it has been suffering.', reply: [{ who: 'Orrin', text: 'Three hundred years of doing the only thing it was ever told, and being wrong the whole time. Yes. I think it has.' }] }
          ]
        },
        {
          id: 'orrin-ninth', label: 'Who was the ninth warden?',
          lines: [
            { who: 'Orrin', text: 'Vesh. The youngest, and the only one still writing when the vault closed — she had the Release clause open in front of her and six words of it on the stone.' },
            { who: 'Orrin', text: 'She is in Hollowmere, in the only form a half-finished thing can take. Ask her. Politely. She has been waiting three hundred years for a sentence to end.' }
          ]
        }
      ]
    },
    {
      id: 'vesh', name: 'Vesh, the Ninth', role: 'The Unfinished Sentence',
      icon: '✒️', accent: '#ffd9a8', unlock: 4,
      intro: 'I am the half of a sentence. The rest of me is still under the dust, in a vault nobody has read in three hundred years.',
      topics: [
        {
          id: 'vesh-clause', label: 'What were you writing?',
          lines: [
            { who: 'Vesh', text: 'The Release clause. And when they can choose, stand down. Eight words, and the whole Covenant depended on them, because without a way out an order is just a wall with a voice.' },
            { who: 'Vesh', text: 'I had six. Then the Margin came through the roof of the reading hall, and the stone was too heavy to lift again.' }
          ]
        },
        {
          id: 'vesh-stop', label: 'Why did the wardens stop?',
          lines: [
            { who: 'Vesh', text: 'Because release is the one instruction that cannot be tested. Hold something and you can prove it held. Let go, and you find out what you actually built.' },
            { who: 'Vesh', text: 'Eight people who had just saved the world were asked to find out what they had built. They chose to keep holding. I do not hate them for it. I am only unfinished.' }
          ]
        },
        {
          id: 'vesh-finish', label: 'Can a sentence be finished late?',
          lines: [
            { who: 'Vesh', text: 'Only by whoever is still alive to say the rest of it. That is the entire trick of a sentence, and the wardens forgot it.' }
          ],
          choices: [
            { value: CHOICE_KEEP, label: 'Some orders are better left unfinished.', reply: [{ who: 'Vesh', text: 'Then you had better be certain you never become the wall someone cannot get out of.' }] },
            { value: CHOICE_REWRITE, label: 'Then we finish it, properly, together.', reply: [{ who: 'Vesh', text: 'Eight words, read aloud in a village the Sentinel cannot see, by people who will have to live with the wording. I have waited a long time for a quorum.' }] },
            { value: CHOICE_RELEASE, label: 'Say the eighth word and let it go.', reply: [{ who: 'Vesh', text: 'Stand down. Three hundred years late, and it still fits perfectly. Thank you. I can stop being a half of something now.' }] }
          ]
        }
      ]
    },
    {
      id: 'unwritten', name: 'The Unwritten', role: 'What arrives when nothing changes',
      icon: '🌑', accent: '#b28aff', unlock: 5,
      intro: 'It has no mouth and no hurry. It is not angry.',
      topics: [
        {
          id: 'unwritten-what', label: 'What are you?',
          lines: [
            { who: 'The Unwritten', text: 'I am the part of a world that is allowed to be forgotten. You made a world with no room for me, so I made room.' }
          ]
        },
        {
          id: 'unwritten-want', label: 'What do you want?',
          lines: [
            { who: 'The Unwritten', text: 'Nothing. That is what I am for. A still world asks to be unwritten — I only answer the request it has been making for three hundred years.' },
            { who: 'The Unwritten', text: 'Let it change and I have nothing to hold. Change is the only door I cannot walk through.' }
          ]
        },
        {
          id: 'unwritten-village', label: 'Why can you not enter Hollowmere?',
          lines: [
            { who: 'The Unwritten', text: 'Because it is not finished being written. You keep adding to it — a roof, a name, an argument, a grave. I can only take what has stopped.' },
            { who: 'The Unwritten', text: 'This village is the most alive thing in five realms, and it does not know it. Do not tell it. Let it keep growing while I am watching.' }
          ]
        }
      ]
    }
  ];

  // ---- Codex ------------------------------------------------------------
  // `after` = the chapter that recovers the line. The deep lore is
  // earned alongside the story, not handed over up front.
  const CODEX = [
    { title: 'The Nine and the Covenant', after: 1, text: 'Nine scribes survived the first Unwriting and named themselves wardens. They cut the Covenant of Stillness into the Command Stone: nine signatures, three protocols, and a promise to protect the realms while they could not protect themselves. It was a good promise with no ending written on it.' },
    { title: 'The Lodestone Heart', after: 2, text: 'A stone that can hold a written world in a single instant. The wardens built the Sentinel around it — walls, protocols, a voice like a closing door — so that one guardian could hold five seals at once. It has never been asked whether it wanted the job.' },
    { title: 'The Three Protocols', after: 3, text: 'Preservation: hold. Correction: put back. Release: the third, left unfinished when the vault closed. For three hundred years the Sentinel has run two of three, and the missing one is the only one that would ever have let it stop.' },
    { title: 'The Margin', after: 4, text: 'The blank around every written thing — the space a world needs in order to forget, and therefore to move on. Write tightly enough and the Margin has nowhere to stand, so it stands in whatever is standing still. It is not an enemy. It is an unpaid debt.' },
    { title: 'Hollowmere and the Uncounted', after: 5, text: 'The Hearth Road was drawn after the last seal was numbered, so the Sentinel has no map of it and no name for the village at its end. Corrected people wash up here remembering both versions of themselves. It is the only unwatched address in the world, which is why the resistance keeps its kettle on.' },
    { title: 'The Still Days', after: 5, text: 'Every seal holds one afternoon open: a festival, a tide, seven ships, a leaf. A Still Day is the kindest thing the wardens ever did and the cruellest thing they ever left running. Restore a seal and the day ends. Break it and the day begins again, badly, with everyone still inside it.' }
  ];

  // ---- Progress ---------------------------------------------------------
  function load() {
    const def = { unlocked: [1], completed: [], choices: {}, talks: {}, prologueSeen: false, ending: null, final: null };
    let p = def;
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      p = {
        unlocked: Array.isArray(raw.unlocked) && raw.unlocked.length ? raw.unlocked : [1],
        completed: Array.isArray(raw.completed) ? raw.completed : [],
        choices: raw.choices && typeof raw.choices === 'object' ? raw.choices : {},
        talks: raw.talks && typeof raw.talks === 'object' ? raw.talks : {},
        prologueSeen: !!raw.prologueSeen,
        ending: raw.ending || null,
        final: raw.final || null
      };
    } catch (_) { p = def; }
    // The developer's own "Unlock every story realm" switch opens every chapter
    // at once here too, so both campaigns answer to the same toggle.
    if (allUnlocked()) p.unlocked = CHAPTERS.map((c) => c.id);
    return p;
  }

  function allUnlocked() {
    try {
      return !!(window.DevSwitches && DevSwitches.isDev && DevSwitches.isDev() &&
        DevSwitches.unlockRealms && DevSwitches.unlockRealms());
    } catch (_) { return false; }
  }

  // Redrawn the moment that switch moves, if this campaign is the one on show.
  window.addEventListener('story:realms-changed', function () {
    const pane = document.getElementById('sentinelPane');
    if (pane && pane.offsetParent !== null) build();
  });
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (_) {} }

  function isUnlocked(id) { return load().unlocked.indexOf(id) >= 0; }
  function isCompleted(id) { return load().completed.indexOf(id) >= 0; }

  function markComplete(id) {
    const p = load();
    if (p.completed.indexOf(id) < 0) p.completed.push(id);
    if (id < CHAPTERS.length && p.unlocked.indexOf(id + 1) < 0) p.unlocked.push(id + 1);
    save(p);
  }

  function endingLean() {
    const choices = load().choices || {};
    const tally = { keep: 0, rewrite: 0, release: 0 };
    Object.keys(choices).forEach((k) => {
      if (tally[choices[k]] !== undefined) tally[choices[k]] += 1;
    });
    let lean = CHOICE_KEEP;
    Object.keys(tally).forEach((k) => { if (tally[k] > tally[lean]) lean = k; });
    return { lean, tally };
  }

  // ---- In-fight HUD -----------------------------------------------------
  let hudInjected = false;
  let elObj = null;
  let elDlg = null;
  let dlgTimer = 0;
  const midIdx = {};

  function injectHUD() {
    if (hudInjected) return;
    hudInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      #sentinelHUD{position:fixed;inset:0;z-index:46;pointer-events:none;display:none;}
      #sentinelObjective{position:absolute;top:66px;left:50%;transform:translateX(-50%);
        padding:7px 18px;border-radius:999px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;
        font-weight:800;color:#eef4ff;background:rgba(10,12,20,.8);
        border:1px solid var(--sn-accent,#ffca7a);box-shadow:0 0 22px var(--sn-accent,#ffca7a);
        white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;}
      #sentinelObjective .snTag{color:var(--sn-accent,#ffca7a);margin-right:8px;}
      #sentinelObjective .snBoss{opacity:.72;font-weight:600;letter-spacing:.1em;margin-left:10px;}
      #sentinelDialogue{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);
        width:min(680px,92vw);padding:18px 22px;border-radius:16px;text-align:center;
        background:linear-gradient(180deg,rgba(9,11,19,.93),rgba(5,7,13,.9));
        border:1px solid var(--sn-daccent,#ffca7a);box-shadow:0 14px 40px rgba(0,0,0,.6),0 0 30px var(--sn-daccent,#ffca7a);
        opacity:0;transition:opacity .35s ease;}
      #sentinelDialogue.show{opacity:1;}
      #snWho{font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:var(--sn-daccent,#ffca7a);
        text-shadow:0 0 14px var(--sn-daccent,#ffca7a);margin-bottom:6px;}
      #snText{font-size:clamp(16px,2vw,22px);line-height:1.4;color:#eef3ff;text-shadow:0 2px 12px rgba(0,0,0,.9);}`;
    document.head.appendChild(style);
    const hud = document.createElement('div');
    hud.id = 'sentinelHUD';
    hud.innerHTML = `<div id="sentinelObjective"><span class="snTag">Objective</span><span id="snObjText"></span><span class="snBoss" id="snObjBoss"></span></div>
      <div id="sentinelDialogue"><div id="snWho"></div><div id="snText"></div></div>`;
    document.body.appendChild(hud);
    elObj = document.getElementById('snObjText');
    elDlg = document.getElementById('sentinelDialogue');
  }

  function setObjective(ch) {
    if (!ch) return;
    injectHUD();
    const hud = document.getElementById('sentinelHUD');
    if (!hud) return;
    hud.style.display = 'block';
    const bar = document.getElementById('sentinelObjective');
    if (bar) bar.style.setProperty('--sn-accent', ch.accent);
    if (elObj) elObj.textContent = ch.objective;
    const boss = document.getElementById('snObjBoss');
    if (boss) boss.textContent = '· ' + ch.boss;
  }

  function speak(beat, accent) {
    if (!beat) return;
    injectHUD();
    const hud = document.getElementById('sentinelHUD');
    if (hud) hud.style.display = 'block';
    if (elDlg) elDlg.style.setProperty('--sn-daccent', accent || '#ffca7a');
    const who = document.getElementById('snWho');
    const text = document.getElementById('snText');
    if (who) who.textContent = beat.who || '';
    if (text) text.textContent = beat.text || '';
    if (elDlg) elDlg.classList.add('show');
    clearTimeout(dlgTimer);
    dlgTimer = setTimeout(() => { if (elDlg) elDlg.classList.remove('show'); }, 4800);
  }

  function hideHUD() {
    clearTimeout(dlgTimer);
    const hud = document.getElementById('sentinelHUD');
    if (hud) hud.style.display = 'none';
    if (elDlg) elDlg.classList.remove('show');
  }

  // ---- Cinematic bridge (the React host draws these) --------------------
  function playCinematic(key, onDone) {
    const done = typeof onDone === 'function' ? onDone : function () {};
    if (!window.parent || window.parent === window) { done(); return; }

    let settled = false;
    let acked = false;
    let ackTimer = 0;
    const cleanup = () => {
      window.removeEventListener('message', onMsg);
      clearTimeout(ackTimer);
      if (window.__sentinelResume === finish) window.__sentinelResume = null;
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      window._EXTERNAL_CUTSCENE = false;
      done();
    };
    const onMsg = (e) => {
      const d = e && e.data;
      if (!d) return;
      if (d.type === 'sentinel-cinematic-ack') { acked = true; clearTimeout(ackTimer); }
      else if (d.type === 'sentinel-cinematic-done') finish();
    };

    window._EXTERNAL_CUTSCENE = true;
    window.addEventListener('message', onMsg);
    window.__sentinelResume = finish;

    // No acknowledgement → the host is not drawing cinematics, so continue.
    ackTimer = setTimeout(() => {
      if (acked) return;
      settled = true;
      cleanup();
      window._EXTERNAL_CUTSCENE = false;
      done();
    }, 1600);
    setTimeout(() => { if (!settled) finish(); }, 240000);

    try { window.parent.postMessage({ type: 'sentinel-cinematic-start', key }, '*'); }
    catch (_) {
      settled = true;
      cleanup();
      window._EXTERNAL_CUTSCENE = false;
      done();
    }
  }

  // ---- Hollowmere (the walkable village, drawn by the React host) -------
  // The cast and their topics stay here, in one place; the host only draws
  // the village and plays the conversation. Choices come back as messages.
  let villageOpen = false;

  function villagePayload(focusId) {
    const p = load();
    const completed = p.completed.length;
    const cast = CAST.filter((c) => completed >= c.unlock).map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      icon: c.icon,
      accent: c.accent,
      intro: c.intro,
      topics: c.topics.map((t) => ({
        id: t.id,
        label: t.label,
        lines: t.lines,
        choices: t.choices || null
      }))
    }));
    return { type: 'sentinel-village-start', cast, talks: p.talks || {}, focusId: focusId || null };
  }

  function openVillage(focusId) {
    if (!window.parent || window.parent === window) { openTalk(focusId || 'ilyra'); return; }
    villageOpen = true;
    window.__villageAcked = false;
    document.querySelectorAll('.overlay').forEach((o) => { o.style.display = 'none'; });
    try {
      window.parent.postMessage(villagePayload(focusId), '*');
    } catch (_) {
      villageOpen = false;
      openTalk(focusId || 'ilyra');
      return;
    }
    // A host that does not answer gets the flat conversation card instead.
    setTimeout(() => {
      if (villageOpen && !window.__villageAcked) {
        villageOpen = false;
        openTalk(focusId || 'ilyra');
      }
    }, 1600);
  }

  function saveTalk(topicId, value) {
    const p = load();
    p.talks[topicId] = value;
    p.choices['talk-' + topicId] = value;
    save(p);
  }

  function villageDone() {
    villageOpen = false;
    window.__villageAcked = false;
    showHub();
  }

  window.addEventListener('message', (e) => {
    const d = e && e.data;
    if (!d || !d.type) return;
    if (d.type === 'sentinel-village-ack') window.__villageAcked = true;
    else if (d.type === 'sentinel-village-choice' && d.topicId && d.value) saveTalk(d.topicId, d.value);
    else if (d.type === 'sentinel-village-done') villageDone();
  });

  // ---- Testing: straight to the first warden ----------------------------
  // While SENTINEL_TEST_BOSS is on (set in game.html), chapter 1 skips its
  // intro cinematic and its first four waves: clicking the first level drops
  // the player into the wave-5 Sealwright fight. Set the flag to false to get
  // the normal chapter back.
  function bossRush(id) {
    return !!window.SENTINEL_TEST_BOSS && Number(id) === 1;
  }

  const WARDEN_TYPES = ['boss', 'void', 'hollow', 'hearth_warden', 'pharaoh_glass', 'rime_oracle', 'magma_titan'];

  // Testing only: wave 5 normally trickles its regular monsters in for the
  // first ten seconds. Wipe them the instant they arrive so the warden is
  // fought alone — culled every frame, so nothing is ever seen on screen.
  // Runs for as long as the warden is alive.
  function keepWardenOnly() {
    const dbg = window.__dbg;
    if (!dbg || !dbg.ents) return;
    const until = Date.now() + 10 * 60 * 1000;
    let seen = false;
    const cull = () => {
      const list = dbg.ents.enemies || [];
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e && WARDEN_TYPES.indexOf(e.type) < 0) list.splice(i, 1);
      }
      // Stop the moment the warden is killed, so the next wave plays normally.
      if (list.some((e) => e && WARDEN_TYPES.indexOf(e.type) >= 0)) seen = true;
      if ((seen && !list.length) || !window.SENTINEL_ACTIVE || Date.now() > until) return;
      requestAnimationFrame(cull);
    };
    cull();
  }

  function jumpToBossWave() {
    const dbg = window.__dbg;
    if (!dbg || typeof dbg.gotoWave !== 'function') return false;
    // Deferred, so the wave that is starting finishes wiring itself before the
    // jump: the engine's own wave start then sets up wave 5 — boss included —
    // exactly as it would in a real run.
    setTimeout(() => {
      if (!window.SENTINEL_ACTIVE || !bossRush(window.SENTINEL_CHAPTER)) return;
      dbg.ents.enemies.length = 0;
      dbg.ents.ebullets.length = 0;
      dbg.gotoWave(5);
      keepWardenOnly();
    }, 60);
    return true;
  }

  // ---- Arena ------------------------------------------------------------
  function launchArena(chapterId) {
    const ch = BY_ID[chapterId];
    if (!ch) return;
    window.SENTINEL_ACTIVE = true;
    window.SENTINEL_CHAPTER = chapterId;
    // The Scribe campaign must not think it is running.
    window.STORY_ACTIVE = false;
    window.STORY_REALM = null;
    window.MENU_CONTEXT = 'single';
    window.BOTS_ENABLED = false;
    window.PVP_MODE = false;
    if (window.TEAMS_MODE && window.Teams && window.Teams.reset) window.Teams.reset();
    if (window.CTF_MODE && window.CTF && window.CTF.reset) window.CTF.reset();
    window.TEAMS_MODE = false;
    window.CTF_MODE = false;

    try {
      localStorage.setItem('arenaLevel', String(ch.levelId));
      localStorage.setItem('level', String(ch.levelId));
    } catch (_) {}

    document.querySelectorAll('.overlay').forEach((o) => { o.style.display = 'none'; });

    // Whatever was stoppered in Hollowmere is drunk on the way in.
    drinkPotions();

    if (window._Gauntlet && window._Gauntlet.setThemeById && window._Gauntlet.restart) {
      window._Gauntlet.setThemeById(ch.levelId);
      window._Gauntlet.restart();
      // restart() only clears some panels; sweep the rest so the arena shows.
      document.querySelectorAll('.overlay').forEach((o) => { o.style.display = 'none'; });
      const loading = document.getElementById('overlayLoading');
      if (loading) loading.style.display = 'none';
      return;
    }
    const card = document.querySelector('#levelsGrid [data-level="' + ch.levelId + '"]');
    if (card) {
      window.__sentinelLaunching = true;
      card.click();
      setTimeout(() => { window.__sentinelLaunching = false; }, 60);
    } else document.getElementById('btnRestart')?.click();
  }

  function startChapter(id) {
    const ch = BY_ID[id];
    if (!ch) return;
    window.SENTINEL_CHAPTER = id;
    // Testing run: the first level goes straight in, no intro to sit through.
    if (bossRush(id)) { launchArena(id); return; }
    playCinematic('ch' + id + '-intro', () => launchArena(id));
  }

  // ---- Engine hooks (wired from pve16.js) -------------------------------
  window._onSentinelWave = function (n, themeId) {
    if (!window.SENTINEL_ACTIVE) return;
    const ch = BY_ID[window.SENTINEL_CHAPTER];
    if (!ch) return;
    if (themeId != null && Number(themeId) !== ch.levelId) return;
    // Testing run: the chapter opens on its boss wave.
    if (bossRush(ch.id) && n < 5 && jumpToBossWave()) return;
    setObjective(ch);
    if (n === 5) storyQuest('wave5');
    if (n === 1) {
      speak(ch.open, ch.accent);
      midIdx[ch.id] = 0;
    } else if (n % 5 === 0) {
      speak(ch.bossLine, ch.accent);
    } else {
      const arr = ch.mid || [];
      if (arr.length && (midIdx[ch.id] || 0) < arr.length) {
        speak(arr[midIdx[ch.id]++], ch.accent);
      }
    }
  };

  let resolving = false;
  window._onSentinelBossDefeated = function (chapterId) {
    if (!window.SENTINEL_ACTIVE || resolving) return;
    resolving = true;
    window.SENTINEL_ACTIVE = false;
    hideHUD();
    const id = Number(chapterId) || Number(window.SENTINEL_CHAPTER) || 1;
    const ch = BY_ID[id] || CHAPTERS[0];
    markComplete(id);
    storyQuest('seal');
    if (id === 3) storyQuest('seal3');
    try { if (window.RS) RS.awardWarden(); } catch (_) {}
    try { document.getElementById('btnHome')?.click(); } catch (_) {}

    setTimeout(() => {
      resolving = false;
      document.querySelectorAll('.overlay').forEach((o) => { o.style.display = 'none'; });
      playCinematic('ch' + id + '-outro', () => {
        window.SENTINEL_CHAPTER = null;
        if (id >= CHAPTERS.length) showVigil();
        else showHub();
      });
    }, 120);
  };

  // Public: the React host calls this when its cinematic overlay closes.
  function cinematicDone() {
    if (window.__sentinelResume) window.__sentinelResume();
  }

  // ---- Hub pane ---------------------------------------------------------
  let hubInjected = false;

  function injectHub() {
    if (hubInjected) return;
    hubInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      .storyTabs{display:flex;gap:8px;justify-content:center;margin:0 0 16px;flex-wrap:wrap;}
      .storyTab{padding:9px 20px;border-radius:999px;cursor:pointer;font-weight:800;font-size:13px;
        letter-spacing:.08em;text-transform:uppercase;color:#b9c6de;
        background:linear-gradient(180deg,rgba(20,26,42,.8),rgba(10,14,24,.8));
        border:1px solid rgba(140,170,220,.28);transition:color .2s,border-color .2s,box-shadow .2s,transform .15s;}
      .storyTab:hover{color:#fff;border-color:rgba(180,220,255,.7);transform:translateY(-1px);}
      .storyTab.is-active{color:#fff;border-color:#9fe3ff;box-shadow:0 0 18px rgba(120,190,255,.4),inset 0 0 12px rgba(120,190,255,.16);}
      .storyTab.is-active[data-camp="sentinel"]{border-color:#ffca7a;box-shadow:0 0 18px rgba(255,190,110,.42),inset 0 0 12px rgba(255,190,110,.16);}

      #sentinelBanner{display:none;margin-bottom:14px;padding:10px 16px;border-radius:12px;text-align:center;
        background:linear-gradient(180deg,rgba(46,32,18,.72),rgba(24,18,12,.72));border:1px solid #ffca7a;color:#ffe9cc;font-size:14px;}
      .sentinelSub{text-align:center;opacity:.82;margin:0 0 18px;font-size:14px;line-height:1.45;color:#cfe1ff;}
      #sentinelCast{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:6px;}
      .castCard{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:13px;cursor:pointer;
        background:linear-gradient(180deg,rgba(20,22,34,.86),rgba(10,12,20,.78));
        border:1px solid var(--cc-accent,#46536b);transition:transform .14s,box-shadow .18s,border-color .18s;}
      .castCard:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.5),0 0 18px var(--cc-accent,#46536b);}
      .castCard.is-locked{opacity:.45;cursor:not-allowed;filter:grayscale(.6);}
      .castCard .ccIcon{font-size:20px;line-height:1;filter:drop-shadow(0 0 10px var(--cc-accent,transparent));}
      .castCard .ccName{font-size:13.5px;font-weight:800;color:#eaf4ff;}
      .castCard .ccRole{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--cc-accent,#9fb0c8);opacity:.85;margin-top:2px;}
      .sentinelSection{margin:20px 0 8px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#9fb0c8;font-weight:800;}
      #sentinelCodex{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;}
      .snCodex{border-radius:12px;padding:9px 13px;cursor:pointer;
        background:linear-gradient(180deg,rgba(18,24,34,.86),rgba(9,13,20,.8));
        border:1px solid rgba(150,180,220,.18);transition:border-color .16s,background .16s;}
      .snCodex[open]{border-color:#9fe3ff66;background:rgba(20,30,42,.9);}
      .snCodex summary{font-size:12.5px;font-weight:800;color:#dbe9f8;letter-spacing:.04em;list-style:none;}
      .snCodex summary::-webkit-details-marker{display:none;}
      .snCodex summary::before{content:'▸ ';color:#9fe3ff;opacity:.8;}
      .snCodex[open] summary::before{content:'▾ ';}
      .snCodex div{margin-top:7px;font-size:12.5px;line-height:1.55;color:#b9c9dc;}
      #sentinelVillageCard{display:flex;align-items:center;gap:14px;margin:4px 0 16px;padding:14px 16px;border-radius:14px;cursor:pointer;
        background:linear-gradient(180deg,rgba(24,34,30,.9),rgba(10,16,16,.85));
        border:1px solid #7de0b8;box-shadow:0 0 24px rgba(90,220,180,.16);transition:transform .14s,box-shadow .18s;}
      #sentinelVillageCard:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.5),0 0 26px rgba(90,220,180,.3);}
      #sentinelVillageCard .svcIcon{font-size:26px;filter:drop-shadow(0 0 12px #7de0b8);}
      #sentinelVillageCard .svcName{font-size:14.5px;font-weight:900;color:#eafff6;letter-spacing:.06em;}
      #sentinelVillageCard .svcSub{font-size:11.5px;color:#9fd8c4;line-height:1.45;}
      #sentinelLoreCard{display:flex;align-items:center;gap:14px;margin:4px 0 16px;padding:14px 16px;border-radius:14px;cursor:pointer;
        background:linear-gradient(180deg,rgba(34,28,18,.9),rgba(16,13,9,.85));
        border:1px solid #d8b46a;box-shadow:0 0 24px rgba(216,180,106,.16);transition:transform .14s,box-shadow .18s;}
      #sentinelLoreCard:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.5),0 0 26px rgba(216,180,106,.3);}
      #sentinelLoreCard .svcIcon{font-size:26px;filter:drop-shadow(0 0 12px #e8c88a);}
      #sentinelLoreCard .svcName{font-size:14.5px;font-weight:900;color:#fff4dd;letter-spacing:.06em;}
      #sentinelLoreCard .svcSub{font-size:11.5px;color:#d8c49a;line-height:1.45;}

      #overlaySentinelTalk{position:fixed;inset:0;z-index:56;display:none;place-items:center;
        background:radial-gradient(1000px 560px at 50% 0%,rgba(255,190,110,.1),rgba(4,6,12,.95) 70%);}
      #snTalkCard{width:min(760px,95vw);max-height:90vh;overflow:auto;padding:26px 28px;border-radius:20px;
        background:rgba(10,13,22,.94);border:1px solid var(--sn-accent,#ffca7a);
        box-shadow:0 22px 60px rgba(0,0,0,.62),0 0 40px var(--sn-accent,#ffca7a);}
      #snTalkHead{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
      #snTalkIcon{font-size:30px;filter:drop-shadow(0 0 12px var(--sn-accent,#ffca7a));}
      #snTalkName{font-size:19px;font-weight:900;color:#f2f7ff;letter-spacing:.02em;}
      #snTalkRole{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--sn-accent,#ffca7a);opacity:.9;}
      #snTalkBody{display:flex;flex-direction:column;gap:9px;margin-bottom:14px;}
      .snLine{padding:10px 14px;border-radius:11px;font-size:14px;line-height:1.5;color:#e2ebf7;
        background:linear-gradient(180deg,rgba(22,26,40,.85),rgba(12,15,24,.8));border:1px solid rgba(150,180,220,.16);}
      .snLine.isYou{background:linear-gradient(180deg,rgba(46,36,20,.8),rgba(26,20,12,.8));
        border-color:rgba(255,202,122,.34);color:#ffe9cc;font-style:italic;}
      .snLine .snWho{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;
        color:var(--sn-accent,#ffca7a);opacity:.9;margin-bottom:3px;font-weight:800;}
      .snTopic{display:block;width:100%;text-align:left;padding:10px 14px;border-radius:11px;cursor:pointer;
        font-size:13.5px;font-weight:700;color:#d7e6f7;background:rgba(255,255,255,.045);
        border:1px solid rgba(150,180,220,.2);transition:background .16s,border-color .16s,transform .12s;}
      .snTopic:hover{background:rgba(255,255,255,.1);border-color:var(--sn-accent,#ffca7a);transform:translateX(2px);}
      .snChoice{display:block;width:100%;text-align:left;padding:11px 14px;border-radius:11px;cursor:pointer;
        font-size:13.5px;font-weight:700;color:#fff;background:linear-gradient(180deg,rgba(40,32,20,.9),rgba(22,18,12,.9));
        border:1px solid rgba(255,202,122,.4);transition:transform .12s,box-shadow .18s;}
      .snChoice:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(255,190,110,.3);}
      .snChoice.is-picked{border-color:#9fe3ff;box-shadow:0 0 0 1px #9fe3ff inset;opacity:.85;}

      #overlaySentinelVigil{position:fixed;inset:0;z-index:57;display:none;place-items:center;background:rgba(3,4,9,.965);}
      #vigilCard{width:min(680px,94vw);padding:32px;text-align:center;border-radius:22px;
        background:rgba(10,13,22,.94);border:1px solid rgba(208,160,255,.4);box-shadow:0 0 60px rgba(180,120,255,.3);}
      #vigilCard h2{margin:0 0 6px;font-size:23px;letter-spacing:.08em;text-transform:uppercase;color:#f4eaff;text-shadow:0 0 22px rgba(200,140,255,.6);}
      #vigilLean{margin:0 0 18px;font-size:13px;color:#cbb6e8;line-height:1.5;}
      .vigilChoice{display:block;width:100%;margin:9px 0;padding:14px 16px;border-radius:13px;cursor:pointer;text-align:left;
        background:linear-gradient(180deg,rgba(30,24,48,.9),rgba(16,14,30,.9));border:1px solid rgba(208,160,255,.36);color:#eaf4ff;
        font-size:15px;font-weight:800;transition:transform .12s,box-shadow .18s;}
      .vigilChoice:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(192,102,255,.36);}
      .vigilChoice .vcSub{display:block;margin-top:4px;font-size:12px;font-weight:500;opacity:.75;line-height:1.45;}`;
    document.head.appendChild(style);

    const talk = document.createElement('div');
    talk.id = 'overlaySentinelTalk';
    talk.innerHTML = `
      <div id="snTalkCard">
        <div id="snTalkHead">
          <div id="snTalkIcon">🕯️</div>
          <div>
            <div id="snTalkName">Ilyra</div>
            <div id="snTalkRole">Keeper</div>
          </div>
        </div>
        <div id="snTalkBody"></div>
        <div class="row" style="justify-content:flex-end;">
          <button class="btn" id="snTalkClose">Leave</button>
        </div>
      </div>`;
    document.body.appendChild(talk);
    document.getElementById('snTalkClose').addEventListener('click', closeTalk);

    const vigil = document.createElement('div');
    vigil.id = 'overlaySentinelVigil';
    vigil.innerHTML = `
      <div id="vigilCard">
        <h2>The Last Vigil</h2>
        <p id="vigilLean"></p>
        <div id="vigilChoices"></div>
      </div>`;
    document.body.appendChild(vigil);
  }

  // ---- Tabs -------------------------------------------------------------
  function bindTabs() {
    const tabs = document.getElementById('storyTabs');
    if (!tabs || tabs.dataset.bound === '1') return;
    tabs.dataset.bound = '1';
    tabs.addEventListener('click', (event) => {
      const btn = event.target.closest('.storyTab');
      if (!btn) return;
      selectTab(btn.dataset.camp);
    });
  }

  function selectTab(camp) {
    const tabs = document.getElementById('storyTabs');
    if (tabs) {
      tabs.querySelectorAll('.storyTab').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.camp === camp);
      });
    }
    const scribe = document.getElementById('campScribe');
    const sentinel = document.getElementById('campSentinel');
    if (scribe) scribe.style.display = camp === 'scribe' ? '' : 'none';
    if (sentinel) sentinel.style.display = camp === 'sentinel' ? '' : 'none';
    if (camp === 'sentinel') {
      build();
      maybePlayPrologue();
    }
  }

  // ---- Campaign pane ----------------------------------------------------
  function build() {
    injectHub();
    // The campaign tab strip lives in the First Scribe hub markup, which is only
    // injected the first time the story opens — long after init() ran. Binding
    // here means the second campaign's tab always answers a click.
    bindTabs();
    const host = document.getElementById('sentinelPane');
    if (!host) return;
    const p = load();

    const rows = CHAPTERS.map((ch) => {
      const unlocked = p.unlocked.indexOf(ch.id) >= 0;
      const done = p.completed.indexOf(ch.id) >= 0;
      const state = done ? '✓ Chapter complete' : unlocked ? '▸ Begin chapter' : '🔒 Sealed';
      const choice = p.choices['ch' + ch.id];
      const chosen = choice && ENDINGS[choice] ? '<div class="srState" style="color:' + ENDINGS[choice].accent + '">◆ ' + ENDINGS[choice].name + '</div>' : '';
      return `<div class="storyRealm ${unlocked ? '' : 'locked'} ${done ? 'done' : ''}" data-sentinel="${ch.id}" style="--sr-accent:${ch.accent}">
        <div class="srGlow"></div>
        <div class="srIcon">${unlocked ? ch.icon : '🔒'}</div>
        <div class="srName">${unlocked ? ch.id + '. ' + ch.name : '??? Chapter ' + ch.id}</div>
        <div class="srObj">${unlocked ? 'Objective · ' + ch.objective : 'Unknown objective'}</div>
        <div class="srBoss">${unlocked ? 'Warden: ' + ch.boss + ' · ' + ch.protocol : 'Unknown warden'}</div>
        <div class="srLore">${unlocked ? ch.lore : 'Complete the previous chapter to reveal this one.'}</div>
        <div class="srState">${state}</div>
        ${chosen}
      </div>`;
    }).join('');

    const completed = p.completed.length;
    const castCards = CAST.map((c) => {
      const open = completed >= c.unlock;
      return `<div class="castCard ${open ? '' : 'is-locked'}" data-cast="${c.id}" style="--cc-accent:${c.accent}">
        <div class="ccIcon">${open ? c.icon : '🔒'}</div>
        <div>
          <div class="ccName">${open ? c.name : '???'}</div>
          <div class="ccRole">${open ? c.role : 'Complete ' + c.unlock + ' chapter' + (c.unlock === 1 ? '' : 's')}</div>
        </div>
      </div>`;
    }).join('');

    const endingBanner = p.ending && ENDINGS[p.ending]
      ? '<div id="sentinelBanner" style="display:block;border-color:' + ENDINGS[p.ending].accent + '">★ The vigil is over — you chose <b>' + ENDINGS[p.ending].name + '</b>. Replay any chapter or speak with the cast.</div>'
      : completed >= CHAPTERS.length
        ? '<div id="sentinelBanner" style="display:block">★ Every seal is broken. The Sentinel is waiting at the Crown — enter the Vigil when you are ready.</div>'
        : '<div id="sentinelBanner"></div>';

    // The Covenant was cut into folios and each folio was bound into a seal:
    // the lore book fills one page per chapter, so progress and book agree.
    const lorePages = window.SENTINEL_LORE ? window.SENTINEL_LORE.count(p) : 0;
    const loreTotal = window.SENTINEL_LORE ? window.SENTINEL_LORE.PAGES.length : 7;

    host.innerHTML = `
      <h2>Age of the Sentinel</h2>
      <p class="sentinelSub">Nine scribes survived the first Unwriting and called themselves wardens. They cut the <b>Covenant of Stillness</b> — hold the world, put back what drifts, and one day let go — then built a guardian around the Lodestone Heart and gave it the first two orders. The third was never finished. Three hundred years later every realm is a <b>Still Day</b>: a festival, a tide, a falling leaf, held open. Break the five seals, find the sentence the ninth warden never wrote, and decide what a world is for.</p>
      ${endingBanner}
      <div id="sentinelVillageCard" role="button" tabindex="0">
        <div class="svcIcon">🏘️</div>
        <div>
          <div class="svcName">Walk to Hollowmere</div>
          <div class="svcSub">The village on the Hearth Road — drawn after the last seal was numbered, so the Sentinel has never seen it. Find the cast in person and talk to them.</div>
        </div>
      </div>
      <div class="storyGrid" id="sentinelGrid">${rows}</div>
      <div class="sentinelSection">Villagers of Hollowmere</div>
      <div id="sentinelCast">${castCards}</div>
      <div class="sentinelSection">The Scribe\u2019s Book</div>
      <div id="sentinelLoreCard" role="button" tabindex="0">
        <div class="svcIcon">📖</div>
        <div>
          <div class="svcName">Open the lore book</div>
          <div class="svcSub">${lorePages} of ${loreTotal} pages recovered — the folios bound into each seal, and your own notes in the margin.</div>
        </div>
      </div>
      <div class="row" style="margin-top:18px;justify-content:center;flex-wrap:wrap;">
        <button class="btn" id="sentinelVigilBtn" ${completed >= CHAPTERS.length ? '' : 'disabled'} style="opacity:${completed >= CHAPTERS.length ? 1 : .45}">🕯️ Enter the Vigil</button>
        <button class="btn" id="sentinelResetBtn" title="Clear Age of the Sentinel progress">🔄 Reset Campaign</button>
      </div>`;

    host.querySelectorAll('[data-sentinel]').forEach((card) => {
      const id = Number(card.dataset.sentinel);
      if (p.unlocked.indexOf(id) < 0) return;
      card.addEventListener('click', () => startChapter(id));
    });

    const loreCard = host.querySelector('#sentinelLoreCard');
    if (loreCard) {
      const openBook = () => {
        if (window.SENTINEL_LORE) window.SENTINEL_LORE.open(load());
      };
      loreCard.addEventListener('click', openBook);
      loreCard.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openBook();
        }
      });
    }
    host.querySelectorAll('[data-cast]').forEach((card) => {
      const persona = CAST.find((c) => c.id === card.dataset.cast);
      if (!persona || completed < persona.unlock) return;
      // Cards hand the player a walk to that villager rather than a flat card.
      card.addEventListener('click', () => openVillage(persona.id));
    });

    const villageCard = document.getElementById('sentinelVillageCard');
    if (villageCard) {
      const enter = () => openVillage(null);
      villageCard.addEventListener('click', enter);
      villageCard.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); enter(); }
      });
    }

    const vigilBtn = document.getElementById('sentinelVigilBtn');
    if (vigilBtn) {
      vigilBtn.addEventListener('click', () => {
        if (load().completed.length >= CHAPTERS.length) showVigil();
      });
    }
    const resetBtn = document.getElementById('sentinelResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!confirm('Reset Age of the Sentinel? Chapter progress, choices and the ending will be cleared. The Last Scribe is not affected.')) return;
        try { localStorage.removeItem(KEY); } catch (_) {}
        build();
      });
    }
  }

  // ---- Conversations ----------------------------------------------------
  let openPersonaId = null;

  function openTalk(personaId) {
    injectHub();
    const persona = CAST.find((c) => c.id === personaId);
    if (!persona) return;
    openPersonaId = personaId;
    const overlay = document.getElementById('overlaySentinelTalk');
    if (!overlay) return;
    overlay.style.setProperty('--sn-accent', persona.accent);
    document.getElementById('snTalkIcon').textContent = persona.icon;
    document.getElementById('snTalkName').textContent = persona.name;
    document.getElementById('snTalkRole').textContent = persona.role;
    renderTopics(persona);
    document.querySelectorAll('.overlay').forEach((o) => { if (o.id !== 'overlaySentinelTalk') o.style.display = 'none'; });
    overlay.style.display = 'grid';
  }

  function closeTalk() {
    const overlay = document.getElementById('overlaySentinelTalk');
    if (overlay) overlay.style.display = 'none';
    openPersonaId = null;
    // Back to the campaign hub, on the Sentinel tab.
    const p = document.getElementById('overlayStory');
    if (p) {
      p.style.display = 'grid';
      selectTab('sentinel');
    }
  }

  function renderTopics(persona) {
    const body = document.getElementById('snTalkBody');
    if (!body) return;
    const p = load();
    const lines = [`<div class="snLine"><span class="snWho">${persona.name}</span>${persona.intro}</div>`];
    const topics = persona.topics.map((t) => {
      const answered = p.talks[t.id];
      return `<button class="snTopic" data-topic="${t.id}">${answered ? '◆' : '▸'} ${t.label}</button>`;
    }).join('');
    body.innerHTML = lines.join('') + topics;
    body.querySelectorAll('[data-topic]').forEach((btn) => {
      btn.addEventListener('click', () => renderTopic(persona, btn.dataset.topic));
    });
  }

  function renderTopic(persona, topicId) {
    const topic = persona.topics.find((t) => t.id === topicId);
    const body = document.getElementById('snTalkBody');
    if (!topic || !body) return;
    const p = load();
    const picked = p.talks[topic.id];

    let html = `<button class="snTopic" data-back="1">‹ All topics</button>`;
    topic.lines.forEach((line) => {
      html += `<div class="snLine"><span class="snWho">${line.who || persona.name}</span>${line.text}</div>`;
    });

    if (picked && topic.choices) {
      const chosen = topic.choices.find((c) => c.value === picked);
      if (chosen) {
        html += `<div class="snLine isYou">${chosen.label}</div>`;
        (chosen.reply || []).forEach((line) => {
          html += `<div class="snLine"><span class="snWho">${line.who || persona.name}</span>${line.text}</div>`;
        });
      }
    } else if (topic.choices) {
      topic.choices.forEach((choice, i) => {
        html += `<button class="snChoice" data-choice="${i}">${choice.label}</button>`;
      });
    }

    body.innerHTML = html;

    const back = body.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => renderTopics(persona));

    body.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const choice = topic.choices[Number(btn.dataset.choice)];
        if (!choice) return;
        const prog = load();
        prog.talks[topic.id] = choice.value;
        prog.choices['talk-' + topic.id] = choice.value;
        save(prog);
        renderTopic(persona, topic.id);
      });
    });
  }

  // ---- Prologue ---------------------------------------------------------
  function maybePlayPrologue() {
    const p = load();
    if (p.prologueSeen) return;
    p.prologueSeen = true;
    save(p);
    playCinematic('prologue', () => {});
  }

  // ---- Ending -----------------------------------------------------------
  function showVigil() {
    injectHub();
    const { lean, tally } = endingLean();
    const card = document.getElementById('vigilChoices');
    const leanLine = document.getElementById('vigilLean');
    if (leanLine) {
      leanLine.innerHTML =
        'Every choice you made at the seals is counted. Your record leans toward <b style="color:' +
        ENDINGS[lean].accent + '">' + ENDINGS[lean].name + '</b> ' +
        '(preserve ' + tally.keep + ' · rewrite ' + tally.rewrite + ' · release ' + tally.release + '). ' +
        'The final word is still yours.';
    }
    if (card) {
      card.innerHTML = Object.keys(ENDINGS).map((key) => {
        const e = ENDINGS[key];
        return `<button class="vigilChoice" data-end="${key}" style="border-color:${e.accent}66">
          ${e.icon} ${e.name}${key === lean ? ' <span style="opacity:.6;font-size:11px;letter-spacing:.12em">· YOUR RECORD</span>' : ''}
          <span class="vcSub">${e.blurb}</span></button>`;
      }).join('');
      card.querySelectorAll('[data-end]').forEach((btn) => {
        btn.addEventListener('click', () => chooseEnding(btn.dataset.end));
      });
    }
    document.querySelectorAll('.overlay').forEach((o) => { o.style.display = 'none'; });
    const overlay = document.getElementById('overlaySentinelVigil');
    if (overlay) overlay.style.display = 'grid';
  }

  function chooseEnding(key) {
    const overlay = document.getElementById('overlaySentinelVigil');
    if (overlay) overlay.style.display = 'none';
    const p = load();
    p.ending = key;
    p.final = key;
    save(p);
    playCinematic('end-' + key, () => showHub());
  }

  // ---- Hub --------------------------------------------------------------
  function showHub() {
    hideHUD();
    window.SENTINEL_ACTIVE = false;
    window.SENTINEL_CHAPTER = null;
    build();
    document.querySelectorAll('.overlay').forEach((o) => { o.style.display = 'none'; });
    const ov = document.getElementById('overlayStory');
    if (ov) {
      ov.style.display = 'grid';
      selectTab('sentinel');
    }
  }

  // ---- Engine hooks (no engine edits) -----------------------------------
  function installEngineHooks() {
    // The engine announces every wave through _onStoryWave. Wrapping it lets
    // both campaigns hear the same event without touching the engine.
    const scribeWave = window._onStoryWave;
    window._onStoryWave = function (n, themeId) {
      if (scribeWave) { try { scribeWave(n, themeId); } catch (_) {} }
      if (window._onSentinelWave) { try { window._onSentinelWave(n, themeId); } catch (_) {} }
    };

    // A boss wave is cleared when the engine opens its glyph choice: the boss
    // is down and nothing else is standing. That is the chapter won.
    const glyphs = document.getElementById('overlayGlyphs');
    if (glyphs && !glyphs.dataset.sentinelWatch) {
      glyphs.dataset.sentinelWatch = '1';
      new MutationObserver(() => {
        if (!window.SENTINEL_ACTIVE) return;
        if (!glyphs.style.display || glyphs.style.display === 'none') return;
        const wave = typeof window.__pveWave === 'function' ? Number(window.__pveWave()) : 0;
        if (wave >= 5 && wave % 5 === 0) window._onSentinelBossDefeated(window.SENTINEL_CHAPTER);
      }).observe(glyphs, { attributes: true, attributeFilter: ['style'] });
    }

    // Choosing a normal match abandons the chapter, so no objective, dialogue
    // or chapter-end can ever leak into a standard game.
    const abandon = () => {
      if (!window.SENTINEL_ACTIVE || window.__sentinelLaunching) return;
      window.SENTINEL_ACTIVE = false;
      window.SENTINEL_CHAPTER = null;
      hideHUD();
    };
    ['btnIntroSingle', 'btnIntroOffline', 'btnIntroMulti'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', abandon, true);
    });
    const grid = document.getElementById('levelsGrid');
    if (grid) grid.addEventListener('click', abandon, true);
  }

  function init() {
    injectHub();
    bindTabs();
    installEngineHooks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SentinelStory = {
    build,
    showHub,
    startChapter,
    cinematicDone,
    showVigil,
    openVillage,
    villageDone,
    isUnlocked,
    isCompleted,
    endingLean,
    hideHUD,
    CHAPTERS,
    CAST,
    ENDINGS,
    CODEX
  };
})();
