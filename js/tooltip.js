'use strict'
// ═══════════════════════════════════════════════════════════
// UNIT TOOLTIPS — hover/focus shows name, species, cost
// ═══════════════════════════════════════════════════════════
const TT = { visible: false, pieceKey: null }

function ttInit() {
  const svg = document.getElementById('dungeon-board')
  if (!svg) return

  svg.addEventListener('mousemove', ttHandleHover)
  svg.addEventListener('mouseleave', ttHide)
}

function ttGetEl() {
  let el = document.getElementById('unit-tooltip')
  if (!el) {
    el = document.createElement('div')
    el.id = 'unit-tooltip'
    el.className = 'unit-tooltip'
    el.setAttribute('role', 'tooltip')
    el.setAttribute('aria-hidden', 'true')
    document.getElementById('board-wrap').appendChild(el)
  }
  return el
}

function ttHandleHover(e) {
  const svg = document.getElementById('dungeon-board')
  if (!svg || !G.map) return

  const rect = svg.getBoundingClientRect()
  const { cols, rows } = G.map
  const WALL = TILE * 2.2
  const totalW = cols * TILE + WALL * 2
  const totalH = rows * TILE + WALL * 2
  const svgX = (e.clientX - rect.left) / rect.width * totalW - WALL
  const svgY = (e.clientY - rect.top) / rect.height * totalH - WALL

  const hoverR = Math.floor(svgY / TILE)
  const hoverC = Math.floor(svgX / TILE)

  if (hoverR < 0 || hoverR >= rows || hoverC < 0 || hoverC >= cols) {
    ttHide()
    return
  }

  const piece = G.pieces.find(p => p.r === hoverR && p.c === hoverC)
  if (!piece) {
    ttHide()
    return
  }

  ttShow(piece, e.clientX, e.clientY)
}

function ttShow(piece, clientX, clientY) {
  const def = UNITS[piece.key]
  const spKey = piece.owner === 'player' ? G.playerSp
    : piece.owner === 'ai' ? G.aiSp
    : piece.owner === 'ai2' ? G.ai2Sp : G.ai3Sp
  const spInfo = SP_INFO[spKey]

  const el = ttGetEl()
  const owner = piece.owner === 'player' ? 'You' : 'AI'
  const abilities = ttGetAbilities(piece.key)

  el.innerHTML = `<div class="tt-name">${def.name}</div>`
    + `<div class="tt-meta">${spInfo.emoji} ${spInfo.label} · ${def.type}</div>`
    + `<div class="tt-cost">${def.cost} XP</div>`
    + (abilities ? `<div class="tt-abilities">${abilities}</div>` : '')
    + `<div class="tt-owner">${owner}</div>`

  el.setAttribute('aria-hidden', 'false')
  el.classList.add('visible')
  TT.visible = true
  TT.pieceKey = piece.key

  // Position relative to the board-wrap container
  const wrap = document.getElementById('board-wrap')
  const wrapRect = wrap.getBoundingClientRect()
  const x = clientX - wrapRect.left + 12
  const y = clientY - wrapRect.top - 10
  el.style.left = x + 'px'
  el.style.top = y + 'px'
}

function ttHide() {
  if (!TT.visible) return
  const el = document.getElementById('unit-tooltip')
  if (el) {
    el.classList.remove('visible')
    el.setAttribute('aria-hidden', 'true')
  }
  TT.visible = false
  TT.pieceKey = null
}

const TT_ABILITIES = {
  hero: 'Moves & attacks 1 sq any direction',
  skeleton: 'Moves & attacks 1 sq any direction',
  kobold: 'Pawn + cannon attack (rook lines)',
  goblin: 'Pawn + cannon attack (rook lines)',
  stronghold: 'Steps 1 orthogonal; attacks along rook lines',
  tomb: 'Steps 1 orthogonal; attacks along rook lines',
  iron_golem: 'Steps 1 orthogonal + cannon attack (rook lines)',
  ogre: 'Steps 1 orthogonal + cannon attack (rook lines)',
  knight_h: 'L-shape jump, leaps over pieces',
  reaper: 'L-shape jump, leaps over pieces',
  salamander: 'L-shape jump, leaps over pieces',
  orc: 'L-shape jump, leaps over pieces',
  archer: 'Diagonal slide; attacks across gaps, can\'t move across',
  wraith: 'Diagonal slide; moves across gaps, can\'t attack across',
  fire_elem: 'Diagonal slide; blocked by water',
  troll: 'Diagonal slide; blocked by water',
  wizard: 'Moves as rook; attacks as bishop',
  vampire: 'Moves as bishop; attacks as rook',
  demonics: 'Queen slide; can\'t attack across water',
  shaman: 'Queen slide; can\'t attack across water',
  princess: 'King step + bishop slide (move only)',
  warlock: 'King step + bishop attack (ranged)',
  red_dragon: 'King step + knight attack (ranged)',
  warlord: 'King step + knight attack (ranged)',
}
function ttGetAbilities(unitKey) { return TT_ABILITIES[unitKey] || '' }

// Show tooltip on keyboard cursor focus
function ttShowForCursor() {
  if (!KB.active || !G.map) return
  const piece = G.pieces.find(
    p => p.r === KB.cursorR && p.c === KB.cursorC
  )
  if (!piece) {
    ttHide()
    return
  }
  // Position at centre of the cursor square
  const svg = document.getElementById('dungeon-board')
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const WALL = TILE * 2.2
  const { cols, rows } = G.map
  const totalW = cols * TILE + WALL * 2
  const totalH = rows * TILE + WALL * 2
  const sqCX = (KB.cursorC * TILE + TILE / 2 + WALL) / totalW * rect.width + rect.left
  const sqCY = (KB.cursorR * TILE + TILE / 2 + WALL) / totalH * rect.height + rect.top
  ttShow(piece, sqCX, sqCY)
}
