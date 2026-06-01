'use strict';
const DungeonMCE = (function() {

const PIECE_CHAR = 'X';
const RD = MCE.ROOK_DIRS;
const BD = MCE.BISHOP_DIRS;
const AD = MCE.QUEEN_DIRS;
const KNIGHT = MCE.KNIGHT_OFFSETS;

const unitHandlers = {};

function registerAllUnits() {
  MCE.registerPiece('x', {
    genMoves(g, sq, side) {
      const pd = g.pieceData[sq];
      if (!pd) return [];
      if (MCE.hasEffect(g, sq, 'hex')) return [];
      const handler = unitHandlers[pd.key];
      if (!handler) return [];
      const moves = handler.genMoves(g, sq, side);
      const [r, c] = MCE.rc(sq, g);
      for (const [dr, dc] of AD) {
        const nr = r + dr, nc = c + dc;
        if (!MCE.onBoard(nr, nc, g)) continue;
        const target = MCE.sq(nr, nc, g);
        if (!g.board[target] || !MCE.isEnemy(target, side, g)) continue;
        const tpd = g.pieceData[target];
        if (tpd && unitHandlers[tpd.key] && unitHandlers[tpd.key].fragile) {
          if (!moves.some(m => m.to === target)) {
            moves.push({ from: sq, to: target, flag: 'capture' });
          }
        }
      }
      return moves;
    },
    attacks(g, from, target) {
      const pd = g.pieceData[from];
      if (!pd) return false;
      if (MCE.hasEffect(g, from, 'hex')) return false;
      const handler = unitHandlers[pd.key];
      if (handler && handler.attacks(g, from, target)) return true;
      const tpd = g.pieceData[target];
      if (tpd && unitHandlers[tpd.key] && unitHandlers[tpd.key].fragile) {
        const [fr, fc] = MCE.rc(from, g);
        const [tr, tc] = MCE.rc(target, g);
        if (Math.abs(tr - fr) <= 1 && Math.abs(tc - fc) <= 1) return true;
      }
      return false;
    }
  });

  MCE.registerVariant('dungeon-chess', {
    label: 'Dungeon Chess',
    terrainSkip: (t) => t === 'w' || t === 2,
    moveFilter: dcMoveFilter,
    beforeMove: dcBeforeMove,
    afterMove: dcAfterMove,
    turnLogic: dcTurnLogic,
    evaluate: dcEvaluate,
    restoreState: dcRestoreState,
    positionKey: dcPositionKey,
  });
}

// ── VARIANT HOOKS ──

function dcMoveFilter(g, moves) {
  const total = g.rows * g.cols;
  for (let i = 0; i < total; i++) {
    if (!g.board[i] || !g.pieceData[i]) continue;
    const pd = g.pieceData[i];
    if (pd.key !== 'shaman' || pd.owner !== g.turn || pd.hexUsed) continue;
    for (let j = 0; j < total; j++) {
      if (!g.board[j] || !g.pieceData[j]) continue;
      const tpd = g.pieceData[j];
      if (tpd.owner === g.turn || tpd.isKing) continue;
      moves.push({ from: i, to: j, flag: 'action' });
    }
  }
  return moves;
}

function dcBeforeMove(g, move, undo) {
  if (move.flag === 'action') {
    const pd = g.pieceData[move.from];
    if (pd && pd.key === 'shaman') {
      undo._hexShamanSq = move.from;
      pd.hexUsed = true;
      MCE.addEffect(g, undo, { sq: move.to, type: 'hex', duration: 2 });
    }
    return;
  }
  const targetPd = g.pieceData[move.to];
  if (targetPd && targetPd.key === 'troll' && !targetPd.wounded) {
    undo._trollWoundedSq = move.to;
    undo._trollPushedTo = null;
    targetPd.wounded = true;
    const [fr, fc] = MCE.rc(move.from, g);
    const [tr, tc] = MCE.rc(move.to, g);
    const dr = tr - fr > 0 ? 1 : tr - fr < 0 ? -1 : 0;
    const dc = tc - fc > 0 ? 1 : tc - fc < 0 ? -1 : 0;
    const pushR = tr + dr, pushC = tc + dc;
    let canPush = false;
    if (MCE.onBoard(pushR, pushC, g)) {
      const landSq = MCE.sq(pushR, pushC, g);
      const lt = MCE.getTerrain(landSq, g);
      if (lt !== 'w' && lt !== 2 && !g.board[landSq]) canPush = true;
    }
    if (canPush) {
      const landSq = MCE.sq(pushR, pushC, g);
      undo._trollPushedTo = landSq;
      MCE.mutateBoard(g, undo, [{ sq: landSq, piece: PIECE_CHAR }]);
      g.pieceData[landSq] = targetPd;
      g.board[move.to] = g.board[move.from];
      g.pieceData[move.to] = g.pieceData[move.from];
      g.board[move.from] = null;
      g.pieceData[move.from] = null;
    }
    return { cancelCapture: true };
  }
  g.board[move.to] = g.board[move.from];
  g.board[move.from] = null;
  if (g.pieceData) { g.pieceData[move.to] = g.pieceData[move.from]; g.pieceData[move.from] = null; }
}

function dcAfterMove(g, move, undo) {
  if (undo.captured && undo.pieceDataTo && undo.pieceDataTo.key === 'demonics' && !undo.captureIntercepted) {
    const victimPd = undo.pieceDataTo;
    const [cr, cc] = MCE.rc(move.to, g);
    const exploded = [];
    for (const [dr, dc] of AD) {
      const nr = cr + dr, nc = cc + dc;
      if (!MCE.onBoard(nr, nc, g)) continue;
      const adjSq = MCE.sq(nr, nc, g);
      const adjPd = g.pieceData[adjSq];
      if (adjPd && adjPd.owner !== victimPd.owner) {
        exploded.push({ sq: adjSq, pd: adjPd });
        MCE.mutateBoard(g, undo, [{ sq: adjSq, piece: null }]);
        g.pieceData[adjSq] = null;
      }
    }
    undo._demonicsExploded = exploded;
  }
}

function dcRestoreState(g, undo) {
  if (undo._hexShamanSq !== undefined) {
    const pd = g.pieceData[undo._hexShamanSq];
    if (pd) pd.hexUsed = false;
  }
  if (undo._trollWoundedSq !== undefined) {
    const pd = g.pieceData[undo._trollWoundedSq];
    if (pd) pd.wounded = false;
  }
  if (undo._trollPushedTo !== null && undo._trollPushedTo !== undefined) {
    g.pieceData[undo._trollPushedTo] = null;
  }
  if (undo._demonicsExploded) {
    for (const { sq, pd } of undo._demonicsExploded) {
      g.pieceData[sq] = pd;
    }
  }
}

function dcTurnLogic(g, undo) {
  const move = undo;
  if (move.captured && !move.captureIntercepted) {
    const pd = g.pieceData[move.to];
    if (pd && pd.key === 'salamander') {
      const [tr, tc] = MCE.rc(move.to, g);
      const retreatOptions = [];
      for (const [dr, dc] of AD) {
        const nr = tr + dr, nc = tc + dc;
        if (!MCE.onBoard(nr, nc, g)) continue;
        const adjSq = MCE.sq(nr, nc, g);
        const t = MCE.getTerrain(adjSq, g);
        if (t === 'w' || t === 2 || t === null) continue;
        if (g.board[adjSq]) continue;
        retreatOptions.push(adjSq);
      }
      if (retreatOptions.length > 0) {
        g._pendingAction = { from: move.to, filter: (m) => retreatOptions.includes(m.to) };
        undo._salamanderRetreatFrom = move.to;
        return;
      }
    }
  }
  if (g.effects && g.effects.length > 0) MCE.tickEffects(g, undo);
  MCE.advanceTurn(g);
}

function dcPositionKey(g) {
  let key = '';
  const total = g.rows * g.cols;
  for (let i = 0; i < total; i++) {
    const pd = g.pieceData[i];
    if (pd) key += pd.key.substring(0, 3) + pd.owner[0];
    else key += '.';
  }
  return key + ' ' + g.turn;
}

function dcEvaluate(g) {
  let score = 0;
  const total = g.rows * g.cols;
  for (let i = 0; i < total; i++) {
    if (!g.board[i] || !g.pieceData[i]) continue;
    const pd = g.pieceData[i];
    const unit = typeof UNITS !== 'undefined' ? UNITS[pd.key] : null;
    const val = unit ? unit.cost * 50 : 100;
    const isKing = unit && unit.type === PT.K;
    const kingBonus = isKing ? 20000 : 0;
    if (pd.owner === g.turn) score += val + kingBonus;
    else score -= val + kingBonus;
  }
  return score;
}

// ── UTILITY ──

function isWaterAt(g, sq) {
  const t = MCE.getTerrain(sq, g);
  return t === 'w' || t === 2;
}


function isIntimidated(g, sq, side) {
  const [r, c] = MCE.rc(sq, g);
  for (const [dr, dc] of AD) {
    const nr = r + dr, nc = c + dc;
    if (!MCE.onBoard(nr, nc, g)) continue;
    const adj = MCE.sq(nr, nc, g);
    if (!g.board[adj] || !MCE.isEnemy(adj, side, g)) continue;
    const pd = g.pieceData[adj];
    if (pd && unitHandlers[pd.key] && unitHandlers[pd.key].intimidate) return true;
  }
  return false;
}

function pawnGenMoves(g, sq, side, withCannon) {
  const moves = [];
  const [r, c] = MCE.rc(sq, g);
  const intimidated = isIntimidated(g, sq, side);
  for (const [dr, dc] of AD) {
    const nr = r + dr, nc = c + dc;
    if (!MCE.onBoard(nr, nc, g)) continue;
    const target = MCE.sq(nr, nc, g);
    if (isWaterAt(g, target)) continue;
    const tp = g.board[target];
    if (tp && MCE.isFriendly(target, side, g)) continue;
    if (tp && MCE.isEnemy(target, side, g)) {
      if (!intimidated) moves.push({ from: sq, to: target, flag: 'capture' });
    } else if (!tp) {
      moves.push({ from: sq, to: target, flag: null });
    }
  }
  if (withCannon && !intimidated) MCE.genCannon(g, sq, r, c, side, RD, moves);
  return moves;
}

function pawnAttacks(g, from, target) {
  const side = MCE.pieceOwner(from, g);
  if (isIntimidated(g, from, side)) return false;
  const [fr, fc] = MCE.rc(from, g);
  const [tr, tc] = MCE.rc(target, g);
  if (Math.abs(tr - fr) <= 1 && Math.abs(tc - fc) <= 1 && (tr !== fr || tc !== fc)) return true;
  return cannonReaches(g, from, target, RD);
}

function cannonReaches(g, from, target, dirs) {
  const tpd = g.pieceData[target];
  if (tpd && tpd.key === 'iron_golem') return false;
  return MCE.cannonReaches(g, from, target, dirs);
}


// ── PAWN types ──

unitHandlers.hero = {
  genMoves(g, sq, side) { return pawnGenMoves(g, sq, side, false); },
  attacks(g, from, target) {
    const [fr, fc] = MCE.rc(from, g);
    const [tr, tc] = MCE.rc(target, g);
    return Math.abs(tr - fr) <= 1 && Math.abs(tc - fc) <= 1 && (tr !== fr || tc !== fc);
  }
};

unitHandlers.skeleton = {
  genMoves(g, sq, side) { return pawnGenMoves(g, sq, side, false); },
  attacks(g, from, target) {
    const [fr, fc] = MCE.rc(from, g);
    const [tr, tc] = MCE.rc(target, g);
    return Math.abs(tr - fr) <= 1 && Math.abs(tc - fc) <= 1 && (tr !== fr || tc !== fc);
  },
  fragile: true
};

unitHandlers.kobold = unitHandlers.goblin = {
  genMoves(g, sq, side) { return pawnGenMoves(g, sq, side, true); },
  attacks(g, from, target) { return pawnAttacks(g, from, target); }
};

// ── CASTLE types ──

unitHandlers.stronghold = MCE.buildUnitHandler({
  move: { style: 'jump', dirs: 'rook', waterBlock: true },
  attack: 'rook'
});

unitHandlers.tomb = {
  genMoves(g, sq, side) {
    const moves = [];
    const [r, c] = MCE.rc(sq, g);
    for (const [dr, dc] of RD) {
      const nr = r + dr, nc = c + dc;
      if (!MCE.onBoard(nr, nc, g)) continue;
      const target = MCE.sq(nr, nc, g);
      if (isWaterAt(g, target)) continue;
      if (MCE.isFriendly(target, side, g)) continue;
      const tp = g.board[target];
      if (tp) moves.push({ from: sq, to: target, flag: 'capture' });
      else moves.push({ from: sq, to: target, flag: null });
    }
    tombPhaseSlides(g, sq, r, c, side, moves);
    return moves;
  },
  attacks(g, from, target) {
    const [fr, fc] = MCE.rc(from, g);
    const [tr, tc] = MCE.rc(target, g);
    if (Math.abs(tr - fr) + Math.abs(tc - fc) === 1) return true;
    return tombPhaseReaches(g, from, target);
  }
};

function tombPhaseSlides(g, sq, r, c, side, moves) {
  for (const [dr, dc] of RD) {
    let nr = r + dr, nc = c + dc, phased = false;
    while (MCE.onBoard(nr, nc, g)) {
      const target = MCE.sq(nr, nc, g);
      if (isWaterAt(g, target)) { nr += dr; nc += dc; continue; }
      const tp = g.board[target];
      if (tp) {
        if (MCE.isFriendly(target, side, g)) {
          if (phased) break;
          phased = true;
        } else {
          moves.push({ from: sq, to: target, flag: 'capture', attackOnly: true });
          break;
        }
      }
      nr += dr; nc += dc;
    }
  }
}

function tombPhaseReaches(g, from, target) {
  const [fr, fc] = MCE.rc(from, g);
  const [tr, tc] = MCE.rc(target, g);
  const side = MCE.pieceOwner(from, g);
  for (const [dr, dc] of RD) {
    let nr = fr + dr, nc = fc + dc, phased = false;
    while (MCE.onBoard(nr, nc, g)) {
      const sq = MCE.sq(nr, nc, g);
      if (isWaterAt(g, sq)) { nr += dr; nc += dc; continue; }
      if (nr === tr && nc === tc) return true;
      const tp = g.board[sq];
      if (tp) {
        if (MCE.isFriendly(sq, side, g)) {
          if (phased) break;
          phased = true;
        } else {
          break;
        }
      }
      nr += dr; nc += dc;
    }
  }
  return false;
}

unitHandlers.iron_golem = MCE.buildUnitHandler({
  move: { style: 'jump', dirs: 'rook', waterBlock: true },
  cannon: 'rook'
});

unitHandlers.ogre = MCE.buildUnitHandler({
  move: { style: 'jump', dirs: 'rook', waterBlock: true },
  cannon: 'rook'
});
unitHandlers.ogre.intimidate = true;

// ── KNIGHT types ──

unitHandlers.knight_h = unitHandlers.salamander = unitHandlers.reaper =
  MCE.buildUnitHandler({ move: 'knight' });

unitHandlers.orc = {
  genMoves(g, sq, side) {
    const moves = [];
    const [r, c] = MCE.rc(sq, g);
    MCE.genJumps(g, sq, r, c, side, KNIGHT, moves);
    for (const [dr, dc] of RD) {
      const nr = r + dr * 2, nc = c + dc * 2;
      if (!MCE.onBoard(nr, nc, g)) continue;
      const mid = MCE.sq(r + dr, c + dc, g);
      if (isWaterAt(g, mid) || g.board[mid]) continue;
      const target = MCE.sq(nr, nc, g);
      if (isWaterAt(g, target)) continue;
      if (MCE.isFriendly(target, side, g)) continue;
      const tp = g.board[target];
      if (tp) moves.push({ from: sq, to: target, flag: 'capture' });
      else moves.push({ from: sq, to: target, flag: null });
    }
    return moves;
  },
  attacks(g, from, target) {
    const [fr, fc] = MCE.rc(from, g);
    const [tr, tc] = MCE.rc(target, g);
    const dr = Math.abs(tr - fr), dc = Math.abs(tc - fc);
    if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) return true;
    if ((dr === 2 && dc === 0) || (dr === 0 && dc === 2)) return true;
    return false;
  }
};

// ── BISHOP types ──

unitHandlers.archer = MCE.buildUnitHandler({ move: 'bishop', attack: 'bishop:gapped' });

unitHandlers.wraith = MCE.buildUnitHandler({ move: 'bishop:gapped', attack: 'bishop' });

unitHandlers.fire_elem = unitHandlers.troll =
  MCE.buildUnitHandler({ move: 'bishop:waterBlock', attack: 'bishop:waterBlock' });

// ── QUEEN types ──

unitHandlers.wizard = MCE.buildUnitHandler({ move: 'rook', attack: 'bishop' });

unitHandlers.vampire = MCE.buildUnitHandler({ move: 'bishop', attack: 'rook' });

unitHandlers.demonics = unitHandlers.shaman =
  MCE.buildUnitHandler({ move: 'queen:waterBlock', attack: 'queen:waterBlock' });

// ── KING types ──

unitHandlers.princess = MCE.buildUnitHandler({ move: ['king:waterBlock', 'bishop'], attack: 'king:waterBlock' });

unitHandlers.warlock = MCE.buildUnitHandler({ move: 'king:waterBlock', attack: ['king:waterBlock', 'bishop'] });

unitHandlers.red_dragon = unitHandlers.warlord =
  MCE.buildUnitHandler({ move: 'king:waterBlock', attack: ['king:waterBlock', 'knight'] });

// ══════════════════════════════════════════════════════════════
// GAME CREATION & STATE SYNC
// ══════════════════════════════════════════════════════════════

function createDungeonGame(map, pieces, players) {
  const terrain = [];
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      terrain.push(map.grid[r][c]);
    }
  }
  const g = MCE.createGame({
    rows: map.rows,
    cols: map.cols,
    terrain: terrain,
    players: players,
    ownershipMode: 'pieceData',
    noCastling: true,
    noEnPassant: true,
    noPromotion: true,
    variant: 'dungeon-chess',
  });
  pieces.forEach(p => {
    const sq = MCE.sq(p.r, p.c, g);
    g.board[sq] = PIECE_CHAR;
    g.pieceData[sq] = { id: p.id, key: p.key, owner: p.owner, isKing: UNITS[p.key].type === PT.K };
  });
  MCE.setLegalityFilter(g, function(gState, move, undo) {
    return !MCE.inCheck(gState, undo.turn);
  });
  MCE.setWinCondition(g, function(gState) {
    const alive = gState.players.filter(o => {
      for (let i = 0; i < gState.rows * gState.cols; i++) {
        const pd = gState.pieceData[i];
        if (pd && pd.owner === o && pd.isKing) return true;
      }
      return false;
    });
    if (alive.length <= 1) return alive.length === 1 ? 'win-' + alive[0] : 'draw';
    return 'active';
  });
  return g;
}

function syncPiecesFromMCE(g) {
  const pieces = [];
  const total = g.rows * g.cols;
  for (let i = 0; i < total; i++) {
    if (g.board[i] && g.pieceData[i]) {
      const [r, c] = MCE.rc(i, g);
      const pd = g.pieceData[i];
      pieces.push({ id: pd.id, key: pd.key, r, c, owner: pd.owner });
    }
  }
  return pieces;
}

function getLegal(piece, g) {
  const sq = MCE.sq(piece.r, piece.c, g);
  const allMoves = MCE.variantLegalMoves(g);
  const pieceMoves = allMoves.filter(m => m.from === sq && m.flag !== 'action');
  const moves = [], attacks = [];
  pieceMoves.forEach(m => {
    const [r, c] = MCE.rc(m.to, g);
    if (m.flag === 'capture' || m.attackOnly) {
      attacks.push([r, c]);
    }
    if (!m.attackOnly) {
      if (m.flag !== 'capture') moves.push([r, c]);
    }
  });
  return { moves, attacks };
}

function findMCEMove(g, fr, fc, tr, tc, flag) {
  const fromSq = MCE.sq(fr, fc, g);
  const toSq = MCE.sq(tr, tc, g);
  const allMoves = MCE.variantLegalMoves(g);
  return allMoves.find(m => m.from === fromSq && m.to === toSq && (!flag || m.flag === flag));
}

function isInCheck(owner, g) {
  return MCE.inCheck(g, owner);
}

function pickAiMove(g, difficulty) {
  return MCE.aiPickMove(g, 50, { difficulty: difficulty || 'medium' });
}

function getPieceAt(g, r, c) {
  const sq = MCE.sq(r, c, g);
  return g.pieceData[sq] || null;
}

function countPieces(g, owner) {
  let count = 0;
  const total = g.rows * g.cols;
  for (let i = 0; i < total; i++) {
    const pd = g.pieceData[i];
    if (pd && pd.owner === owner) count++;
  }
  return count;
}

function allPieces(g) {
  const result = [];
  const total = g.rows * g.cols;
  for (let i = 0; i < total; i++) {
    if (g.board[i] && g.pieceData[i]) {
      const [r, c] = MCE.rc(i, g);
      const pd = g.pieceData[i];
      result.push({ sq: i, r, c, id: pd.id, key: pd.key, owner: pd.owner });
    }
  }
  return result;
}

return { registerAllUnits, createDungeonGame, syncPiecesFromMCE, getLegal, findMCEMove, isInCheck, pickAiMove, getPieceAt, countPieces, allPieces };
})();
