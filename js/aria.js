'use strict'
// ═══════════════════════════════════════════════════════════
// ARIA ANNOUNCEMENTS FOR SCREEN READERS
// ═══════════════════════════════════════════════════════════

function kbEnsureLiveRegion() {
  let region = document.getElementById('aria-live-region')
  if (!region) {
    region = document.createElement('div')
    region.id = 'aria-live-region'
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    region.className = 'sr-only'
    document.body.appendChild(region)
  }
  return region
}

function kbAnnounce(msg) {
  const region = kbEnsureLiveRegion()
  region.textContent = ''
  requestAnimationFrame(() => { region.textContent = msg })
}

function kbAnnounceSquare() {
  const { cursorR, cursorC } = KB
  const file = String.fromCharCode(97 + cursorC)
  const rank = cursorR + 1
  const piece = G.pieces.find(p => p.r === cursorR && p.c === cursorC)
  let msg = `${file}${rank}`
  if (piece) {
    const def = UNITS[piece.key]
    const owner = piece.owner === 'player' ? 'Your' : 'Enemy'
    msg += `, ${owner} ${def.name}`
  }
  const isLegal = G.legalMoves.some(
    ([r, c]) => r === cursorR && c === cursorC
  )
  const isAttack = G.legalAttacks.some(
    ([r, c]) => r === cursorR && c === cursorC
  )
  if (isLegal) msg += ', valid move'
  if (isAttack) msg += ', can attack'
  kbAnnounce(msg)
  // Show tooltip for keyboard-focused piece
  if (typeof ttShowForCursor === 'function') ttShowForCursor()
}

function kbAnnounceAction() {
  const { cursorR, cursorC } = KB
  const piece = G.pieces.find(
    p => p.r === cursorR && p.c === cursorC && p.owner === 'player'
  )
  if (piece) {
    const def = UNITS[piece.key]
    kbAnnounce(`Selected ${def.name}`)
  }
}
