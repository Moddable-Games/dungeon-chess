'use strict';
/**
 * Move generation — extends MCE. Supports variable board sizes.
 */
(function() {

const { PIECE, WHITE, BLACK, pieceColor, pieceType, pieceOwner, isFriendly, isEnemy } = MCE;

const KNIGHT_OFFSETS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const BISHOP_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KING_DIRS = QUEEN_DIRS;

function getRole(g, type) {
  if (g.pieceRoles) return g.pieceRoles[type] || type;
  return type;
}

function pseudoLegalMoves(g) {
  const moves = [];
  const side = g.turn;
  const total = g.rows * g.cols;
  const registry = MCE.getPieceRegistry();
  for (let i = 0; i < total; i++) {
    const p = g.board[i];
    if (!p || !isFriendly(i, side, g)) continue;
    const type = pieceType(p);
    const role = getRole(g, type);
    const [r, c] = MCE.rc(i, g);
    if (registry[type]) {
      const custom = registry[type].genMoves(g, i, side);
      if (custom) custom.forEach(m => moves.push(m));
    } else if (g.divergentPieces && g.divergentPieces[type]) {
      const dp = g.divergentPieces[type];
      const genMove = dp.moveStyle === 'slide' ? genSlides : genJumps;
      const genCap = dp.captureStyle === 'slide' ? genSlides : genJumps;
      genMove(g, i, r, c, side, dp.move, moves, { moveOnly: true });
      genCap(g, i, r, c, side, dp.capture, moves, { attackOnly: true });
    } else if (type === PIECE.P) genPawnMoves(g, i, r, c, side, moves);
    else if (role === 'n') genJumps(g, i, r, c, side, KNIGHT_OFFSETS, moves);
    else if (role === 'b') genSlides(g, i, r, c, side, BISHOP_DIRS, moves);
    else if (role === 'r') genSlides(g, i, r, c, side, ROOK_DIRS, moves);
    else if (role === 'q') genSlides(g, i, r, c, side, QUEEN_DIRS, moves);
    else if (role === 'k') {
      genJumps(g, i, r, c, side, KING_DIRS, moves);
      if (!g.noCastling) genCastling(g, i, r, c, side, moves);
    }
    else if (type === PIECE.A) { genSlides(g, i, r, c, side, BISHOP_DIRS, moves); genJumps(g, i, r, c, side, KNIGHT_OFFSETS, moves); }
    else if (type === PIECE.C) { genSlides(g, i, r, c, side, ROOK_DIRS, moves); genJumps(g, i, r, c, side, KNIGHT_OFFSETS, moves); }
    else if (type === PIECE.S) { genJumps(g, i, r, c, side, KING_DIRS, moves); }
  }
  return moves;
}

function genPawnMoves(g, from, r, c, side, moves) {
  const dir = g.pawnDirection ? g.pawnDirection(side) : (side === WHITE ? -1 : 1);
  const defaultStart = side === WHITE ? g.rows - 2 : 1;
  const defaultPromo = side === WHITE ? 0 : g.rows - 1;
  const promoRow = g.noPromotion ? -1 : (g.promotionRank ? g.promotionRank(side) : defaultPromo);
  const actualStart = g.pawnStartRow ? g.pawnStartRow(side) : defaultStart;
  const style = g.pawnMoveStyle || 'standard';

  const moveDirs = style === 'berolina' ? [[-1, dir], [1, dir]] : [[0, dir]];
  const capDirs = style === 'berolina' ? [[0, dir]] : [[-1, dir], [1, dir]];

  for (const [dc, dr] of moveDirs) {
    let nr = r + dr, nc = c + dc;
    [nr, nc] = MCE.wrapCoords(nr, nc, g);
    if (!MCE.onBoard(nr, nc, g)) continue;
    const fwd = MCE.sq(nr, nc, g);
    if (!g.board[fwd]) {
      addPawnMove(from, fwd, nr, promoRow, moves, g);
      if (r === actualStart || g.torpedo) {
        let fwd2r = r + dr * 2, fwd2c = c + dc * 2;
        [fwd2r, fwd2c] = MCE.wrapCoords(fwd2r, fwd2c, g);
        if (MCE.onBoard(fwd2r, fwd2c, g)) {
          const fwd2 = MCE.sq(fwd2r, fwd2c, g);
          if (!g.board[fwd2]) moves.push({ from, to: fwd2, flag: g.noEnPassant ? null : 'double' });
        }
      }
    }
  }

  for (const [dc, dr] of capDirs) {
    let nr = r + dr, nc = c + dc;
    [nr, nc] = MCE.wrapCoords(nr, nc, g);
    if (!MCE.onBoard(nr, nc, g)) continue;
    const target = MCE.sq(nr, nc, g);
    const tp = g.board[target];
    if (tp && isEnemy(target, side, g)) addPawnMove(from, target, nr, promoRow, moves, g);
    else if (!g.noEnPassant && target === g.enPassant) moves.push({ from, to: target, flag: 'ep' });
  }
}

function addPawnMove(from, to, toRow, promoRow, moves, g) {
  if (promoRow >= 0 && toRow === promoRow) {
    const pieces = (g && g.promotionPieces) || ['q','r','b','n','a','c'];
    for (const promo of pieces) moves.push({ from, to, flag: 'promo', promo });
  } else {
    moves.push({ from, to, flag: null });
  }
}

function resolveTerrainPreds(g, opts) {
  const vc = g && g.variant ? MCE.getVariantConfig(g.variant) : null;
  let skip = (opts && opts.terrainSkip) || (vc && vc.terrainSkip) || null;
  let block = (opts && opts.terrainBlock) || (vc && vc.terrainBlock) || null;
  if (opts && opts.waterBlock) block = isWaterTerrain;
  if (opts && opts.waterSkip === false) skip = null;
  return { skip, block };
}

function isWaterTerrain(t) { return t === 'w' || t === 2; }

function genSlides(g, from, r, c, side, dirs, moves, opts) {
  const { skip: tSkip, block: tBlock } = resolveTerrainPreds(g, opts);
  const moveOnly = opts && opts.moveOnly;
  const attackOnly = opts && opts.attackOnly;
  const maxSteps = Math.max((g && g.rows) || 8, (g && g.cols) || 8);
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc;
    const visited = new Set();
    visited.add(from);
    let steps = 0;
    while (MCE.onBoard(nr, nc, g) && steps < maxSteps) {
      [nr, nc] = MCE.wrapCoords(nr, nc, g);
      const target = MCE.sq(nr, nc, g);
      if (visited.has(target)) break;
      visited.add(target);
      const terrain = MCE.getTerrain(target, g);
      if (terrain && tBlock && tBlock(terrain)) break;
      if (terrain && tSkip && tSkip(terrain)) { nr += dr; nc += dc; steps++; continue; }
      const tp = g.board[target];
      if (tp) {
        if (isEnemy(target, side, g) && !moveOnly) {
          moves.push({ from, to: target, flag: 'capture', attackOnly: attackOnly || undefined });
        }
        break;
      }
      if (!attackOnly) {
        moves.push({ from, to: target, flag: null, moveOnly: moveOnly || undefined });
      }
      nr += dr; nc += dc;
      steps++;
    }
  }
}

function genJumps(g, from, r, c, side, offsets, moves, opts) {
  const attackOnly = opts && opts.attackOnly;
  const moveOnly = opts && opts.moveOnly;
  const tBlock = (opts && opts.terrainBlock) || null;
  for (const [dr, dc] of offsets) {
    let nr = r + dr, nc = c + dc;
    [nr, nc] = MCE.wrapCoords(nr, nc, g);
    if (!MCE.onBoard(nr, nc, g)) continue;
    const target = MCE.sq(nr, nc, g);
    if (tBlock) {
      const terrain = MCE.getTerrain(target, g);
      if (terrain && tBlock(terrain)) continue;
    }
    const tp = g.board[target];
    if (tp && isFriendly(target, side, g)) continue;
    if (tp && isEnemy(target, side, g)) {
      if (!moveOnly) moves.push({ from, to: target, flag: 'capture', attackOnly: attackOnly || undefined });
    } else if (!tp) {
      if (!attackOnly) moves.push({ from, to: target, flag: null, moveOnly: moveOnly || undefined });
    }
  }
}

function genCastling(g, from, r, c, side, moves) {
  if (isAttacked(g, from, side)) return;
  const row = side === WHITE ? g.rows - 1 : 0;
  const kingCol = Math.floor(g.cols / 2);
  if (r !== row) return;
  const ks = side === WHITE ? 'K' : 'k';
  const qs = side === WHITE ? 'Q' : 'q';
  if (g.castling[ks]) {
    let clear = true;
    for (let cc = c + 1; cc < g.cols - 1; cc++) {
      if (g.board[MCE.sq(row, cc, g)]) { clear = false; break; }
    }
    if (clear) {
      const f = MCE.sq(row, c + 1, g);
      if (!isAttacked(g, f, side)) {
        moves.push({ from, to: MCE.sq(row, c + 2, g), flag: 'castle-k' });
      }
    }
  }
  if (g.castling[qs]) {
    let clear = true;
    for (let cc = 1; cc < c; cc++) {
      if (g.board[MCE.sq(row, cc, g)]) { clear = false; break; }
    }
    if (clear) {
      const d = MCE.sq(row, c - 1, g);
      if (!isAttacked(g, d, side)) {
        moves.push({ from, to: MCE.sq(row, c - 2, g), flag: 'castle-q' });
      }
    }
  }
}

function isAttacked(g, target, bySide) {
  const total = g.rows * g.cols;
  for (let i = 0; i < total; i++) {
    const p = g.board[i];
    if (!p || isFriendly(i, bySide, g)) continue;
    if (attacks(g, i, target, p)) return true;
  }
  return false;
}

function attacks(g, from, target, piece) {
  const type = pieceType(piece);
  const registry = MCE.getPieceRegistry();
  if (registry[type]) {
    return registry[type].attacks(g, from, target);
  }
  if (g.divergentPieces && g.divergentPieces[type]) {
    const dp = g.divergentPieces[type];
    const [fr, fc] = MCE.rc(from, g);
    const [tr, tc] = MCE.rc(target, g);
    if (dp.captureStyle === 'slide') return slidesTo(g, from, target, dp.capture);
    return dp.capture.some(([dr, dc]) => fr + dr === tr && fc + dc === tc);
  }
  const role = getRole(g, type);
  const [fr, fc] = MCE.rc(from, g);
  const [tr, tc] = MCE.rc(target, g);
  const dr = tr - fr, dc = tc - fc;
  if (type === PIECE.P) {
    const owner = pieceOwner(from, g);
    const dir = g.pawnDirection ? g.pawnDirection(owner) : (owner === WHITE ? -1 : 1);
    const style = g.pawnMoveStyle || 'standard';
    if (style === 'berolina') return dr === dir && dc === 0;
    return dr === dir && Math.abs(dc) === 1;
  }
  if (role === 'n') return KNIGHT_OFFSETS.some(([r,c]) => fr+r===tr && fc+c===tc);
  if (role === 'k') return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0);
  if (type === PIECE.S) return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
  if (type === PIECE.A) {
    if (KNIGHT_OFFSETS.some(([r,c]) => fr+r===tr && fc+c===tc)) return true;
    return slidesTo(g, from, target, BISHOP_DIRS);
  }
  if (type === PIECE.C) {
    if (KNIGHT_OFFSETS.some(([r,c]) => fr+r===tr && fc+c===tc)) return true;
    return slidesTo(g, from, target, ROOK_DIRS);
  }
  const dirs = role === 'b' ? BISHOP_DIRS : role === 'r' ? ROOK_DIRS : QUEEN_DIRS;
  return slidesTo(g, from, target, dirs);
}

function slidesTo(g, from, target, dirs, opts) {
  const { skip: tSkip, block: tBlock } = resolveTerrainPreds(g, opts);
  const [fr, fc] = MCE.rc(from, g);
  const [tr, tc] = MCE.rc(target, g);
  const maxSteps = Math.max((g && g.rows) || 8, (g && g.cols) || 8);
  for (const [sdr, sdc] of dirs) {
    let r = fr + sdr, c = fc + sdc;
    const visited = new Set();
    visited.add(from);
    let steps = 0;
    while (MCE.onBoard(r, c, g) && steps < maxSteps) {
      [r, c] = MCE.wrapCoords(r, c, g);
      const sq = MCE.sq(r, c, g);
      if (visited.has(sq)) break;
      visited.add(sq);
      const terrain = MCE.getTerrain(sq, g);
      if (terrain && tBlock && tBlock(terrain)) break;
      if (terrain && tSkip && tSkip(terrain)) { r += sdr; c += sdc; steps++; continue; }
      if (r === tr && c === tc) return true;
      if (g.board[sq]) break;
      r += sdr; c += sdc;
      steps++;
    }
  }
  return false;
}

function cannonReaches(g, from, target, dirs, opts) {
  const { skip: tSkip } = resolveTerrainPreds(g, opts);
  const [fr, fc] = MCE.rc(from, g);
  const maxSteps = Math.max((g && g.rows) || 8, (g && g.cols) || 8);
  for (const [dr, dc] of dirs) {
    let nr = fr + dr, nc = fc + dc, screen = false;
    const visited = new Set();
    visited.add(from);
    let steps = 0;
    while (MCE.onBoard(nr, nc, g) && steps < maxSteps) {
      [nr, nc] = MCE.wrapCoords(nr, nc, g);
      const sq = MCE.sq(nr, nc, g);
      if (visited.has(sq)) break;
      visited.add(sq);
      const terrain = MCE.getTerrain(sq, g);
      if (terrain && tSkip && tSkip(terrain)) { nr += dr; nc += dc; steps++; continue; }
      if (!screen) {
        if (g.board[sq]) screen = true;
      } else {
        if (sq === target) return true;
        if (g.board[sq]) break;
      }
      nr += dr; nc += dc;
      steps++;
    }
  }
  return false;
}

function gappedSlidesTo(g, from, target, dirs, opts) {
  const { skip: tSkip, block: tBlock } = resolveTerrainPreds(g, opts);
  const [fr, fc] = MCE.rc(from, g);
  const [tr, tc] = MCE.rc(target, g);
  const maxSteps = Math.max((g && g.rows) || 8, (g && g.cols) || 8);
  for (const [dr, dc] of dirs) {
    let r = fr + dr, c = fc + dc, gapped = false;
    const visited = new Set();
    visited.add(from);
    let steps = 0;
    while (MCE.onBoard(r, c, g) && steps < maxSteps) {
      [r, c] = MCE.wrapCoords(r, c, g);
      const sq = MCE.sq(r, c, g);
      if (visited.has(sq)) break;
      visited.add(sq);
      const terrain = MCE.getTerrain(sq, g);
      if (terrain && tBlock && tBlock(terrain)) break;
      if (terrain && tSkip && tSkip(terrain)) { r += dr; c += dc; steps++; continue; }
      if (r === tr && c === tc) return true;
      if (g.board[sq]) {
        if (gapped) break;
        gapped = true;
      }
      r += dr; c += dc;
      steps++;
    }
  }
  return false;
}

function legalMoves(g) {
  if (g._pendingAction) {
    const pa = g._pendingAction;
    return pseudoLegalMoves(g).filter(m => {
      if (m.from !== pa.from) return false;
      if (pa.filter && !pa.filter(m, g)) return false;
      return true;
    });
  }
  const movingSide = g.turn;
  const skipCheck = g.noCheck;
  return pseudoLegalMoves(g).filter(m => {
    if (g.legalityFilter) {
      const undo = MCE.makeMove(g, m);
      const legal = g.legalityFilter(g, m, undo);
      MCE.unmakeMove(g, undo);
      return legal;
    }
    if (skipCheck) return true;
    const undo = MCE.makeMove(g, m);
    const legal = !inCheck(g, movingSide);
    MCE.unmakeMove(g, undo);
    return legal;
  });
}

function inCheck(g, side) {
  let kingSq = -1;
  if (g.ownershipMode === 'pieceData') {
    const total = g.rows * g.cols;
    for (let i = 0; i < total; i++) {
      const pd = g.pieceData[i];
      if (pd && pd.owner === side && pd.isKing) { kingSq = i; break; }
    }
  } else {
    const royal = g.royalPiece || 'k';
    const royalChar = side === WHITE ? royal.toUpperCase() : royal.toLowerCase();
    kingSq = g.board.indexOf(royalChar);
  }
  if (kingSq < 0) return false;
  return isAttacked(g, kingSq, side);
}

function genCannon(g, from, r, c, side, dirs, moves, opts) {
  const { skip: tSkip } = resolveTerrainPreds(g, opts);
  const maxSteps = Math.max((g && g.rows) || 8, (g && g.cols) || 8);
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc, screen = false;
    const visited = new Set();
    visited.add(from);
    let steps = 0;
    while (MCE.onBoard(nr, nc, g) && steps < maxSteps) {
      [nr, nc] = MCE.wrapCoords(nr, nc, g);
      const target = MCE.sq(nr, nc, g);
      if (visited.has(target)) break;
      visited.add(target);
      const terrain = MCE.getTerrain(target, g);
      if (terrain && tSkip && tSkip(terrain)) { nr += dr; nc += dc; steps++; continue; }
      const tp = g.board[target];
      if (!screen) {
        if (tp) { screen = true; }
        else { moves.push({ from, to: target, flag: null }); }
      } else {
        if (tp) {
          if (isEnemy(target, side, g)) moves.push({ from, to: target, flag: 'capture', attackOnly: true });
          break;
        }
      }
      nr += dr; nc += dc;
      steps++;
    }
  }
}

function genGappedSlides(g, from, r, c, side, dirs, moves, opts) {
  const mode = (opts && opts.mode) || 'both';
  const { skip: tSkip, block: tBlock } = resolveTerrainPreds(g, opts);
  const maxSteps = Math.max((g && g.rows) || 8, (g && g.cols) || 8);
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc, gapped = false;
    const visited = new Set();
    visited.add(from);
    let steps = 0;
    while (MCE.onBoard(nr, nc, g) && steps < maxSteps) {
      [nr, nc] = MCE.wrapCoords(nr, nc, g);
      const target = MCE.sq(nr, nc, g);
      if (visited.has(target)) break;
      visited.add(target);
      const terrain = MCE.getTerrain(target, g);
      if (terrain && tBlock && tBlock(terrain)) break;
      if (terrain && tSkip && tSkip(terrain)) { nr += dr; nc += dc; steps++; continue; }
      const tp = g.board[target];
      if (tp) {
        if (!gapped) {
          gapped = true;
          if (isEnemy(target, side, g) && (mode === 'attack' || mode === 'both')) {
            moves.push({ from, to: target, flag: 'capture', attackOnly: mode === 'attack' || undefined });
          }
        } else {
          if (isEnemy(target, side, g) && (mode === 'attack' || mode === 'both')) {
            moves.push({ from, to: target, flag: 'capture', attackOnly: mode === 'attack' || undefined });
          }
          break;
        }
      } else {
        if (!gapped && (mode === 'move' || mode === 'both')) {
          moves.push({ from, to: target, flag: null, moveOnly: mode === 'move' || undefined });
        }
      }
      nr += dr; nc += dc;
      steps++;
    }
  }
}

Object.assign(MCE, {
  pseudoLegalMoves, legalMoves, inCheck, isAttacked,
  genSlides, genJumps, genCannon, genGappedSlides, slidesTo, cannonReaches, gappedSlidesTo,
  KNIGHT_OFFSETS, BISHOP_DIRS, ROOK_DIRS, QUEEN_DIRS, KING_DIRS
});
})();
