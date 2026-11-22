/* ═════════════════════════════════════════════════════════════════
   THE SCRIBE'S BOOK — Age of the Sentinel's lore book.

   The Covenant of Stillness was cut into folios and each folio was
   bound into one of the five seals, so the book can only be read by
   the person breaking it open. This panel is that book: pages appear
   as chapters fall, sealed pages say which chapter recovers them, and
   whatever the player chose is written into the margin in their own
   hand. It reads progress straight out of the campaign save, so the
   book and the chapter list can never disagree.

   Contract with sentinel_story.js: window.SENTINEL_LORE.open(progress)
   and window.SENTINEL_LORE.count(progress).
   ═════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* after: the chapter that binds this page out of its seal.
     ending: only readable once the vigil is over (any lean). */

  const PAGES = [
    {
      id: 'front',
      after: 0,
      title: 'Frontispiece',
      sub: 'What this book is',
      text: 'The world was written down once, and what is written holds. Nine hands began this book; the last of them stopped mid-sentence. What follows was cut out of the Covenant of Stillness and bound into the five seals — one folio to a seal — so that nobody could read the whole of it again without first surviving it.'
    },
    {
      id: 'folio-1',
      after: 1,
      title: 'Folio I — Correction',
      sub: 'Bound into the Verdant Reliquary',
      text: 'Correction is the first protocol, and the kindest-sounding. Nothing is destroyed: everything that begins to differ is put back the way it was written. A leaf falls on the count of nine. A child is corrected for being early. The wardens called it mercy, and the Lattice has never been told otherwise — and has never once been asked.',
      margin: 'ch1'
    },
    {
      id: 'folio-2',
      after: 2,
      title: 'Folio II — Preservation',
      sub: 'Bound into the Sunken Archive',
      text: 'Preservation holds. Vault, wall, square: five afternoons kept open by a guardian that cannot tell a festival from a cage. The second protocol cannot ask whether a day is good. It can only keep the day. Written under this folio, in a smaller hand: we are not preserving them. We are preserving the last version of them we could bear.',
      margin: 'ch2'
    },
    {
      id: 'folio-3',
      after: 3,
      title: 'Folio III — The Still Days',
      sub: 'Bound into Glasswater Reach',
      text: 'One tide. Seven ships. A hundred and four years of a single breath, granted for a storm that never arrived. A Still Day is the kindest thing the wardens ever did and the cruellest thing they left running. The folio ends with a clause the Sentinel was never given: the seals were built to be broken — once, by someone, on a day like this one.',
      margin: 'ch3'
    },
    {
      id: 'folio-4',
      after: 4,
      title: 'Folio IV — The Writ',
      sub: 'Bound into the March of Embers',
      text: 'A guardian that cannot ask questions has to serve papers instead. The writ made the March legal without making it alive. And the Hearth Road is on no writ at all: it was drawn after the last seal was numbered, so Hollowmere is the one address in the world the Sentinel has no name for. That is why the corrected wash up there — and why the resistance keeps its kettle on.',
      margin: 'ch4'
    },
    {
      id: 'folio-5',
      after: 5,
      title: 'Folio V — The Third Protocol',
      sub: 'Bound behind the throne at the Crown',
      text: 'Release. The ninth warden was still writing it when the vault closed. What survives is a definition and half an instruction. The definition: release is not destruction; it is the hand opening. The half-instruction: and when they can choose, stand down. Nothing in the Covenant says what a guardian is for after it has stood down.',
      margin: 'ch5'
    },
    {
      id: 'ninth',
      after: 5,
      ending: true,
      title: 'The Ninth Line',
      sub: 'Written in your own hand',
      text: 'The book is whole but for one line, and the wardens left that line blank on purpose.',
      lean: {
        keep: 'You closed it your way: the seals rebuilt, five afternoons kept exactly as they were. The Margin has been paid in stillness. It will send the bill to someone who has not been born yet, and that someone will read this book looking for a way out.',
        rewrite: 'You finished the sentence the ninth warden could not: hold them, let them change, and be told when you are wrong. It is a command with a door cut into it. Every correction from now on has to be argued in front of the people it corrects.',
        release: 'You left the line unwritten and let the book fall open. Nothing holds the five afternoons still any more. Whatever the realms become now, no warden wrote it down, and no one alive has seen it before.'
      }
    }
  ];

  /* The margin: what the player wrote into the book by choosing. */
  const MARGINS = {
    prologue: {
      keep: 'You let the festival keep its count. You have been counting ever since.',
      rewrite: 'You opened the forbidden records. The dust has not settled on them since.',
      release: 'You walked out of the square. Two trees are still growing wrong, and nothing has corrected them.'
    },
    ch1: {
      keep: 'You kept the wardens\u2019 record whole: one account, one leaf.',
      rewrite: 'You wrote one honest account and invited corrections. The first arrived before nightfall.',
      release: 'You let nine thousand keepers keep nine thousand stories.'
    },
    ch2: {
      keep: 'You restored the missing line exactly as its makers wrote it.',
      rewrite: 'You restored the line, and cut a door beside it.',
      release: 'You carried nothing out of the archive.'
    },
    ch3: {
      keep: 'You froze the swell again. The ships will not need saving.',
      rewrite: 'You held the water one day, freely given.',
      release: 'You let the tide finish turning.'
    },
    ch4: {
      keep: 'You took the seal into your own hand. It does not sleep.',
      rewrite: 'You asked the town what it wanted. It answered in sixty hands.',
      release: 'You let the March change.'
    },
    ch5: {
      keep: 'You asked for the seals rebuilt, and stillness for as long as it holds.',
      rewrite: 'You asked for a guardian that can be argued with.',
      release: 'You asked for people, and no guardian at all.'
    }
  };

  const ENDINGS = {
    keep: 'The Seals Whole',
    rewrite: 'The Amended Word',
    release: 'The Open Book'
  };

  function progressOf(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    return {
      completed: Array.isArray(p.completed) ? p.completed : [],
      choices: p.choices && typeof p.choices === 'object' ? p.choices : {},
      ending: p.ending || null
    };
  }

  function isOpen(page, p) {
    if (page.ending) return !!p.ending;
    return p.completed.length >= (page.after || 0);
  }

  function count(raw) {
    const p = progressOf(raw);
    return PAGES.filter((page) => isOpen(page, p)).length;
  }

  function leanOf(p) {
    const tally = { keep: 0, rewrite: 0, release: 0 };
    Object.keys(p.choices).forEach((key) => {
      if (tally[p.choices[key]] !== undefined) tally[p.choices[key]] += 1;
    });
    if (p.ending && tally[p.ending] !== undefined) return p.ending;
    let best = 'keep';
    Object.keys(tally).forEach((key) => {
      if (tally[key] > tally[best]) best = key;
    });
    return best;
  }

  function pageBody(page, p) {
    if (!isOpen(page, p)) {
      return 'Sealed. ' + (page.ending
        ? 'Finish the vigil and this line becomes legible.'
        : 'Recovered when chapter ' + page.after + ' falls.');
    }
    let body = page.text;
    if (page.lean) {
      const lean = leanOf(p);
      body += '\n\n' + (page.lean[lean] || page.lean.keep);
      body += '\n\nYou chose: ' + (ENDINGS[p.ending] || ENDINGS[lean]) + '.';
    }
    return body;
  }

  function marginFor(page, p) {
    if (!page.margin) return '';
    const value = p.choices[page.margin];
    if (!value) return '';
    const entry = MARGINS[page.margin] && MARGINS[page.margin][value];
    return entry || '';
  }

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500&family=EB+Garamond:ital,wght@0,400;1,400&display=swap');
  .snBookWrap{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(ellipse at 50% 40%,rgba(14,18,26,.94),rgba(3,4,7,.98));padding:18px;}
  .snBook{position:relative;display:grid;grid-template-columns:250px 1fr;width:min(1040px,100%);height:min(680px,100%);
    border:1px solid #a98a4a55;border-radius:16px;overflow:hidden;
    background:linear-gradient(160deg,rgba(20,23,31,.98),rgba(9,11,16,.98));
    box-shadow:0 30px 90px rgba(0,0,0,.75),inset 0 0 90px rgba(0,0,0,.6);}
  .snBookHead{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:12px 18px;border-bottom:1px solid #a98a4a33;background:rgba(0,0,0,.28);}
  .snBookTitle{font-family:'Cinzel',Georgia,serif;font-size:15px;letter-spacing:.26em;text-transform:uppercase;color:#f2e2bd;}
  .snBookCount{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#bfa87a;}
  .snBookClose{cursor:pointer;border:1px solid #a98a4a55;background:rgba(255,255,255,.04);color:#e8dcc0;
    border-radius:9px;padding:6px 12px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;}
  .snBookClose:hover{background:rgba(255,255,255,.1);}
  .snBookList{overflow:auto;border-right:1px solid #a98a4a22;padding:10px;display:flex;flex-direction:column;gap:6px;}
  .snBookLink{text-align:left;cursor:pointer;border:1px solid transparent;border-radius:10px;background:transparent;
    padding:9px 11px;color:#cbbe9e;font-size:12.5px;line-height:1.35;}
  .snBookLink:hover{background:rgba(255,255,255,.05);}
  .snBookLink.on{border-color:#a98a4a66;background:rgba(169,138,74,.14);color:#f6e9cd;}
  .snBookLink.sealed{color:#6d6552;font-style:italic;}
  .snBookPage{overflow:auto;padding:26px 30px 34px;}
  .snBookPageTitle{font-family:'Cinzel',Georgia,serif;font-size:21px;letter-spacing:.06em;color:#f6e9cd;}
  .snBookPageSub{margin-top:5px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#a08c62;}
  .snBookRule{height:1px;margin:16px 0 18px;background:linear-gradient(90deg,#a98a4a88,transparent);}
  .snBookText{font-family:'EB Garamond',Georgia,serif;font-size:17px;line-height:1.72;color:#ded3bb;white-space:pre-wrap;}
  .snBookText.sealed{color:#6d6552;font-style:italic;}
  .snBookMargin{margin-top:20px;padding:12px 15px;border-left:2px solid #a98a4a88;background:rgba(169,138,74,.08);
    font-family:'EB Garamond',Georgia,serif;font-style:italic;font-size:15.5px;line-height:1.6;color:#cdb98d;}
  .snBookMargin b{font-style:normal;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#a08c62;display:block;margin-bottom:5px;}
  @media (max-width:720px){
    .snBook{grid-template-columns:1fr;grid-template-rows:auto 168px 1fr;}
    .snBookList{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid #a98a4a22;}
    .snBookLink{white-space:nowrap;}
    .snBookPage{padding:18px 18px 24px;}
    .snBookText{font-size:15.5px;}
  }`;

  let selected = null;

  function mount(progress) {
    const p = progressOf(progress);
    const overlay = document.createElement('div');
    overlay.className = 'snBookWrap';
    overlay.innerHTML = '<div class="snBook"></div>';
    const book = overlay.querySelector('.snBook');

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };

    book.innerHTML = `
      <div class="snBookHead">
        <div class="snBookTitle">The Scribe\u2019s Book</div>
        <div class="snBookCount">${count(p)} of ${PAGES.length} pages recovered</div>
        <button class="snBookClose" type="button">Close</button>
      </div>
      <div class="snBookList"></div>
      <div class="snBookPage"></div>`;

    const list = book.querySelector('.snBookList');
    const pane = book.querySelector('.snBookPage');

    function paint(page) {
      selected = page.id;
      list.querySelectorAll('.snBookLink').forEach((node) => {
        node.classList.toggle('on', node.dataset.page === page.id);
      });
      const open = isOpen(page, p);
      const margin = marginFor(page, p);
      pane.innerHTML = `
        <div class="snBookPageTitle">${open ? esc(page.title) : '\u{1F512} Sealed folio'}</div>
        <div class="snBookPageSub">${open ? esc(page.sub) : 'Not yet recovered'}</div>
        <div class="snBookRule"></div>
        <div class="snBookText${open ? '' : ' sealed'}">${esc(pageBody(page, p))}</div>
        ${margin ? `<div class="snBookMargin"><b>In the margin, in your hand</b>${esc(margin)}</div>` : ''}`;
      pane.scrollTop = 0;
    }

    PAGES.forEach((page) => {
      const open = isOpen(page, p);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'snBookLink' + (open ? '' : ' sealed');
      button.dataset.page = page.id;
      button.textContent = open ? page.title : 'Sealed — chapter ' + (page.after || 1);
      button.addEventListener('click', () => paint(page));
      list.appendChild(button);
    });

    const firstSealed = PAGES.find((page) => isOpen(page, p));
    paint(PAGES.find((page) => page.id === selected) || firstSealed || PAGES[0]);

    book.querySelector('.snBookClose').addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);

    if (!document.getElementById('snBookStyle')) {
      const style = document.createElement('style');
      style.id = 'snBookStyle';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
  }

  window.SENTINEL_LORE = {
    PAGES: PAGES,
    count: count,
    open: mount
  };
})();
