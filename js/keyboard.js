'use strict'
// ═══════════════════════════════════════════════════════════
// KEYBOARD NAVIGATION & ACCESSIBILITY
// ═══════════════════════════════════════════════════════════

const KB = {
  cursorR: 0,
  cursorC: 0,
  active: false,
}

function kbInit() {
  document.addEventListener('keydown', kbHandleKey)
}

function kbIsOnBattle() {
  const el = document.getElementById('screen-battle')
  return el && el.classList.contains('active')
}

function kbHandleKey(e) {
  if (!kbIsOnBattle()) return
  if (G.turn !== 'player' || G.aiThinking) return

  const map = G.map
  if (!map) return

  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault()
      kbMoveCursor(e.key, map)
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      kbActivate()
      break
    case 'Escape':
      e.preventDefault()
      kbDeselect()
      break
    case 'Tab':
      kbCyclePanel(e)
      break
  }
}

function kbMoveCursor(key, map) {
  KB.active = true
  let { cursorR, cursorC } = KB
  const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0
  const dc = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0

  let nextR = cursorR + dr
  let nextC = cursorC + dc

  // Skip void squares, wrapping around
  const maxAttempts = Math.max(map.rows, map.cols)
  for (let i = 0; i < maxAttempts; i++) {
    if (nextR < 0) nextR = map.rows - 1
    if (nextR >= map.rows) nextR = 0
    if (nextC < 0) nextC = map.cols - 1
    if (nextC >= map.cols) nextC = 0
    if (map.grid[nextR][nextC] !== null) break
    nextR += dr
    nextC += dc
  }

  if (map.grid[nextR] && map.grid[nextR][nextC] !== null) {
    KB.cursorR = nextR
    KB.cursorC = nextC
  }

  drawBoard()
  kbAnnounceSquare()
}

function kbActivate() {
  if (!KB.active) {
    KB.active = true
    drawBoard()
    return
  }
  handleSquareClick(KB.cursorR, KB.cursorC)
  kbAnnounceAction()
}

function kbDeselect() {
  if (G.selR !== null) {
    G.selR = null
    G.selC = null
    G.legalMoves = []
    G.legalAttacks = []
    document.getElementById('sel-info').innerHTML =
      '<span class="sel-info">Click a piece</span>'
    drawBoard()
    kbAnnounce('Selection cleared')
  }
}

function kbCyclePanel(e) {
  const panels = document.querySelectorAll(
    '#screen-battle .info-panel, #screen-battle .btn'
  )
  if (!panels.length) return
  e.preventDefault()
  const focusable = Array.from(panels)
  const current = document.activeElement
  const idx = focusable.indexOf(current)
  const next = e.shiftKey
    ? (idx <= 0 ? focusable.length - 1 : idx - 1)
    : (idx + 1) % focusable.length
  focusable[next].setAttribute('tabindex', '0')
  focusable[next].focus()
}

// ═══════════════════════════════════════════════════════════
// CURSOR RENDERING (called by renderBoard)
// ═══════════════════════════════════════════════════════════
function kbRenderCursor(svg, map) {
  if (!KB.active) return
  const { cursorR, cursorC } = KB
  if (!map.grid[cursorR] || map.grid[cursorR][cursorC] === null) return

  const x = cursorC * TILE
  const y = cursorR * TILE
  const inset = 2
  const cursor = svgEl('rect', {
    x: x + inset,
    y: y + inset,
    width: TILE - inset * 2,
    height: TILE - inset * 2,
    fill: 'none',
    stroke: '#00e5ff',
    'stroke-width': 2.5,
    'stroke-dasharray': '6,3',
    class: 'kb-cursor',
    'pointer-events': 'none',
  })
  svg.appendChild(cursor)
}

