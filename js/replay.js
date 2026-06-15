import MCE from '../lib/mce/chess-engine.js'
import '../lib/mce/chess-play.js'
import '../lib/mce/board-renderer.js'
import { computeTile } from './data.js'
import { G, show, registerScreenHook } from './state.js'
import { DungeonMCE } from './mce-bridge.js'
import { getDCRenderOpts } from './board-renderer.js'

export const RP = { game: null, moves: [], undoStack: [], currentIdx: -1,
  playing: false, timer: null, speed: 800, initialPieces: [] }

export function rpSaveInitial() {
  if (!G.mceGame) return
  RP.initialPieces = DungeonMCE.allPieces(G.mceGame)
}

export function rpStart() {
  if (!G.mceGame || !G.map) return
  RP.moves = G.mceGame.history.slice()
  DungeonMCE.registerAllUnits()
  RP.playing = false
  if (RP.timer) clearInterval(RP.timer)
  RP.timer = null
  show('replay')
  rpGoToStart()
  rpBuildLog()
  document.addEventListener('keydown', rpKeyHandler)
}

function rpKeyHandler(e) {
  const el = document.getElementById('screen-replay')
  if (!el || !el.classList.contains('active')) return
  if (e.key === 'ArrowRight') { e.preventDefault(); rpStepForward() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); rpStepBack() }
  else if (e.key === ' ') { e.preventDefault(); rpTogglePlay() }
}

function rpRender() {
  if (!G.map || !RP.game) return
  computeTile(G.map)
  const container = document.getElementById('replay-board-area')
  if (!container) return
  const opts = getDCRenderOpts()
  opts.suppressHighlights = true
  if (RP.currentIdx >= 0) {
    const m = RP.moves[RP.currentIdx]
    opts.lastMove = { from: m.from, to: m.to }
  }
  MCE.renderBoard(container, RP.game, opts)
}

export function rpStepForward() {
  if (RP.currentIdx >= RP.moves.length - 1) {
    rpPause()
    return
  }
  RP.currentIdx++
  rpGoToMove(RP.currentIdx)
}

export function rpStepBack() {
  if (RP.currentIdx < 0) return
  RP.currentIdx--
  rpGoToMove(RP.currentIdx)
}

function rpGoToMove(target) {
  DungeonMCE.registerAllUnits()
  const pieces = RP.initialPieces.slice()
  RP.game = DungeonMCE.createDungeonGame(G.map, pieces, G.mceGame.players.slice())
  RP.undoStack = []
  for (let i = 0; i <= target; i++) {
    RP.undoStack.push(MCE.makeMove(RP.game, RP.moves[i]))
  }
  rpRender()
  rpUpdateControls()
  rpHighlightLog()
}

export function rpGoToStart() {
  rpPause()
  RP.currentIdx = -1
  DungeonMCE.registerAllUnits()
  const pieces = RP.initialPieces.slice()
  RP.game = DungeonMCE.createDungeonGame(G.map, pieces, G.mceGame.players.slice())
  RP.undoStack = []
  rpRender()
  rpUpdateControls()
  rpHighlightLog()
}

export function rpGoToEnd() {
  rpPause()
  RP.currentIdx = RP.moves.length - 1
  rpGoToMove(RP.currentIdx)
}

function rpPlay() {
  if (RP.currentIdx >= RP.moves.length - 1) rpGoToStart()
  RP.playing = true
  rpUpdateControls()
  RP.timer = setInterval(() => rpStepForward(), RP.speed)
}

export function rpPause() { RP.playing = false; if (RP.timer) { clearInterval(RP.timer); RP.timer = null }; rpUpdateControls() }
export function rpTogglePlay() { RP.playing ? rpPause() : rpPlay() }

function rpUpdateControls() {
  const idx = RP.currentIdx
  const total = RP.moves.length
  document.getElementById('rp-counter').textContent =
    `${idx + 1} / ${total}`
  document.getElementById('rp-start').disabled = idx < 0
  document.getElementById('rp-back').disabled = idx < 0
  document.getElementById('rp-fwd').disabled = idx >= total - 1
  document.getElementById('rp-end').disabled = idx >= total - 1
  document.getElementById('rp-play').textContent = RP.playing ? '⏸' : '▶'
}

function rpHighlightLog() {
  const list = document.getElementById('rp-log')
  if (!list) return
  list.querySelectorAll('.rp-entry').forEach((el, i) => {
    el.classList.toggle('rp-active', i === RP.currentIdx)
  })
  const active = list.querySelector('.rp-active')
  if (active) active.scrollIntoView({ block: 'nearest' })
}

registerScreenHook('replay', rpBuildLog)

export function rpBuildLog() {
  const list = document.getElementById('rp-log')
  if (!list) return
  list.innerHTML = RP.moves.map((m, i) => {
    const pd = G.mceGame.pieceData ? null : null
    const [fr, fc] = MCE.rc(m.from, G.mceGame)
    const [tr, tc] = MCE.rc(m.to, G.mceGame)
    const coord = `${String.fromCharCode(97+fc)}${fr+1}→${String.fromCharCode(97+tc)}${tr+1}`
    return `<div class="rp-entry" data-i="${i}">${coord}</div>`
  }).join('')
  list.querySelectorAll('.rp-entry').forEach(el => {
    el.onclick = () => { rpPause(); RP.currentIdx = +el.dataset.i; rpGoToMove(RP.currentIdx) }
  })
}
