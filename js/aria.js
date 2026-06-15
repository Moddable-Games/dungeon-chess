import { UNITS } from './data.js'
import { G } from './state.js'
import { DungeonMCE } from './mce-bridge.js'
import { KB } from './keyboard.js'
import { ttShowForCursor } from './tooltip.js'

export function kbEnsureLiveRegion() {
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

export function kbAnnounce(msg) {
  const region = kbEnsureLiveRegion()
  region.textContent = ''
  requestAnimationFrame(() => { region.textContent = msg })
}

export function kbAnnounceSquare() {
  const { cursorR, cursorC } = KB
  const file = String.fromCharCode(97 + cursorC)
  const rank = cursorR + 1
  const piece = G.mceGame ? DungeonMCE.getPieceAt(G.mceGame, cursorR, cursorC) : null
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
  ttShowForCursor()
}

export function kbAnnounceAction() {
  const { cursorR, cursorC } = KB
  const pd = G.mceGame ? DungeonMCE.getPieceAt(G.mceGame, cursorR, cursorC) : null
  const piece = pd && pd.owner === 'player' ? pd : null
  if (piece) {
    const def = UNITS[piece.key]
    kbAnnounce(`Selected ${def.name}`)
  }
}
