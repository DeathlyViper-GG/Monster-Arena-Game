use strict;
use warnings;
local $/ = undef;
my $file = $ARGV[0];
open my $fh, '<', $file or die "open $file: $!";
my $s = <$fh>; close $fh;

my @edits = (
[ q~else if (!window.PVP_MODE) { startWave(1); } else { initZone(); }~,
  q~else if (!window.PVP_MODE) { startWave(1); } else if (window.TEAMS_MODE) { /* teams: no zone */ } else { initZone(); }~ ],

[ qq~    } else {\n      SP_BOTS = [];\n    }\n  }\n  function buildWorld(){~,
  qq~    } else {\n      SP_BOTS = [];\n    }\n    if (window.TEAMS_MODE && window.Teams){\n      window.Teams.init({ player, world, ents, cam, weapons, colors: COLORS, audio, addEffect, moveWithCollide, dist2, clamp, rand, rint, SP_BOTS });\n    } else if (window.Teams){\n      window.Teams.reset();\n      window.TEAMS_REVIVE = false;\n    }\n  }\n  function buildWorld(){~ ],

[ q~if ((!online && state.phase === 'glyph') || window.STAGE_CUTSCENE_ACTIVE || window._GAUNTLET_INTRO) {~,
  q~if ((!online && state.phase === 'glyph') || window.STAGE_CUTSCENE_ACTIVE || window._GAUNTLET_INTRO || window.TEAMS_REVIVE) {~ ],

[ q~if (state.phase !== 'glyph' && !window.STAGE_CUTSCENE_ACTIVE && !window._GAUNTLET_INTRO && (input.mouse.down || input.touch.fire)) {~,
  q~if (state.phase !== 'glyph' && !window.STAGE_CUTSCENE_ACTIVE && !window._GAUNTLET_INTRO && !window.TEAMS_REVIVE && (input.mouse.down || input.touch.fire)) {~ ],

[ qq~if (!online && window.PVP_MODE) {\n      if (state.phase !== 'glyph') {~,
  qq~if (!online && window.PVP_MODE && !window.TEAMS_MODE) {\n      if (state.phase !== 'glyph') {~ ],

[ qq~    } else if (!online && window.PVP_MODE){\n      // ===== Practice PvP: death circle + last-bot-standing victory =====~,
  qq~    } else if (!online && window.PVP_MODE && !window.TEAMS_MODE){\n      // ===== Practice PvP: death circle + last-bot-standing victory =====~ ],

[ qq~      state.running = false;\n      const prev = parseInt(localStorage.getItem('arenaBest') || '0', 10) || 0;\n      const best = Math.max(prev, state.wave);\n      state.best = best;\n      localStorage.setItem('arenaBest', String(best));\n      bestEl.textContent = best;\n      showGameOver();~,
  qq~      if (window.TEAMS_MODE && window.Teams && window.Teams.onPlayerDeath()){\n        state.playerExploded = false; // allow the next death to play its VFX\n      } else {\n        state.running = false;\n        const prev = parseInt(localStorage.getItem('arenaBest') || '0', 10) || 0;\n        const best = Math.max(prev, state.wave);\n        state.best = best;\n        localStorage.setItem('arenaBest', String(best));\n        bestEl.textContent = best;\n        showGameOver();\n      }~ ],

[ qq~    if (R3D.on) {\n      try { draw3D(dt); return; }~,
  qq~    if (R3D.on && !window.TEAMS_MODE) {\n      try { draw3D(dt); return; }~ ],

[ qq~    // ---------------------------\n    // Chests, minimap, HUD\n    // ---------------------------\n    world.drawChests();~,
  qq~    if (window.TEAMS_MODE && window.Teams) window.Teams.draw(ctx, cam, t);\n    // ---------------------------\n    // Chests, minimap, HUD\n    // ---------------------------\n    world.drawChests();~ ],

[ qq~      if (w3On()) for (const b of SP_BOTS) b.gz = W3.terrain(b.x, b.y);        // lets bot bullets start at the right height\n    }\n  }~,
  qq~      if (w3On()) for (const b of SP_BOTS) b.gz = W3.terrain(b.x, b.y);        // lets bot bullets start at the right height\n    }\n    if (window.TEAMS_MODE && window.Teams) window.Teams.tick(dt);\n  }~ ],
);

my $i = 0;
for my $e (@edits){
  $i++;
  my ($pat, $rep) = @$e;
  my $c = ($s =~ s/\Q$pat\E/$rep/g);
  die "edit $i: no match for: ".substr($pat,0,80)."\n" unless $c;
  warn "edit $i: applied ($c)\n";
}
open my $out, '>', $file or die "write $file: $!";
print $out $s; close $out;
print "ALL OK\n";