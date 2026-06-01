'use strict';
(function() {

const unitRegistry = {};

function registerUnit(key, config) {
  unitRegistry[key] = config;
  return config;
}

function getUnit(key) {
  return unitRegistry[key] || null;
}

function getUnitRegistry() {
  return unitRegistry;
}

function buildUnitHandler(config) {
  return {
    genMoves: function(g, sq, side) {
      return generateMoves(g, sq, side, config);
    },
    attacks: function(g, from, target) {
      return checkAttacks(g, from, target, config);
    }
  };
}

function generateMoves(g, sq, side, config) {
  if (config.genMoves) return config.genMoves(g, sq, side);
  const moves = [];
  const [r, c] = MCE.rc(sq, g);
  const parts = Array.isArray(config.move) ? config.move : [config.move];
  for (const part of parts) {
    applyMovePart(g, sq, r, c, side, part, moves, 'move');
  }
  if (config.attack) {
    const aParts = Array.isArray(config.attack) ? config.attack : [config.attack];
    for (const part of aParts) {
      applyMovePart(g, sq, r, c, side, part, moves, 'attack');
    }
  }
  if (config.cannon) {
    const dirs = resolveDirs(config.cannon.dirs || config.cannon);
    if (dirs) MCE.genCannon(g, sq, r, c, side, dirs, moves);
  }
  return moves;
}

function applyMovePart(g, sq, r, c, side, part, moves, mode) {
  if (typeof part === 'function') {
    const custom = part(g, sq, r, c, side, mode);
    if (custom) custom.forEach(function(m) { moves.push(m); });
    return;
  }
  const spec = typeof part === 'string' ? parseMoveSpec(part) : part;
  const dirs = resolveDirs(spec.dirs);
  if (!dirs) return;
  const opts = {};
  if (spec.waterBlock) opts.waterBlock = true;
  if (spec.terrainBlock) opts.terrainBlock = spec.terrainBlock;
  if (spec.terrainSkip) opts.terrainSkip = spec.terrainSkip;

  if (mode === 'move') {
    opts.moveOnly = true;
  } else {
    opts.attackOnly = true;
  }

  if (spec.style === 'jump') {
    MCE.genJumps(g, sq, r, c, side, dirs, moves, opts);
  } else if (spec.style === 'gapped') {
    MCE.genGappedSlides(g, sq, r, c, side, dirs, moves, { mode: mode === 'move' ? 'move' : 'attack', waterBlock: opts.waterBlock, terrainBlock: opts.terrainBlock });
  } else {
    MCE.genSlides(g, sq, r, c, side, dirs, moves, opts);
  }
}

function checkAttacks(g, from, target, config) {
  if (config.attacks) return config.attacks(g, from, target);
  const [fr, fc] = MCE.rc(from, g);
  const [tr, tc] = MCE.rc(target, g);

  const allParts = [];
  if (config.move) {
    const parts = Array.isArray(config.move) ? config.move : [config.move];
    parts.forEach(function(p) { allParts.push(p); });
  }
  if (config.attack) {
    const parts = Array.isArray(config.attack) ? config.attack : [config.attack];
    parts.forEach(function(p) { allParts.push(p); });
  }

  for (const part of allParts) {
    if (typeof part === 'function') continue;
    const spec = typeof part === 'string' ? parseMoveSpec(part) : part;
    const dirs = resolveDirs(spec.dirs);
    if (!dirs) continue;
    const opts = spec.waterBlock ? { waterBlock: true } : undefined;

    if (spec.style === 'jump') {
      if (dirs.some(function(d) { return fr + d[0] === tr && fc + d[1] === tc; })) return true;
    } else if (spec.style === 'gapped') {
      if (MCE.gappedSlidesTo(g, from, target, dirs, opts)) return true;
    } else {
      if (MCE.slidesTo(g, from, target, dirs, opts)) return true;
    }
  }

  if (config.cannon) {
    const dirs = resolveDirs(config.cannon.dirs || config.cannon);
    if (dirs && MCE.cannonReaches(g, from, target, dirs)) return true;
  }

  return false;
}

function parseMoveSpec(str) {
  const spec = { style: 'slide', dirs: null };
  const parts = str.split(':');
  for (const p of parts) {
    if (p === 'jump') spec.style = 'jump';
    else if (p === 'gapped') spec.style = 'gapped';
    else if (p === 'waterBlock') spec.waterBlock = true;
    else if (p === 'rook') spec.dirs = 'rook';
    else if (p === 'bishop') spec.dirs = 'bishop';
    else if (p === 'queen') spec.dirs = 'queen';
    else if (p === 'knight') { spec.dirs = 'knight'; spec.style = 'jump'; }
    else if (p === 'king') { spec.dirs = 'queen'; spec.style = 'jump'; }
  }
  return spec;
}

function resolveDirs(d) {
  if (!d) return null;
  if (Array.isArray(d)) return d;
  if (d === 'rook') return MCE.ROOK_DIRS;
  if (d === 'bishop') return MCE.BISHOP_DIRS;
  if (d === 'queen') return MCE.QUEEN_DIRS;
  if (d === 'knight') return MCE.KNIGHT_OFFSETS;
  if (d === 'king') return MCE.QUEEN_DIRS;
  return null;
}

Object.assign(MCE, { registerUnit, getUnit, getUnitRegistry, buildUnitHandler });
})();
