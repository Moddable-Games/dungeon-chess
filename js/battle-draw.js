'use strict'
// ═══════════════════════════════════════════════════════════
// BATTLE CONTROLLER + ANIMATION
// ═══════════════════════════════════════════════════════════
let G_lastMove = null
let G_controller = null
const G_undoStack = []

let _lastTile = null
let _tileLocked = false
function lockTileSize() { _tileLocked = true }
function unlockTileSize() { _tileLocked = false }

// ═══════════════════════════════════════════════════════════
// GAME CONTROLLER SETUP — MCE.renderBoard with DC hooks
// ═══════════════════════════════════════════════════════════
let _dcOpts = null

function createBattleController() {
  const players = {}
  G.mceGame.players.forEach(p => { players[p] = p === 'player' ? 'human' : 'ai' })

  const boardContainer = document.getElementById('mce-board-area')
  const WALL = TILE * 2.2
  boardContainer.style.top = WALL + 'px'
  boardContainer.style.left = WALL + 'px'
  boardContainer.style.width = (G.map.cols * TILE) + 'px'
  boardContainer.style.height = (G.map.rows * TILE) + 'px'

  _dcOpts = getDCRenderOpts()

  G_controller = MCE.createGameController(boardContainer, G.mceGame, {
    players: players,
    aiDifficulty: 'medium',
    renderOpts: _dcOpts,

    onRender: function(game) {
      G.turn = game.turn
      updateUI()
    },

    onSquareClick: function(sq, game, api) {
      if (G.hexTargeting) {
        const targetPd = game.pieceData[sq]
        if (targetPd && targetPd.owner !== 'player') {
          const shamanPd = G.hexTargeting
          const [sr, sc] = MCE.rc(shamanPd.sq, game)
          const [tr, tc] = MCE.rc(sq, game)
          const mceMove = DungeonMCE.findMCEMove(game, sr, sc, tr, tc, 'action')
          if (mceMove) {
            api.executeMove(mceMove)
            addLog(`⚡ Shaman hexes ${UNITS[targetPd.key].name}!`)
          }
          G.hexTargeting = null
        }
        return true
      }
      return false
    },

    onAnimateMove: function(move, game, done) {
      const pd = game.pieceData[move.from]
      if (!pd) { done(); return }
      const [fr, fc] = MCE.rc(move.from, game)
      const [tr, tc] = MCE.rc(move.to, game)
      const captured = game.board[move.to]
      const isHuman = pd.owner === 'player'

      if (!isHuman) { done(); return }

      const animOpts = Object.assign({}, _dcOpts, { excludePiece: move.from })
      MCE.renderBoard(document.getElementById('mce-board-area'), game, animOpts)

      animateMove(pd, fr, fc, tr, tc, !!captured, done)
    },

    onCaptureEffect: function(sq, captured) {
      const [r, c] = MCE.rc(sq, G.mceGame)
      flashCapture(r, c)
    },

    onMove: function(move, undo, captured) {
      const game = G.mceGame
      const pd = game.pieceData[move.to]
      if (!pd) return
      const owner = pd.owner

      if (captured && !undo.captureIntercepted) {
        if (owner === 'player') G.capturedByPlayer.push(undo.pieceDataTo.key)
        else G.capturedByAi.push(undo.pieceDataTo.key)
      }
      if (captured && undo.captureIntercepted) {
        addLog(`${UNITS.troll.name} absorbs the blow!`)
      }

      if (move.flag === 'action') return

      const ownerLabel = owner === 'player' ? SP_INFO[G.playerSp].emoji + ' You'
        : owner === 'ai' ? SP_INFO[G.aiSp].emoji + ' AI'
        : owner === 'ai2' ? SP_INFO[G.ai2Sp].emoji + ' AI2'
        : SP_INFO[G.ai3Sp].emoji + ' AI3'
      const [fr, fc] = MCE.rc(move.from, game)
      const [tr, tc] = MCE.rc(move.to, game)
      const coord = `${String.fromCharCode(97+fc)}${fr+1}→${String.fromCharCode(97+tc)}${tr+1}`
      const pieceKey = pd.key
      const captureLabel = captured && !undo.captureIntercepted && undo.pieceDataTo
        ? ` ✕ ${UNITS[undo.pieceDataTo.key].name}` : ''
      addLog(`${ownerLabel}: ${UNITS[pieceKey].name} ${coord}${captureLabel}`)
    },

    onPendingAction: function(action, legalMoves) {
      document.getElementById('sel-info').innerHTML =
        `<div class="sel-name">Salamander Retreat</div>
         <div class="sel-meta">Click an adjacent square to retreat to</div>`
    },

    onPendingActionEnd: function() {
      document.getElementById('sel-info').innerHTML = '<span class="sel-info">Click a piece</span>'
    },

    onSelect: function(sq, piece, moves) {
      const pd = G.mceGame.pieceData[sq]
      if (pd) {
        const [r, c] = MCE.rc(sq, G.mceGame)
        showSelected({ key: pd.key, owner: pd.owner, r, c, id: pd.id })
      }
    },

    onGameEnd: function(status) {
      if (status && status.startsWith && status.startsWith('win-')) {
        endGame(status.substring(4))
      }
    },

    onTurnChange: function(turn) {
      G.turn = turn
    }
  })

  G_controller.render()
}

function destroyBattleController() {
  if (G_controller) {
    G_controller.destroy()
    G_controller = null
  }
  _dcOpts = null
}

// ═══════════════════════════════════════════════════════════
// PIECE MOVE ANIMATION
// ═══════════════════════════════════════════════════════════
const MOVE_DURATION = 350

function animateMove(pd, fr, fc, tr, tc, isCapture, callback) {
  const svg = document.getElementById('dungeon-board')
  if (!svg || !G.map) { callback(); return }

  const fromX = fc * TILE
  const fromY = fr * TILE
  const toX = tc * TILE
  const toY = tr * TILE

  const def = UNITS[pd.key]
  const ownerSp = pd.owner === 'player' ? G.playerSp
    : pd.owner === 'ai' ? G.aiSp
    : pd.owner === 'ai2' ? G.ai2Sp : G.ai3Sp
  const color = spToColor(ownerSp)
  const sid = color + FEN_CH[def.type]
  const sz = TILE * 0.88
  const offset = (TILE - sz) / 2

  const anim = svgEl('g', { class: 'piece-anim' })
  anim.style.pointerEvents = 'none'

  const shadow = svgEl('ellipse', {
    cx: TILE / 2, cy: TILE - 4, rx: TILE * 0.28, ry: 3.5,
    fill: 'rgba(0,0,0,0.5)'
  })
  anim.appendChild(shadow)

  const use = svgEl('use', { href: `#piece-${sid}`, x: offset, y: offset, width: sz, height: sz })
  anim.appendChild(use)

  appendPieceTint(anim, ownerSp, offset, sz)

  anim.setAttribute('transform', `translate(${fromX},${fromY})`)
  svg.appendChild(anim)

  const startTime = performance.now()
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.sqrt(dx * dx + dy * dy)
  const arcHeight = Math.min(dist * 0.25, TILE * 0.8)

  function frame(now) {
    const elapsed = now - startTime
    const t = Math.min(elapsed / MOVE_DURATION, 1)
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const cx = fromX + dx * ease
    const cy = fromY + dy * ease
    const arc = arcHeight * 4 * t * (1 - t)
    const scale = 1 + 0.2 * Math.sin(t * Math.PI)

    anim.setAttribute('transform', `translate(${cx},${cy - arc}) scale(${scale})`)
    shadow.setAttribute('rx', TILE * 0.28 + arc * 0.15)
    shadow.setAttribute('ry', 3.5 + arc * 0.08)
    shadow.setAttribute('fill', `rgba(0,0,0,${0.5 - arc * 0.003})`)
    shadow.setAttribute('cy', TILE - 4 + arc)

    if (t < 1) requestAnimationFrame(frame)
    else { anim.remove(); callback() }
  }
  requestAnimationFrame(frame)
}

function flashCapture(tr, tc) {
  const svg = document.getElementById('dungeon-board')
  if (!svg) return
  const cx = tc * TILE + TILE / 2
  const cy = tr * TILE + TILE / 2
  const flash = svgEl('g', { style: 'pointer-events:none' })
  const ring = svgEl('circle', { cx, cy, r: TILE * 0.15,
    fill: 'none', stroke: 'rgba(255,100,40,0.95)', 'stroke-width': 3 })
  flash.appendChild(ring)
  const particleCount = 8
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2
    flash.appendChild(svgEl('circle', {
      cx: cx + Math.cos(angle) * TILE * 0.1,
      cy: cy + Math.sin(angle) * TILE * 0.1,
      r: 2.5, fill: 'rgba(255,220,60,0.95)'
    }))
  }
  const innerFlash = svgEl('circle', { cx, cy, r: TILE * 0.3, fill: 'rgba(255,200,80,0.4)' })
  flash.appendChild(innerFlash)
  svg.appendChild(flash)
  const start = performance.now()
  const FLASH_DURATION = 400
  function frameFlash(now) {
    const t = Math.min((now - start) / FLASH_DURATION, 1)
    const ease = 1 - Math.pow(1 - t, 3)
    ring.setAttribute('r', TILE * 0.15 + ease * TILE * 0.6)
    ring.setAttribute('stroke-opacity', 1 - ease)
    ring.setAttribute('stroke-width', 3 * (1 - ease * 0.7))
    innerFlash.setAttribute('r', TILE * 0.3 * (1 - ease))
    innerFlash.setAttribute('opacity', 1 - ease)
    const particles = flash.querySelectorAll('circle:not(:first-child):not(:last-child)')
    particles.forEach((p, i) => {
      const angle = (i / particleCount) * Math.PI * 2
      const dist = TILE * 0.1 + ease * TILE * 0.55
      p.setAttribute('cx', cx + Math.cos(angle) * dist)
      p.setAttribute('cy', cy + Math.sin(angle) * dist)
      p.setAttribute('opacity', 1 - ease * ease)
      p.setAttribute('r', 2.5 * (1 - ease * 0.5))
    })
    if (t < 1) requestAnimationFrame(frameFlash)
    else flash.remove()
  }
  requestAnimationFrame(frameFlash)
}
