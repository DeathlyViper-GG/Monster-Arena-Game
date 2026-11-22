/* =====================================================================
   avatar_style.js — the fighter's colours and models.

   One table shared by the arena (avatar_model.js) and the Customise preview
   (ball_skins.js, drawn by customize_ui.js), so the orb tinted in the menu is
   exactly the orb that walks into the arena.

   COLORS keeps the original seven: the saved slot ('color') holds an index
   into this list, so every existing save, lobby join and bot still works.
   ===================================================================== */
(function (G) {
  'use strict';

  const COLORS = [
    { key: 'blue', name: 'Blue Core', c: '#98d7ff', a: '#98d7ff' },
    { key: 'red', name: 'Red Inferno', c: '#ff7666', a: '#ff7666' },
    { key: 'green', name: 'Toxic Green', c: '#7dffa3', a: '#7dffa3' },
    { key: 'gold', name: 'Golden Alloy', c: '#ffdf66', a: '#ffdf66' },
    { key: 'purple', name: 'Void Purple', c: '#c066ff', a: '#c066ff' },
    { key: 'white', name: 'Ice White', c: '#e8f7ff', a: '#e8f7ff' },
    { key: 'magma', name: 'Magma Orange', c: '#ff9a3c', a: '#ff9a3c' }
  ];

  const MODELS = [
    { id: 0, name: 'Basic', theme: 'arcane', effect: 'ring', blurb: 'A pulse ring orbiting the shell.' },
    { id: 1, name: 'Spiked Shell', theme: 'arcane', effect: 'spikes', blurb: 'A crown of bone spikes round the top of the ball.' },
    { id: 2, name: 'Toothy Maw', theme: 'arcane', effect: 'maw', blurb: 'A ring of fangs turning slowly around the shell.' },
    { id: 3, name: 'Hex Armor', theme: 'sci-fi', effect: 'hex', blurb: 'Three hex bands wrapping the ball at different angles.' },
    { id: 4, name: 'Cyber Halo', theme: 'sci-fi', effect: 'halo', blurb: 'A lit ring turning above the sphere.' },
    { id: 5, name: 'Void Flame', theme: 'arcane', effect: 'voidflame', blurb: 'Violet motes drifting off the shell.' },
    { id: 6, name: 'Crystal Shards', theme: 'arcane', effect: 'shards', blurb: 'Six crystal splinters circling the body.' },
    { id: 7, name: 'Nano-Arms', theme: 'sci-fi', effect: 'nanoarms', blurb: 'Three green limbs sweeping round the sphere.' },
    { id: 8, name: 'Plasma Horns', theme: 'sci-fi', effect: 'horns', blurb: 'A pair of hot horns sweeping back off the shell.' },
    { id: 9, name: 'Tri-Blade Wheel', theme: 'sci-fi', effect: 'blades', blurb: 'Three blades spinning round the waist of the ball.' },
    { id: 10, name: 'Angel Wings', theme: 'arcane', effect: 'wings', wing: 'angel', blurb: 'Feather wings unfurl behind the sphere and beat softly.' },
    { id: 11, name: 'Cyber Wings', theme: 'sci-fi', effect: 'wings', wing: 'cyber', blurb: 'Hard-light blades hinge open behind the shell.' },
    { id: 12, name: 'Void Wings', theme: 'arcane', effect: 'wings', wing: 'void', blurb: 'Torn wings of void, trailing sparks with every beat.' },
    { id: 13, name: 'Fire Wings', theme: 'arcane', effect: 'wings', wing: 'fire', blurb: 'Wings of sheet flame that flare wider on each beat.' },
    { id: 14, name: 'Insect Wings', theme: 'arcane', effect: 'wings', wing: 'insect', blurb: 'Chitin wings beating fast enough to blur.' }
  ];

  const byHex = {};
  COLORS.forEach((f, i) => { byHex[f.c.toLowerCase()] = i; });

  function indexFor(hex) {
    const i = byHex[String(hex || '').toLowerCase()];
    return i === undefined ? 0 : i;
  }

  // Anything that is not one of the seven (an old save, a net peer on a
  // different build) still gets a lit ball, tinted by whatever it sent.
  function colorFor(hex) {
    const f = COLORS[indexFor(hex)];
    if (!hex || String(hex).toLowerCase() === f.c.toLowerCase()) return f;
    return { key: 'custom', name: 'Custom', c: hex, a: hex };
  }

  const modelFor = (id) => MODELS[id | 0] || MODELS[0];

  G.AvatarStyle = {
    COLORS,
    CLOTHES: COLORS,        // older call sites still ask for the palettes
    MODELS,
    indexFor,
    colorFor,
    outfitFor: colorFor,
    modelFor,
    heightFor: (r) => (r || 16) * 4
  };
})(window);
