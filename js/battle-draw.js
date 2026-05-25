'use strict'
// ═══════════════════════════════════════════════════════════
// DRAW BOARD (calls SVG renderer)
// ═══════════════════════════════════════════════════════════
const G_undoStack = []
let G_lastMove = null

let _lastTile = null
let _tileLocked = false
function lockTileSize() { _tileLocked = true }
function unlockTileSize() { _tileLocked = false }
function drawBoard(excludePieceId) {
  if (G.map && !_tileLocked) computeTile(G.map)
  if (_lastTile !== null && _lastTile !== TILE) invalidateStaticBoard()
  _lastTile = TILE
  const piecesToDraw = excludePieceId
    ? G.pieces.filter(p => p.id !== excludePieceId)
    : G.pieces
  renderBoard(
    G.map, piecesToDraw,
    G.selR, G.selC,
    G.legalMoves, G.legalAttacks,
    handleSquareClick,
    G_lastMove
  )
}

// ═══════════════════════════════════════════════════════════
// PIECE MOVE ANIMATION
// ═══════════════════════════════════════════════════════════
const MOVE_DURATION = 350

function animateMove(piece, fr, fc, tr, tc, isCapture, callback) {
  const svg = document.getElementById('dungeon-board')
  if (!svg || !G.map) { callback(); return }

  // Redraw the board WITHOUT the moving piece so it disappears from origin
  drawBoard(piece.id)

  const fromX = fc * TILE
  const fromY = fr * TILE
  const toX = tc * TILE
  const toY = tr * TILE

  const def = UNITS[piece.key]
  const ownerSp = piece.owner === 'player' ? G.playerSp
    : piece.owner === 'ai' ? G.aiSp
    : piece.owner === 'ai2' ? G.ai2Sp : G.ai3Sp
  const color = spToColor(ownerSp)
  const sid = color + FEN_CH[def.type]
  const sz = TILE * 0.88
  const offset = (TILE - sz) / 2

  // Create floating animated piece group on top of everything
  const anim = svgEl('g', { class: 'piece-anim' })
  anim.style.pointerEvents = 'none'

  // Shadow (grows during arc)
  const shadow = svgEl('ellipse', {
    cx: TILE / 2, cy: TILE - 4, rx: TILE * 0.28, ry: 3.5,
    fill: 'rgba(0,0,0,0.5)'
  })
  anim.appendChild(shadow)

  // Piece sprite
  const use = svgEl('use', { href: `#piece-${sid}`, x: offset, y: offset, width: sz, height: sz })
  anim.appendChild(use)

  appendPieceTint(anim, ownerSp, offset, sz)

  anim.setAttribute('transform', `translate(${fromX},${fromY})`)
  svg.appendChild(anim)

  const startTime = performance.now()
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Arc height proportional to distance, capped
  const arcHeight = Math.min(dist * 0.25, TILE * 0.8)

  function frame(now) {
    const elapsed = now - startTime
    const t = Math.min(elapsed / MOVE_DURATION, 1)

    // Ease: fast start, cushioned landing
    const ease = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2

    const cx = fromX + dx * ease
    const cy = fromY + dy * ease
    // Parabolic arc
    const arc = arcHeight * 4 * t * (1 - t)
    // Scale up during flight
    const scale = 1 + 0.2 * Math.sin(t * Math.PI)

    anim.setAttribute('transform',
      `translate(${cx},${cy - arc}) scale(${scale})`)

    // Shadow spreads and fades as piece lifts
    shadow.setAttribute('rx', TILE * 0.28 + arc * 0.15)
    shadow.setAttribute('ry', 3.5 + arc * 0.08)
    shadow.setAttribute('fill', `rgba(0,0,0,${0.5 - arc * 0.003})`)
    // Shadow stays on ground plane
    shadow.setAttribute('cy', TILE - 4 + arc)

    if (t < 1) {
      requestAnimationFrame(frame)
    } else {
      anim.remove()
      callback()
    }
  }

  requestAnimationFrame(frame)
}

// Capture burst effect
function flashCapture(tr, tc) {
  const svg = document.getElementById('dungeon-board')
  if (!svg) return

  const cx = tc * TILE + TILE / 2
  const cy = tr * TILE + TILE / 2

  const flash = svgEl('g', { style: 'pointer-events:none' })

  // Expanding ring
  const ring = svgEl('circle', { cx, cy, r: TILE * 0.15,
    fill: 'none', stroke: 'rgba(255,100,40,0.95)', 'stroke-width': 3 })
  flash.appendChild(ring)

  // Spark particles
  const particleCount = 8
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2
    flash.appendChild(svgEl('circle', {
      cx: cx + Math.cos(angle) * TILE * 0.1,
      cy: cy + Math.sin(angle) * TILE * 0.1,
      r: 2.5, fill: 'rgba(255,220,60,0.95)'
    }))
  }

  // Inner flash
  const innerFlash = svgEl('circle', { cx, cy, r: TILE * 0.3,
    fill: 'rgba(255,200,80,0.4)' })
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

// ═══════════════════════════════════════════════════════════
// INTERACTION
// ═══════════════════════════════════════════════════════════
function handleSquareClick(r, c) {
  if (G.turn !== 'player' || G.aiThinking) return

  // Shaman hex targeting mode
  if (G.hexTargeting) {
    const target = G.pieces.find(p => p.r === r && p.c === c && p.owner !== 'player')
    if (target) {
      G.hexUsed[G.hexTargeting] = true
      G.hexImmobilised[target.id] = 2
      addLog(`⚡ Shaman hexes ${UNITS[target.key].name}!`)
      G.hexTargeting = null
      G.selR = null; G.selC = null; G.legalMoves = []; G.legalAttacks = []
      MCE.advanceTurn(G.mceGame)
      G.turn = G.mceGame.turn
      tickHexCounters()
      document.getElementById('sel-info').innerHTML = '<span class="sel-info">Click a piece</span>'
      if (G.turn !== 'player') {
        G.aiThinking = true; updateUI(); drawBoard()
        G.aiTimer = setTimeout(runAi, 500 + Math.random() * 500)
      } else {
        updateUI(); drawBoard()
      }
    }
    return
  }

  // Salamander retreat mode
  if (G.salamanderRetreat) {
    const valid = G.legalMoves.some(([lr, lc]) => lr === r && lc === c)
    if (valid) {
      const sal = G.salamanderRetreat
      const fromSq = MCE.sq(sal.r, sal.c, G.mceGame)
      const toSq = MCE.sq(r, c, G.mceGame)
      G.mceGame.board[fromSq] = null
      G.mceGame.pieceData[toSq] = G.mceGame.pieceData[fromSq]
      G.mceGame.pieceData[fromSq] = null
      G.mceGame.board[toSq] = 'X'
      addLog(`Salamander retreats to ${String.fromCharCode(97+c)}${r+1}`)
      G.salamanderRetreat = null
      G.selR = null; G.selC = null; G.legalMoves = []; G.legalAttacks = []
      G.pieces = DungeonMCE.syncPiecesFromMCE(G.mceGame)
      if (G.turn !== 'player') {
        G.aiThinking = true; updateUI(); drawBoard()
        G.aiTimer = setTimeout(runAi, 500 + Math.random() * 500)
      } else {
        updateUI(); drawBoard()
      }
    }
    return
  }

  const isLegal = G.legalMoves.some(([lr, lc]) => lr === r && lc === c)
  const isAttack = G.legalAttacks.some(([ar, ac]) => ar === r && ac === c)
  if ((isLegal || isAttack) && G.selR !== null) {
    applyMove('player', G.selR, G.selC, r, c)
    return
  }

  const piece = G.pieces.find(p => p.r === r && p.c === c && p.owner === 'player')
  if (piece) {
    const sq = MCE.sq(piece.r, piece.c, G.mceGame)
    const allLegal = MCE.legalMoves(G.mceGame)
    const pieceLegal = allLegal.filter(m => m.from === sq)
    const safeMoves = [], safeAttacks = []
    pieceLegal.forEach(m => {
      const [mr, mc] = MCE.rc(m.to, G.mceGame)
      if (m.flag === 'capture' || m.attackOnly) safeAttacks.push([mr, mc])
      if (!m.attackOnly && m.flag !== 'capture') safeMoves.push([mr, mc])
    })
    G.selR = r; G.selC = c; G.legalMoves = safeMoves; G.legalAttacks = safeAttacks
    showSelected(piece)
  } else {
    G.selR = null; G.selC = null; G.legalMoves = []; G.legalAttacks = []
    document.getElementById('sel-info').innerHTML = '<span class="sel-info">Click a piece</span>'
  }
  drawBoard()
}

// ═══════════════════════════════════════════════════════════
// APPLY MOVE
// ═══════════════════════════════════════════════════════════
function applyMove(owner, fr, fc, tr, tc) {
  const piece = G.pieces.find(p => p.r === fr && p.c === fc && p.owner === owner)
  if (!piece) return

  const captured = G.pieces.find(p => p.r === tr && p.c === tc && p.owner !== owner)
  const isCapture = !!captured

  G.aiThinking = true

  animateMove(piece, fr, fc, tr, tc, isCapture, () => {
    // Execute move in MCE
    const mceMove = DungeonMCE.findMCEMove(G.mceGame, fr, fc, tr, tc)
    const mceUndo = mceMove ? MCE.makeMove(G.mceGame, mceMove) : null

    G_undoStack.push({
      pieceId: piece.id, fr, fc, tr, tc,
      capturedPiece: captured ? { ...captured } : null,
      owner,
      mceUndo
    })
    G_lastMove = { fr, fc, tr, tc }

    if (captured) {
      // Troll thick-skinned: first capture is absorbed — push back instead
      if (captured.key === 'troll' && !G.trollWounded[captured.id]) {
        G.trollWounded[captured.id] = true;
        const pushR = tr + (tr - fr > 0 ? 1 : tr - fr < 0 ? -1 : 0);
        const pushC = tc + (tc - fc > 0 ? 1 : tc - fc < 0 ? -1 : 0);
        let landR = pushR, landC = pushC;
        const landTerrain = MCE.onBoard(landR, landC, G.mceGame) ? MCE.getTerrain(MCE.sq(landR, landC, G.mceGame), G.mceGame) : null;
        if (!MCE.onBoard(landR, landC, G.mceGame) || landTerrain === 'w' || landTerrain === 2 || G.mceGame.board[MCE.sq(landR, landC, G.mceGame)]) {
          landR = tr; landC = tc;
        }
        const landSq = MCE.sq(landR, landC, G.mceGame);
        G.mceGame.board[landSq] = 'X';
        G.mceGame.pieceData[landSq] = { id: captured.id, key: 'troll', owner: captured.owner, isKing: false };
        addLog(`${UNITS.troll.name} absorbs the blow! Pushed to ${String.fromCharCode(97+landC)}${landR+1}`);
      } else {
        if (owner === 'player') G.capturedByPlayer.push(captured.key)
        else G.capturedByAi.push(captured.key)
      }

      // Demonics volatile: on death, destroy all adjacent enemy pieces
      if (captured.key === 'demonics') {
        const [cr, cc] = [tr, tc];
        const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        dirs.forEach(([dr, dc]) => {
          const nr = cr + dr, nc = cc + dc;
          if (!MCE.onBoard(nr, nc, G.mceGame)) return;
          const adjSq = MCE.sq(nr, nc, G.mceGame);
          const adjPd = G.mceGame.pieceData[adjSq];
          if (adjPd && adjPd.owner !== captured.owner) {
            G.mceGame.board[adjSq] = null;
            G.mceGame.pieceData[adjSq] = null;
            if (owner === 'player') G.capturedByPlayer.push(adjPd.key);
            else G.capturedByAi.push(adjPd.key);
          }
        });
      }
    }

    // Salamander hit-and-run: after capture, retreat 1 square
    if (captured && piece.key === 'salamander') {
      const retreatOptions = [];
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = tr + dr, nc = tc + dc;
        if (!MCE.onBoard(nr, nc, G.mceGame)) continue;
        const adjSq = MCE.sq(nr, nc, G.mceGame);
        const t = MCE.getTerrain(adjSq, G.mceGame);
        if (t === 'w' || t === 2 || t === null) continue;
        if (G.mceGame.board[adjSq]) continue;
        retreatOptions.push([nr, nc]);
      }
      if (retreatOptions.length && owner === 'player') {
        G.pieces = DungeonMCE.syncPiecesFromMCE(G.mceGame);
        G.salamanderRetreat = { r: tr, c: tc, id: piece.id };
        G.legalMoves = retreatOptions; G.legalAttacks = [];
        G.selR = tr; G.selC = tc;
        G.aiThinking = false;
        document.getElementById('sel-info').innerHTML =
          `<div class="sel-name">Salamander Retreat</div>
           <div class="sel-meta">Click an adjacent square to retreat to</div>`;
        drawBoard();
        if (isCapture) flashCapture(tr, tc);
        return;
      } else if (retreatOptions.length) {
        // AI auto-picks safest
        const best = retreatOptions.reduce((b, [nr, nc]) => {
          const score = Math.abs(nr - fr) + Math.abs(nc - fc);
          return score > b.score ? { r: nr, c: nc, score } : b;
        }, { r: retreatOptions[0][0], c: retreatOptions[0][1], score: -1 });
        const pSq = MCE.sq(tr, tc, G.mceGame);
        const toSq = MCE.sq(best.r, best.c, G.mceGame);
        G.mceGame.board[pSq] = null;
        G.mceGame.pieceData[toSq] = G.mceGame.pieceData[pSq];
        G.mceGame.pieceData[pSq] = null;
        G.mceGame.board[toSq] = 'X';
        addLog(`Salamander retreats to ${String.fromCharCode(97+best.c)}${best.r+1}`);
      }
    }

    // Sync pieces from MCE state
    G.pieces = DungeonMCE.syncPiecesFromMCE(G.mceGame)

    const ownerLabel = owner === 'player' ? SP_INFO[G.playerSp].emoji + ' You'
      : owner === 'ai' ? SP_INFO[G.aiSp].emoji + ' AI'
      : owner === 'ai2' ? SP_INFO[G.ai2Sp].emoji + ' AI2'
      : SP_INFO[G.ai3Sp].emoji + ' AI3'
    const coord = `${String.fromCharCode(97+fc)}${fr+1}→${String.fromCharCode(97+tc)}${tr+1}`
    const captureLabel = captured ? ` ✕ ${UNITS[captured.key].name}` : ''
    addLog(`${ownerLabel}: ${UNITS[piece.key].name} ${coord}${captureLabel}`)

    // Check win condition via MCE
    const status = MCE.getStatus(G.mceGame)
    if (status && status.startsWith && status.startsWith('win-')) {
      const winner = status.substring(4)
      G.selR = null; G.selC = null; G.legalMoves = []; G.legalAttacks = []
      G.aiThinking = false
      drawBoard()
      if (isCapture) flashCapture(tr, tc)
      return endGame(winner)
    }

    G.selR = null; G.selC = null; G.legalMoves = []; G.legalAttacks = []
    G.turn = G.mceGame.turn
    tickHexCounters()

    if (G.turn === 'player') {
      G.aiThinking = false; updateUI(); drawBoard()
      if (isCapture) flashCapture(tr, tc)
    } else {
      G.aiThinking = true; updateUI(); drawBoard()
      if (isCapture) flashCapture(tr, tc)
      G.aiTimer = setTimeout(runAi, 500 + Math.random() * 500)
    }
  })
}


function tickHexCounters() {
  if (!G.hexImmobilised) return;
  for (const id of Object.keys(G.hexImmobilised)) {
    G.hexImmobilised[id]--;
    if (G.hexImmobilised[id] <= 0) delete G.hexImmobilised[id];
  }
}

function aiTryHex(owner) {
  if (!G.hexUsed || !G.hexImmobilised) return false;
  const shamans = G.pieces.filter(p => p.key === 'shaman' && p.owner === owner && !G.hexUsed[p.id]);
  if (!shamans.length) return false;
  const enemies = G.pieces.filter(p => p.owner !== owner);
  if (!enemies.length) return false;
  const target = enemies.reduce((best, e) => UNITS[e.key].cost > UNITS[best.key].cost ? e : best);
  if (target.key === 'princess' || target.key === 'warlock' || target.key === 'red_dragon' || target.key === 'warlord') return false;
  const shaman = shamans[0];
  G.hexUsed[shaman.id] = true;
  G.hexImmobilised[target.id] = 2;
  addLog(`${SP_INFO[owner === 'ai' ? G.aiSp : owner === 'ai2' ? G.ai2Sp : G.ai3Sp].emoji} Shaman hexes ${UNITS[target.key].name}!`);
  MCE.advanceTurn(G.mceGame);
  G.turn = G.mceGame.turn;
  tickHexCounters();
  return true;
}

// ═══════════════════════════════════════════════════════════
// AI TURN
// ═══════════════════════════════════════════════════════════
function runAi() {
  const owner = G.turn
  // AI considers hex (25% chance if available, to add variety)
  if (Math.random() < 0.25 && aiTryHex(owner)) {
    if (G.turn !== 'player') {
      G.aiTimer = setTimeout(runAi, 500 + Math.random() * 500)
    } else {
      G.aiThinking = false; updateUI(); drawBoard()
    }
    return
  }
  const action = pickAiMove(owner)
  if (!action) {
    MCE.advanceTurn(G.mceGame)
    G.turn = G.mceGame.turn
    if (G.turn !== 'player') {
      G.aiTimer = setTimeout(runAi, 400)
    } else {
      G.aiThinking = false; updateUI(); drawBoard()
    }
    return
  }
  applyMove(owner, action.piece.r, action.piece.c, action.tr, action.tc)
}

function pickAiMove(owner = 'ai') {
  let best = null, bestScore = -Infinity
  const enemyKings = G.pieces.filter(p => p.owner !== owner && UNITS[p.key].type === PT.K)
  G.pieces.filter(p => p.owner === owner).forEach(piece => {
    const { moves: rawMoves, attacks: rawAttacks } = getLegal(piece)
    const moves = rawMoves.filter(([tr, tc]) => !wouldLeaveInCheck(piece, tr, tc))
    const attacks = rawAttacks.filter(([tr, tc]) => !wouldLeaveInCheck(piece, tr, tc))
    attacks.forEach(([tr, tc]) => {
      const t = G.pieces.find(p => p.r === tr && p.c === tc && p.owner !== owner)
      const score = 100 + (t ? UNITS[t.key].cost : 5)
      if (score > bestScore) { bestScore = score; best = { piece, tr, tc } }
    })
    moves.forEach(([tr, tc]) => {
      let minDist = Infinity
      enemyKings.forEach(k => { const d = Math.abs(tr - k.r) + Math.abs(tc - k.c); if (d < minDist) minDist = d })
      if (minDist === Infinity) minDist = Math.abs(tr - Math.floor(G.map.rows / 2)) + Math.abs(tc - Math.floor(G.map.cols / 2))
      const score = 50 - minDist
      if (score > bestScore) { bestScore = score; best = { piece, tr, tc } }
    })
  })
  return best
}
