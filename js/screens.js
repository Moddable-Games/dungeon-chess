'use strict'
// ═══════════════════════════════════════════════════════════
// PLACEMENT SCREEN
// ═══════════════════════════════════════════════════════════

// Placement state
const PL = {
  selectedTrayIdx: null,  // index into placementPieces
  placedSquares: {},      // key 'r,c' → { idx, key }
  placementPieces: [],    // [{ key, placed:bool }] — one entry per drafted piece
  spawnRows: [],          // the two rows player may place on
}

function renderPlacementScreen() {
  const pi = SP_INFO[G.playerSp]
  document.getElementById('place-sub').textContent =
    `${pi.emoji} ${pi.label} — place your pieces on the highlighted squares`

  PL.placementPieces = G.playerDraft.map(key => ({ key, placed: false }))
  PL.selectedTrayIdx = null
  PL.placedSquares = {}

  const { grid, rows, cols } = G.map
  const playCols = r => grid[r].map((_,c)=>c).filter(c=>grid[r][c]!==null)

  if (G.numPlayers === 4) {
    // Player spawns in bottom section (rows 17-19, cols 6-13)
    PL.spawnRows = []
    for (let r=rows-1;r>=0;r--) {
      const cs = playCols(r)
      if (cs.length >= 4 && cs.some(c=>c>=6&&c<=13)) PL.spawnRows.push(r)
      if (PL.spawnRows.length >= 2) break
    }

    // AI1: top section
    const topRows = []
    for (let r=0;r<rows;r++) {
      const cs = playCols(r)
      if (cs.length >= 4 && cs.some(c=>c>=6&&c<=13)) topRows.push(r)
      if (topRows.length >= 2) break
    }
    placeAiPieces(topRows, G.aiDraft, 'ai')

    // AI2: left section columns (outermost = back rank)
    placeAiPiecesColumn(G.ai2Draft, 'ai2', true)

    // AI3: right section columns
    placeAiPiecesColumn(G.ai3Draft, 'ai3', false)

  } else {
    // 2-player: bottom rows for player, top rows for AI
    const validRows = []
    for (let r=0;r<rows;r++) {
      if (playCols(r).length >= 4) validRows.push(r)
    }
    PL.spawnRows = validRows.slice(-2)
    placeAiPieces(validRows.slice(0,2), G.aiDraft, 'ai')
  }

  if (G.map) computeTile(G.map)
  _placeSurroundDrawn = false
  renderTray()
  renderPlacementBoard()
  drawPlaceSurroundOnce()
  document.getElementById('confirm-place-btn').disabled = true
  populatePlacePanels()
}

function populatePlacePanels() {
  const pi = SP_INFO[G.playerSp]
  const teamList = document.getElementById('place-team-list')
  teamList.innerHTML = `<div class="place-panel-label">${pi.emoji} ${pi.label}</div>` +
    G.playerDraft.map(k => {
      const u = UNITS[k]
      return `<div class="place-panel-unit">${u.name} <span>${u.type} · ${u.cost}XP</span></div>`
    }).join('')

  const aiList = document.getElementById('place-ai-list')
  const aiSections = [{ sp: G.aiSp, draft: G.aiDraft, label: 'AI' }]
  if (G.numPlayers === 4) {
    aiSections.push({ sp: G.ai2Sp, draft: G.ai2Draft, label: 'AI 2' })
    aiSections.push({ sp: G.ai3Sp, draft: G.ai3Draft, label: 'AI 3' })
  }
  aiList.innerHTML = aiSections.map(({ sp, draft, label }) => {
    const info = SP_INFO[sp]
    return `<div class="place-panel-label">${info.emoji} ${info.label}</div>` +
      draft.map(k => {
        const u = UNITS[k]
        return `<div class="place-panel-unit">${u.name} <span>${u.type}</span></div>`
      }).join('')
  }).join('')
}

function autoPlace() {
  const { grid } = G.map
  const validSquares = []
  PL.spawnRows.forEach(r => {
    grid[r].forEach((cell, c) => {
      if (cell !== null && cell !== 'w' && !PL.placedSquares[`${r},${c}`]) {
        validSquares.push({ r, c })
      }
    })
  })
  for (let i = validSquares.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[validSquares[i], validSquares[j]] = [validSquares[j], validSquares[i]]
  }
  PL.placementPieces.forEach((p, idx) => {
    if (p.placed) return
    const sq = validSquares.shift()
    if (!sq) return
    PL.placedSquares[`${sq.r},${sq.c}`] = { idx, key: p.key }
    p.placed = true
  })
  PL.selectedTrayIdx = null
  document.getElementById('confirm-place-btn').disabled = !PL.placementPieces.every(p => p.placed)
  if (G.map) computeTile(G.map)
  renderTray()
  renderPlacementBoard()
  updatePlaceHint()
}

function placeAiPieces(aiRows, draft=G.aiDraft, owner='ai') {
  const BACK_ORDER = [PT.C, PT.N, PT.B, PT.Q, PT.K, PT.B, PT.N, PT.C]
  const { grid } = G.map
  const playCols = r => grid[r].map((_,c)=>c).filter(c => grid[r][c]!==null && grid[r][c]!=='w')

  const pool     = draft.filter(k => UNITS[k].type !== PT.P)
  const aiPawns  = G.aiDraft.filter(k => UNITS[k].type === PT.P)
  const backRank = []
  BACK_ORDER.forEach(type => {
    const idx = pool.findIndex(k => UNITS[k].type === type)
    if (idx !== -1) backRank.push(pool.splice(idx, 1)[0])
  })
  backRank.push(...pool)

  let id = 1000
  G.pieces = []
  const backCols = playCols(aiRows[0])
  backRank.forEach((key, i) => {
    if (i >= backCols.length) return
    G.pieces.push({ id: id++, key, r: aiRows[0], c: backCols[i], owner: 'ai' })
  })
  const pawnCols = playCols(aiRows[1] ?? aiRows[0])
  aiPawns.forEach((key, i) => {
    if (i >= pawnCols.length) return
    G.pieces.push({ id: id++, key, r: aiRows[1] ?? aiRows[0], c: pawnCols[i], owner: 'ai' })
  })
}

function renderTray() {
  const pi = SP_INFO[G.playerSp]
  const list = document.getElementById('tray-list')
  list.innerHTML = ''
  PL.placementPieces.forEach((p, idx) => {
    const def = UNITS[p.key]
    const div = document.createElement('div')
    div.className = 'tray-piece' +
      (p.placed ? ' placed' : '') +
      (PL.selectedTrayIdx === idx ? ' selected' : '')
    div.innerHTML = `
      <div class="tray-piece-info">
        <div class="tray-piece-name">${def.name}</div>
        <div class="tray-piece-type">${def.type} · ${def.cost}XP</div>
      </div>
      <div class="tray-piece-status${p.placed ? ' tray-piece-status--placed' : ''}">
        ${p.placed ? '✓' : '·'}
      </div>
    `
    if (!p.placed) {
      div.onclick = () => {
        PL.selectedTrayIdx = (PL.selectedTrayIdx === idx) ? null : idx
        renderTray()
        renderPlacementBoard()
      }
    }
    list.appendChild(div)
  })
}

function renderPlacementBoard() {
  const svg = document.getElementById('place-board')
  const { grid, rows, cols } = G.map
  const W = cols * TILE, H = rows * TILE
  const WALL = TILE * 2.2
  // For non-compact maps expand SVG for cavern surround; compact stays as-is
  svg.setAttribute('width',   W + WALL*2)
  svg.setAttribute('height',  H + WALL*2)
  svg.setAttribute('viewBox', `${-WALL} ${-WALL} ${W+WALL*2} ${H+WALL*2}`)
  svg.innerHTML = ''

  ensureSpriteDefs(svg)

  const spawnSet = new Set(PL.spawnRows)
  const selectedPiece = PL.selectedTrayIdx !== null
    ? PL.placementPieces[PL.selectedTrayIdx]
    : null

  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      const cell = grid[r][c]
      if (cell === null) continue

      const x = c * TILE, y = r * TILE
      const isLight = (r+c) % 2 === 0
      const isWater = cell === 'w'
      const isSpawn = spawnSet.has(r) && !isWater
      const sqKey   = `${r},${c}`
      const placed  = PL.placedSquares[sqKey]
      const isSelSq = placed && PL.selectedTrayIdx === null  // clicking to unplace

      const g = svgEl('g', { transform:`translate(${x},${y})`, style:'cursor:pointer' })

      // Background — solid base colour
      let fill = isWater ? (isLight ? SQ_WATER : SQ_WATER2)
                         : (isLight ? SQ_LIGHT : SQ_DARK)
      g.appendChild(svgEl('rect', { class:'sq-bg', x:0, y:0, width:TILE, height:TILE, fill }))

      // Inline stone texture
      if (!isWater) drawStoneTexture(g, isLight)

      // Spawn zone highlight — gold tint for empty valid squares when a piece is selected
      if (isSpawn && !isWater) {
        const isEmpty = !placed
        if (isEmpty && selectedPiece) {
          // Clickable target
          g.appendChild(svgEl('rect', { x:0, y:0, width:TILE, height:TILE,
            fill:'rgba(176,141,45,0.25)', stroke:'rgba(176,141,45,0.6)', 'stroke-width':2 }))
        } else if (!selectedPiece) {
          // Show spawn zone faintly even when nothing selected
          g.appendChild(svgEl('rect', { x:0, y:0, width:TILE, height:TILE,
            fill:'rgba(176,141,45,0.08)' }))
        }
      }

      // Animated water — clipped to square, same as battle board
      if (isWater) {
        const clipId = `pwclip-${r}-${c}`
        const clipPath = svgEl('clipPath', { id: clipId })
        clipPath.appendChild(svgEl('rect', { x:0, y:0, width:TILE, height:TILE }))
        let defs2 = svg.querySelector('defs')
        if (defs2) defs2.appendChild(clipPath)
        const wg = svgEl('g', { 'clip-path':`url(#${clipId})`, 'pointer-events':'none' })
        wg.appendChild(svgEl('rect', { x:0, y:0, width:TILE, height:TILE, fill:'rgba(60,100,160,0.08)' }))
        for (let wi=0; wi<3; wi++) {
          const wy2 = TILE*(0.22+wi*0.26)
          const wc = ['wva','wvb','wvc'][wi]
          const wv = svgEl('path', {
            d:`M -4 ${wy2} Q ${TILE*0.25} ${wy2-4} ${TILE/2} ${wy2} Q ${TILE*0.75} ${wy2+4} ${TILE+4} ${wy2}`,
            stroke:'rgba(140,200,255,0.40)', 'stroke-width':1.2, fill:'none'
          })
          wv.setAttribute('class', wc)
          wg.appendChild(wv)
          const wv2 = svgEl('path', {
            d:`M -4 ${wy2+4} Q ${TILE*0.30} ${wy2+1} ${TILE/2} ${wy2+4} Q ${TILE*0.70} ${wy2+7} ${TILE+4} ${wy2+4}`,
            stroke:'rgba(80,150,220,0.22)', 'stroke-width':0.8, fill:'none'
          })
          wv2.setAttribute('class', ['wvc','wva','wvb'][wi])
          wg.appendChild(wv2)
        }
        g.appendChild(wg)
      }

      // AI pieces — themed sprite with species colour filter
      const aiPiece = G.pieces.find(p => p.r===r && p.c===c && ['ai','ai2','ai3'].includes(p.owner))
      if (aiPiece) {
        const def = UNITS[aiPiece.key]
        const aiSp2 = aiPiece.owner==='ai'?G.aiSp:aiPiece.owner==='ai2'?G.ai2Sp:G.ai3Sp
        const sid = spToColor(aiSp2) + FEN_CH[def.type]
        const offset = (TILE - TILE*0.9) / 2
        const sz = TILE*0.9
        g.appendChild(svgEl('ellipse', { cx:TILE/2, cy:TILE-5, rx:TILE*0.3, ry:4, fill:'rgba(0,0,0,0.2)' }))
        const aiUse = svgEl('use', { href:`#piece-${sid}`, x:offset, y:offset, width:sz, height:sz })
        g.appendChild(aiUse)
        const aiTint = SP_PIECE_COLOR[aiSp2]
        if (aiTint) g.appendChild(svgEl('rect',{x:offset,y:offset,width:sz,height:sz,fill:aiTint,style:'pointer-events:none;mix-blend-mode:multiply'}))
      }

      // Player pieces with correct species colour
      if (placed) {
        const def = UNITS[placed.key]
        const sid = spToColor(G.playerSp) + FEN_CH[def.type]
        const offset = (TILE - TILE*0.9) / 2
        const sz = TILE*0.9
        g.appendChild(svgEl('ellipse', { cx:TILE/2, cy:TILE-5, rx:TILE*0.3, ry:4, fill:'rgba(0,0,0,0.25)' }))
        const use = svgEl('use', { href:`#piece-${sid}`, x:offset, y:offset, width:sz, height:sz })
        use.setAttribute('filter','url(#piece-glow)')
        g.appendChild(use)
        // Colour tint for red/green species
        const tint = SP_PIECE_COLOR[G.playerSp]
        if (tint) g.appendChild(svgEl('rect',{x:offset,y:offset,width:sz,height:sz,fill:tint,style:'pointer-events:none;mix-blend-mode:multiply'}))
        // Click to unplace
        g.addEventListener('click', () => handlePlacementClick(r, c))
      } else if (isSpawn && !isWater && selectedPiece) {
        // Empty spawn square — click to place selected piece
        g.addEventListener('click', () => handlePlacementClick(r, c))
      }

      svg.appendChild(g)
    }
  }
}

let _placeSurroundDrawn = false
function drawPlaceSurroundOnce() {
  if (_placeSurroundDrawn) return
  _placeSurroundDrawn = true
  // Stop any running light animation before heavy canvas work
  if (lightAnimState) { lightAnimState.stop = true; lightAnimState = null }
  const placeCanvasEl = document.getElementById('place-canvas')
  if (placeCanvasEl) drawDungeonSurround(placeCanvasEl, G.map)
  const placeLightsEl = document.getElementById('place-lights')
  if (placeLightsEl) startLightAnimation(placeLightsEl, G.map, TILE * 2.2)
}

function handlePlacementClick(r, c) {
  const sqKey = `${r},${c}`
  const existing = PL.placedSquares[sqKey]

  if (existing) {
    // Unplace: return piece to tray
    PL.placementPieces[existing.idx].placed = false
    delete PL.placedSquares[sqKey]
    PL.selectedTrayIdx = existing.idx  // re-select it in tray
  } else if (PL.selectedTrayIdx !== null && PL.spawnRows.includes(r)) {
    // Place selected piece on this square
    const idx = PL.selectedTrayIdx
    PL.placedSquares[sqKey] = { idx, key: PL.placementPieces[idx].key }
    PL.placementPieces[idx].placed = true
    // Auto-select next unplaced piece
    const nextIdx = PL.placementPieces.findIndex((p, i) => i > idx && !p.placed)
    PL.selectedTrayIdx = nextIdx !== -1 ? nextIdx : null
  }

  const allPlaced = PL.placementPieces.every(p => p.placed)
  const hasKingPlaced = G.pieces.some(p=>p.owner==='player'&&UNITS[p.key].type===PT.K)
  const hasPawnPlaced = G.pieces.some(p=>p.owner==='player'&&UNITS[p.key].type===PT.P)
  const placeHintEl = document.getElementById('place-hint')
  if (placeHintEl) {
    if (!hasKingPlaced) placeHintEl.textContent = '⚠ You must place your King'
    else if (!hasPawnPlaced) placeHintEl.textContent = '⚠ You must place at least one Pawn'
    else if (!allPlaced) placeHintEl.textContent = 'Place remaining pieces or begin battle'
    else placeHintEl.textContent = 'All pieces placed — ready for battle!'
  }
  document.getElementById('confirm-place-btn').disabled = !(allPlaced || (hasKingPlaced && hasPawnPlaced))
  updatePlaceHint()
  if (G.map) computeTile(G.map)
  renderTray()
  renderPlacementBoard()
}

function updatePlaceHint() {
  const remaining = PL.placementPieces.filter(p => !p.placed).length
  const hint = document.getElementById('place-hint')
  if (remaining === 0) {
    hint.innerHTML = `All pieces placed! <span>Click Begin Battle</span> when ready.`
  } else if (PL.selectedTrayIdx !== null) {
    const def = UNITS[PL.placementPieces[PL.selectedTrayIdx].key]
    hint.innerHTML = `Placing <span>${def.name}</span> — click a <span>highlighted square</span> to place it. Click a placed piece to move it.`
  } else {
    hint.innerHTML = `<span>${remaining} piece${remaining>1?'s':''} remaining</span> — click a piece from your roster to place it.`
  }
}

