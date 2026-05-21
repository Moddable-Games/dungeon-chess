'use strict'
// ═══════════════════════════════════════════════════════════
// GAME REPLAY — step through recorded moves
// ═══════════════════════════════════════════════════════════

const RP = { initialPieces:[], moves:[], currentIdx:-1, pieces:[],
  playing:false, timer:null, speed:800 }

function rpSaveInitial() {
  RP.initialPieces = G.pieces.map(p => ({ ...p }))
}

function rpSaveMoves() {
  RP.moves = G_undoStack.map(m => ({ ...m }))
}

function rpStart() {
  rpSaveMoves()
  RP.currentIdx = -1
  RP.pieces = RP.initialPieces.map(p => ({ ...p }))
  RP.playing = false
  if (RP.timer) clearInterval(RP.timer)
  RP.timer = null
  show('replay')
  rpRender()
  rpUpdateControls()
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
  if (!G.map) return
  computeTile(G.map)
  const highlight = RP.currentIdx >= 0
    ? { fr: RP.moves[RP.currentIdx].fr, fc: RP.moves[RP.currentIdx].fc,
        tr: RP.moves[RP.currentIdx].tr, tc: RP.moves[RP.currentIdx].tc }
    : null
  renderBoard(G.map, RP.pieces, null, null, [], [], null, highlight, 'replay-svg')
}

function rpStepForward() {
  if (RP.currentIdx >= RP.moves.length - 1) {
    rpPause()
    return
  }
  RP.currentIdx++
  const m = RP.moves[RP.currentIdx]
  const piece = RP.pieces.find(p => p.id === m.pieceId)
  if (piece) { piece.r = m.tr; piece.c = m.tc }
  if (m.capturedPiece) {
    RP.pieces = RP.pieces.filter(p => p.id !== m.capturedPiece.id)
  }
  rpRender()
  rpUpdateControls()
  rpHighlightLog()
}

function rpStepBack() {
  if (RP.currentIdx < 0) return
  const m = RP.moves[RP.currentIdx]
  const piece = RP.pieces.find(p => p.id === m.pieceId)
  if (piece) { piece.r = m.fr; piece.c = m.fc }
  if (m.capturedPiece) {
    RP.pieces.push({ ...m.capturedPiece })
  }
  RP.currentIdx--
  rpRender()
  rpUpdateControls()
  rpHighlightLog()
}

function rpGoToStart() {
  rpPause()
  RP.currentIdx = -1
  RP.pieces = RP.initialPieces.map(p => ({ ...p }))
  rpRender()
  rpUpdateControls()
  rpHighlightLog()
}

function rpGoToEnd() {
  rpPause()
  while (RP.currentIdx < RP.moves.length - 1) {
    RP.currentIdx++
    const m = RP.moves[RP.currentIdx]
    const piece = RP.pieces.find(p => p.id === m.pieceId)
    if (piece) { piece.r = m.tr; piece.c = m.tc }
    if (m.capturedPiece) {
      RP.pieces = RP.pieces.filter(p => p.id !== m.capturedPiece.id)
    }
  }
  rpRender()
  rpUpdateControls()
  rpHighlightLog()
}

function rpPlay() {
  if (RP.currentIdx >= RP.moves.length - 1) rpGoToStart()
  RP.playing = true
  rpUpdateControls()
  RP.timer = setInterval(() => rpStepForward(), RP.speed)
}

function rpPause() { RP.playing = false; if (RP.timer) { clearInterval(RP.timer); RP.timer = null }; rpUpdateControls() }
function rpTogglePlay() { RP.playing ? rpPause() : rpPlay() }

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

function rpBuildLog() {
  const list = document.getElementById('rp-log')
  list.innerHTML = RP.moves.map((m, i) => {
    const p = RP.initialPieces.find(x => x.id === m.pieceId)
    const name = p ? UNITS[p.key].name : '?'
    const c = `${String.fromCharCode(97+m.fc)}${m.fr+1}→${String.fromCharCode(97+m.tc)}${m.tr+1}`
    const cap = m.capturedPiece ? ` ✕ ${UNITS[m.capturedPiece.key].name}` : ''
    return `<div class="rp-entry" data-i="${i}">${m.owner==='player'?'You':'AI'}: ${name} ${c}${cap}</div>`
  }).join('')
  list.querySelectorAll('.rp-entry').forEach(el => {
    el.onclick = () => { rpPause(); rpGoToStart(); while (RP.currentIdx < +el.dataset.i) rpStepForward() }
  })
}
