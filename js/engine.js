'use strict';
// ═══════════════════════════════════════════════════════════
// MOVEMENT ENGINE — delegates to MCE via DungeonMCE bridge
// ═══════════════════════════════════════════════════════════

function getLegal(piece) {
  return DungeonMCE.getLegal(piece, G.mceGame);
}

function wouldLeaveInCheck(piece, tr, tc) {
  const sq = MCE.sq(piece.r, piece.c, G.mceGame);
  const targetSq = MCE.sq(tr, tc, G.mceGame);
  const allLegal = MCE.legalMoves(G.mceGame);
  return !allLegal.some(m => m.from === sq && m.to === targetSq);
}

function isInCheck(owner) {
  return DungeonMCE.isInCheck(owner, G.mceGame);
}
