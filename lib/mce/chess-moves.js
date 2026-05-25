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

function pseudoLegalMoves(g) {
  const moves = [];
  const side = g.turn;
  const total = g.rows * g.cols;
  const registry = MCE.getPieceRegistry();
  for (let i = 0; i < total; i++) {
    const p = g.board[i];
    if (!p || !isFriendly(i, side, g)) continue;
    const type = pieceType(p);
    const [r, c] = MCE.rc(i, g);
    if (registry[type]) {
      const custom = registry[type].genMoves(g, i, side);
      if (custom) custom.forEach(m => moves.push(m));
    } else if (type === PIECE.P) genPawnMoves(g, i, r, c, side, moves);
    else if (type === PIECE.N) genJumps(g, i, r, c, side, KNIGHT_OFFSETS, moves);
    else if (type === PIECE.B) genSlides(g, i, r, c, side, BISHOP_DIRS, moves);
    else if (type === PIECE.R) genSlides(g, i, r, c, side, ROOK_DIRS, moves);
    else if (type === PIECE.Q) genSlides(g, i, r, c, side, QUEEN_DIRS, moves);
    else if (type === PIECE.K) {
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
  const startRow = side === WHITE ? g.rows - 2 : 1;
  const promoRow = g.noPromotion ? -1 : (side === WHITE ? 0 : g.rows - 1);
  const grandStart = g.variant === 'grand' ? (side === WHITE ? g.rows - 3 : 2) : startRow;
  const actualStart = g.variant === 'grand' ? grandStart : startRow;

  const fwd = MCE.sq(r + dir, c, g);
  if (MCE.onBoard(r + dir, c, g) && !g.board[fwd]) {
    addPawnMove(from, fwd, r + dir, promoRow, moves);
    if (r === actualStart || g.torpedo) {
      const fwd2r = r + dir * 2;
      if (MCE.onBoard(fwd2r, c, g)) {
        const fwd2 = MCE.sq(fwd2r, c, g);
        if (!g.board[fwd2]) moves.push({ from, to: fwd2, flag: g.noEnPassant ? null : 'double' });
      }
    }
  }
  for (const dc of [-1, 1]) {
    const nc = c + dc;
    if (!MCE.onBoard(r + dir, nc, g)) continue;
    const target = MCE.sq(r + dir, nc, g);
    const tp = g.board[target];
    if (tp && isEnemy(target, side, g)) addPawnMove(from, target, r + dir, promoRow, moves);
    else if (!g.noEnPassant && target === g.enPassant) moves.push({ from, to: target, flag: 'ep' });
  }
}

function addPawnMove(from, to, toRow, promoRow, moves) {
  if (toRow === promoRow) {
    for (const promo of ['q','r','b','n','a','c']) moves.push({ from, to, flag: 'promo', promo });
  } else {
    moves.push({ from, to, flag: null });
  }
}

function genSlides(g, from, r, c, side, dirs, moves, opts) {
  const waterBlock = opts && opts.waterBlock;
  const waterSkip = opts && opts.waterSkip;
  const moveOnly = opts && opts.moveOnly;
  const attackOnly = opts && opts.attackOnly;
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc;
    while (MCE.onBoard(nr, nc, g)) {
      const target = MCE.sq(nr, nc, g);
      const terrain = MCE.getTerrain(target, g);
      if (terrain === 'w' || terrain === 2) {
        if (waterBlock) break;
        if (waterSkip !== false) { nr += dr; nc += dc; continue; }
      }
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
    }
  }
}

function genJumps(g, from, r, c, side, offsets, moves, opts) {
  const attackOnly = opts && opts.attackOnly;
  const moveOnly = opts && opts.moveOnly;
  for (const [dr, dc] of offsets) {
    const nr = r + dr, nc = c + dc;
    if (!MCE.onBoard(nr, nc, g)) continue;
    const target = MCE.sq(nr, nc, g);
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
  const [fr, fc] = MCE.rc(from, g);
  const [tr, tc] = MCE.rc(target, g);
  const dr = tr - fr, dc = tc - fc;
  if (type === PIECE.P) {
    const owner = pieceOwner(from, g);
    const dir = g.pawnDirection ? g.pawnDirection(owner) : (owner === WHITE ? -1 : 1);
    return dr === dir && Math.abs(dc) === 1;
  }
  if (type === PIECE.N) return KNIGHT_OFFSETS.some(([r,c]) => fr+r===tr && fc+c===tc);
  if (type === PIECE.K || type === PIECE.S) return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
  if (type === PIECE.A) {
    if (KNIGHT_OFFSETS.some(([r,c]) => fr+r===tr && fc+c===tc)) return true;
    return slidesTo(g, from, target, BISHOP_DIRS);
  }
  if (type === PIECE.C) {
    if (KNIGHT_OFFSETS.some(([r,c]) => fr+r===tr && fc+c===tc)) return true;
    return slidesTo(g, from, target, ROOK_DIRS);
  }
  const dirs = type === PIECE.B ? BISHOP_DIRS : type === PIECE.R ? ROOK_DIRS : QUEEN_DIRS;
  return slidesTo(g, from, target, dirs);
}

function slidesTo(g, from, target, dirs) {
  const [fr, fc] = MCE.rc(from, g);
  const [tr, tc] = MCE.rc(target, g);
  for (const [sdr, sdc] of dirs) {
    let r = fr + sdr, c = fc + sdc;
    while (MCE.onBoard(r, c, g)) {
      if (r === tr && c === tc) return true;
      if (g.board[MCE.sq(r, c, g)]) break;
      r += sdr; c += sdc;
    }
  }
  return false;
}

function legalMoves(g) {
  const movingSide = g.turn;
  return pseudoLegalMoves(g).filter(m => {
    if (g.legalityFilter) {
      const undo = MCE.makeMove(g, m);
      const legal = g.legalityFilter(g, m, undo);
      MCE.unmakeMove(g, undo);
      return legal;
    }
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
    const kingChar = side === WHITE ? 'K' : 'k';
    kingSq = g.board.indexOf(kingChar);
  }
  if (kingSq < 0) return false;
  return isAttacked(g, kingSq, side);
}

function genCannon(g, from, r, c, side, dirs, moves, opts) {
  const waterSkip = !opts || opts.waterSkip !== false;
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc, screen = false;
    while (MCE.onBoard(nr, nc, g)) {
      const target = MCE.sq(nr, nc, g);
      const terrain = MCE.getTerrain(target, g);
      if ((terrain === 'w' || terrain === 2) && waterSkip) { nr += dr; nc += dc; continue; }
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
    }
  }
}

function genGappedSlides(g, from, r, c, side, dirs, moves, opts) {
  const mode = (opts && opts.mode) || 'both';
  const waterBlock = opts && opts.waterBlock;
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc, gapped = false;
    while (MCE.onBoard(nr, nc, g)) {
      const target = MCE.sq(nr, nc, g);
      const terrain = MCE.getTerrain(target, g);
      if (terrain === 'w' || terrain === 2) {
        if (waterBlock) break;
        nr += dr; nc += dc; continue;
      }
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
    }
  }
}

Object.assign(MCE, {
  pseudoLegalMoves, legalMoves, inCheck, isAttacked,
  genSlides, genJumps, genCannon, genGappedSlides, slidesTo,
  KNIGHT_OFFSETS, BISHOP_DIRS, ROOK_DIRS, QUEEN_DIRS, KING_DIRS
});
})();
