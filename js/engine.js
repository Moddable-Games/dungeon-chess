import MCE from '../lib/mce/chess-engine.js'
import { DungeonMCE } from './mce-bridge.js'
import { G } from './state.js'

export function getLegal(piece) {
  return DungeonMCE.getLegal(piece, G.mceGame)
}

export function wouldLeaveInCheck(piece, tr, tc) {
  const sq = MCE.sq(piece.r, piece.c, G.mceGame)
  const targetSq = MCE.sq(tr, tc, G.mceGame)
  const allLegal = MCE.legalMoves(G.mceGame)
  return !allLegal.some(m => m.from === sq && m.to === targetSq)
}

export function isInCheck(owner) {
  return DungeonMCE.isInCheck(owner, G.mceGame)
}
