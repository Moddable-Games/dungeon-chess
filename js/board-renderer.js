'use strict'
// ═══════════════════════════════════════════════════════════
// CUSTOM SVG BOARD RENDERER
// ═══════════════════════════════════════════════════════════
const SVGns = 'http://www.w3.org/2000/svg'

function svgEl(tag, attrs={}) {
  const el = document.createElementNS(SVGns, tag)
  for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

// Colours
const SQ_LIGHT  = '#2a2a38'
const SQ_DARK   = '#1a1a26'
const SQ_WATER  = '#0f2f52'
const SQ_WATER2 = '#081e35'  // water dark checker
const VOID_FILL = 'none'

// Board state for interaction
let boardState = {
  map: null,
  selectedR: null, selectedC: null,
  legalMoves: [], legalAttacks: [],
  onSquareClick: null,   // callback(r, c)
}

// ── Magic light colour palette ─────────────────────────────
// Seeded per (r,c) so same map always looks the same
function getLightColor(r, c) {
  const seed = (r * 31 + c * 17 + r*c*7) % 100
  if (seed < 30) return { core:'#fffde0', mid:'#fef08a', glow:'255,253,180', type:'candle' }  // warm white
  if (seed < 50) return { core:'#fef3c7', mid:'#fbbf24', glow:'251,191,36',  type:'candle' }  // yellow
  if (seed < 65) return { core:'#fed7aa', mid:'#f97316', glow:'249,115,22',  type:'lantern' } // amber/orange
  if (seed < 78) return { core:'#fecaca', mid:'#ef4444', glow:'239,68,68',   type:'lantern' } // red magic
  if (seed < 90) return { core:'#bfdbfe', mid:'#3b82f6', glow:'59,130,246',  type:'candle' }  // blue arcane
  return           { core:'#bbf7d0', mid:'#22c55e', glow:'34,197,94',        type:'lantern' } // green nature
}

function getFlickerClass(r, c) {
  const s = (r*13 + c*29) % 3
  return ['a','b','c'][s]
}

function getAnimDelay(r, c) {
  // Pseudo-random delay 0-8s so no two lights restart together
  return -((r*19 + c*37 + r*c*7) % 80) / 10
}

// ── Top-down candle renderer ────────────────────────────────
function drawCandle(svg, cx, cy, col, flickClass, delay=0) {
  const gpClass = ['gpa','gpb','gpc'][['a','b','c'].indexOf(flickClass)]
  const fkClass = ['fka','fkb','fkc'][['a','b','c'].indexOf(flickClass)]
  const delayStyle = `animation-delay:${delay}s`

  // Glow pool on floor — screen blend, pulsating
  ;[TILE*3.5, TILE*2.2, TILE*1.0].forEach((r, i) => {
    const op = [0.28, 0.45, 0.65][i]
    const g = svgEl('circle', { cx, cy, r, fill:`rgba(${col.glow},${op})` })
    g.setAttribute('class', gpClass)
    g.setAttribute('style', `pointer-events:none;mix-blend-mode:screen;${delayStyle}`)
    svg.appendChild(g)
  })

  // Wax stub — small circle seen from directly above
  svg.appendChild(svgEl('circle', { cx, cy, r:3.5,
    fill:'rgba(220,200,160,0.9)', style:'pointer-events:none' }))

  // Flame dot with flicker
  const flame = svgEl('g')
  flame.setAttribute('class', fkClass)
  flame.setAttribute('style', `pointer-events:none;${delayStyle}`)
  flame.appendChild(svgEl('circle', { cx, cy, r:4.5, fill:`rgba(${col.glow},0.5)` }))
  flame.appendChild(svgEl('circle', { cx, cy, r:2.5, fill:col.mid }))
  flame.appendChild(svgEl('circle', { cx, cy, r:1.2, fill:col.core }))
  svg.appendChild(flame)
}

// ── Top-down lantern renderer ───────────────────────────────
function drawLantern(svg, cx, cy, col, flickClass, delay=0) {
  const gpClass = ['gpa','gpb','gpc'][['a','b','c'].indexOf(flickClass)]
  const fkClass = ['fka','fkb','fkc'][['a','b','c'].indexOf(flickClass)]
  const delayStyle = `animation-delay:${delay}s`

  // Glow pool on floor — screen blend, pulsating
  ;[TILE*3.5, TILE*2.2, TILE*1.0].forEach((r, i) => {
    const op = [0.28, 0.45, 0.65][i]
    const g = svgEl('circle', { cx, cy, r, fill:`rgba(${col.glow},${op})` })
    g.setAttribute('class', gpClass)
    g.setAttribute('style', `pointer-events:none;mix-blend-mode:screen;${delayStyle}`)
    svg.appendChild(g)
  })

  // Top-down lantern: small glowing dot seen from above
  // Lantern body — dark ring with glowing centre
  svg.appendChild(svgEl('circle', { cx, cy, r:6,
    fill:'none', stroke:'#3A3A4A', 'stroke-width':1.5, style:'pointer-events:none' }))
  svg.appendChild(svgEl('circle', { cx, cy, r:5,
    fill:`rgba(${col.glow},0.20)`, style:'pointer-events:none' }))

  // Flickering flame centre
  const flameG = svgEl('g')
  flameG.setAttribute('class', fkClass)
  flameG.setAttribute('style', `pointer-events:none;${delayStyle}`)
  flameG.appendChild(svgEl('circle', { cx, cy, r:3.5, fill:`rgba(${col.glow},0.7)` }))
  flameG.appendChild(svgEl('circle', { cx, cy, r:2,   fill:col.mid }))
  flameG.appendChild(svgEl('circle', { cx, cy, r:1,   fill:col.core }))
  svg.appendChild(flameG)
}

// ── Stone texture helper — dark dungeon stone ──────────────
function drawStoneTexture(g, isLight) {
  const T = TILE
  // Mortar gap — lighter line suggesting grout between stones
  const mortarCol = isLight ? 'rgba(255,220,160,0.12)' : 'rgba(0,0,0,0.55)'
  g.appendChild(svgEl('rect', { x:0.5, y:0.5, width:T-1, height:T-1,
    fill:'none', stroke:mortarCol, 'stroke-width':1.5, 'pointer-events':'none' }))

  // Stone face highlight — faint lighter edge top-left (simulates light from above-left)
  g.appendChild(svgEl('line', { x1:2, y1:2, x2:T-2, y2:2,
    stroke:'rgba(255,200,120,0.08)', 'stroke-width':1.5, 'pointer-events':'none' }))
  g.appendChild(svgEl('line', { x1:2, y1:2, x2:2, y2:T-2,
    stroke:'rgba(255,200,120,0.06)', 'stroke-width':1, 'pointer-events':'none' }))

  // Deep shadow bottom-right edge
  g.appendChild(svgEl('line', { x1:2, y1:T-1.5, x2:T-1.5, y2:T-1.5,
    stroke:'rgba(0,0,0,0.45)', 'stroke-width':1.5, 'pointer-events':'none' }))
  g.appendChild(svgEl('line', { x1:T-1.5, y1:2, x2:T-1.5, y2:T-1.5,
    stroke:'rgba(0,0,0,0.35)', 'stroke-width':1, 'pointer-events':'none' }))

  // Crack lines — light coloured on dark stone (picking out the surface)
  const cracks = isLight
    ? [
        `M ${T*.18} ${T*.10} L ${T*.28} ${T*.36} L ${T*.20} ${T*.66}`,
        `M ${T*.70} ${T*.18} L ${T*.60} ${T*.52} L ${T*.74} ${T*.80}`,
        `M ${T*.08} ${T*.56} L ${T*.40} ${T*.60}`,
      ]
    : [
        `M ${T*.62} ${T*.10} L ${T*.52} ${T*.44} L ${T*.66} ${T*.76}`,
        `M ${T*.14} ${T*.30} L ${T*.36} ${T*.34} L ${T*.26} ${T*.62}`,
        `M ${T*.54} ${T*.70} L ${T*.78} ${T*.68}`,
      ]
  const crackCol = isLight ? 'rgba(255,180,80,0.10)' : 'rgba(255,160,60,0.07)'
  cracks.forEach(d => g.appendChild(svgEl('path', {
    d, stroke:crackCol, 'stroke-width':0.8, fill:'none',
    'stroke-linecap':'round', 'pointer-events':'none'
  })))

  // Pebble/grit dots — light coloured to read as texture not holes
  const pebbleCol = isLight ? 'rgba(255,180,80,0.10)' : 'rgba(255,140,40,0.08)'
  ;[[T*.82,T*.20],[T*.24,T*.78],[T*.16,T*.46],[T*.66,T*.62],[T*.44,T*.22]].forEach(([cx,cy]) =>
    g.appendChild(svgEl('circle', { cx, cy, r:1.2, fill:pebbleCol, 'pointer-events':'none' }))
  )
}

// ── Floor details — scattered environmental decorations ──
function floorRng(s) {
  let x = s | 0
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d)
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39)
  x = x ^ (x >>> 15)
  return (x >>> 0) / 0xffffffff
}

function drawFloorDetails(g, r, c, isLight) {
  const T = TILE
  const seed = r * 1327 + c * 7919 + r * c * 113
  const val = floorRng(seed)

  if (val > 0.35) return

  const detail = floorRng(seed * 31 + 9973)

  const h = (n) => floorRng(seed * 31 + n * 7919)

  if (detail < 0.25) {
    // Rubble — scattered small stones
    const numStones = 3 + Math.floor(h(5) * 4)
    for (let i = 0; i < numStones; i++) {
      const rx = T * (0.12 + h(10 + i * 3) * 0.76)
      const ry = T * (0.12 + h(11 + i * 3) * 0.76)
      const rr = T * 0.03 + h(12 + i * 3) * T * 0.04
      g.appendChild(svgEl('ellipse', { cx: rx, cy: ry, rx: rr, ry: rr * 0.6,
        fill: isLight ? 'rgba(60,45,25,0.35)' : 'rgba(45,32,15,0.30)',
        stroke: isLight ? 'rgba(35,25,10,0.25)' : 'rgba(25,16,5,0.20)',
        'stroke-width': 0.5, 'pointer-events': 'none' }))
    }

  } else if (detail < 0.60) {
    // Claw scratches — three parallel gouges
    const sx = T * (0.15 + h(20) * 0.3)
    const sy = T * (0.2 + h(21) * 0.3)
    const angle = h(22) * 50 - 25
    const sg = svgEl('g', { transform: `translate(${sx},${sy}) rotate(${angle})`, style: 'pointer-events:none' })
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * T * 0.07
      const len = T * 0.30 + h(23 + i) * T * 0.15
      sg.appendChild(svgEl('line', {
        x1: 0, y1: y, x2: len, y2: y + T * 0.02,
        stroke: isLight ? 'rgba(15,8,2,0.30)' : 'rgba(10,5,0,0.25)',
        'stroke-width': 1.5, 'stroke-linecap': 'round'
      }))
    }
    g.appendChild(sg)

  } else if (detail < 0.80) {
    // Floor rune — blood-red carved magic circle
    const cx = T * 0.5, cy = T * 0.5
    const rr = T * 0.22 + h(30) * T * 0.08
    const runeCol = isLight ? 'rgba(140,20,15,0.25)' : 'rgba(120,15,10,0.22)'
    const runeGlow = isLight ? 'rgba(180,30,20,0.08)' : 'rgba(160,25,15,0.06)'
    g.appendChild(svgEl('circle', { cx, cy, r: rr + 2,
      fill: runeGlow, 'pointer-events': 'none' }))
    g.appendChild(svgEl('circle', { cx, cy, r: rr,
      fill: 'none', stroke: runeCol, 'stroke-width': 1.1, 'stroke-dasharray': '4,3',
      'pointer-events': 'none' }))
    const innerR = rr * 0.55
    if (h(31) > 0.5) {
      g.appendChild(svgEl('path', {
        d: `M ${cx - innerR} ${cy} L ${cx + innerR} ${cy} M ${cx} ${cy - innerR} L ${cx} ${cy + innerR}`,
        stroke: runeCol, 'stroke-width': 1.0, fill: 'none', 'pointer-events': 'none'
      }))
    } else {
      g.appendChild(svgEl('path', {
        d: `M ${cx} ${cy - innerR} L ${cx + innerR * 0.8} ${cy + innerR * 0.6} L ${cx - innerR * 0.8} ${cy + innerR * 0.6} Z`,
        stroke: runeCol, 'stroke-width': 1.0, fill: 'none', 'pointer-events': 'none'
      }))
    }

  } else {
    // Moss patch
    const mx = T * (0.2 + h(40) * 0.5)
    const my = T * (0.4 + h(41) * 0.4)
    const mw = T * 0.16 + h(42) * T * 0.12
    const mh = T * 0.09 + h(43) * T * 0.06
    g.appendChild(svgEl('ellipse', { cx: mx, cy: my, rx: mw, ry: mh,
      fill: 'rgba(18,50,10,0.25)', 'pointer-events': 'none' }))
    for (let i = 0; i < 4; i++) {
      const fx = mx + (h(44 + i) - 0.5) * mw * 1.6
      const fy = my + (h(45 + i) - 0.5) * mh * 2.5
      g.appendChild(svgEl('circle', { cx: fx, cy: fy, r: 1.5 + h(46 + i) * 1.8,
        fill: 'rgba(30,70,15,0.22)', 'pointer-events': 'none' }))
    }
  }
}

// Static layer cache — built once, never rebuilt during gameplay
let _staticLayerBuilt = false
let _staticLayerMap = null

function renderBoardStatic(map) {
  const svg = document.getElementById('dungeon-board')
  svg.innerHTML = ''
  _staticLayerBuilt = true
  _staticLayerMap = map

  const { grid, rows, cols } = map
  const W = cols * TILE, H = rows * TILE
  const WALL = TILE * 2.2
  const fullW = W + WALL * 2, fullH = H + WALL * 2
  svg.setAttribute('width', fullW)
  svg.setAttribute('height', fullH)
  svg.setAttribute('viewBox', `${-WALL} ${-WALL} ${fullW} ${fullH}`)
  svg.setAttribute('role', 'grid')
  svg.setAttribute('aria-label', 'Dungeon Chess game board')

  ensureSpriteDefs(svg)

  // Static terrain group — never changes
  const terrainG = svgEl('g', { id: 'board-terrain' })

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c]
      if (cell === null) continue

      const x = c * TILE, y = r * TILE
      const isLight = (r + c) % 2 === 0
      const isWater = cell === 'w'

      const g = svgEl('g', { transform: `translate(${x},${y})` })

      let fill
      if (isWater) fill = isLight ? SQ_WATER : SQ_WATER2
      else fill = isLight ? SQ_LIGHT : SQ_DARK
      g.appendChild(svgEl('rect', { x: 0, y: 0, width: TILE, height: TILE, fill }))

      if (!isWater) drawStoneTexture(g, isLight)
      if (!isWater) drawFloorDetails(g, r, c, isLight)

      if (isWater) {
        const clipId = `wclip-${r}-${c}`
        const clipPath = svgEl('clipPath', { id: clipId })
        clipPath.appendChild(svgEl('rect', { x: 0, y: 0, width: TILE, height: TILE }))
        let defs2 = svg.querySelector('defs')
        if (defs2) defs2.appendChild(clipPath)

        const wg = svgEl('g', { 'clip-path': `url(#${clipId})`, 'pointer-events': 'none' })
        wg.appendChild(svgEl('rect', { x: 0, y: 0, width: TILE, height: TILE, fill: 'rgba(60,100,160,0.08)' }))

        const cseed = r * 47 + c * 31
        const numCaustics = 2 + (cseed % 3)
        for (let ci = 0; ci < numCaustics; ci++) {
          const cx2 = ((cseed * 7 + ci * 23) % 80) / 100 * TILE + TILE * 0.1
          const cy2 = ((cseed * 11 + ci * 37) % 80) / 100 * TILE + TILE * 0.1
          const cr = TILE * 0.08 + ((cseed + ci * 13) % 30) / 100 * TILE * 0.1
          const caustic = svgEl('path', {
            d: `M ${cx2} ${cy2 - cr} L ${cx2 + cr * 0.7} ${cy2} L ${cx2} ${cy2 + cr} L ${cx2 - cr * 0.7} ${cy2} Z`,
            fill: 'rgba(120,200,255,0.12)', stroke: 'rgba(160,220,255,0.08)', 'stroke-width': 0.5
          })
          caustic.setAttribute('class', ['wva', 'wvb', 'wvc'][ci % 3])
          wg.appendChild(caustic)
        }

        for (let wi = 0; wi < 3; wi++) {
          const wy2 = TILE * (0.22 + wi * 0.26)
          const wc = ['wva', 'wvb', 'wvc'][wi]
          const wv = svgEl('path', {
            d: `M -4 ${wy2} Q ${TILE * 0.25} ${wy2 - 4} ${TILE / 2} ${wy2} Q ${TILE * 0.75} ${wy2 + 4} ${TILE + 4} ${wy2}`,
            stroke: 'rgba(140,200,255,0.40)', 'stroke-width': 1.2, fill: 'none'
          })
          wv.setAttribute('class', wc)
          wg.appendChild(wv)
          const wv2 = svgEl('path', {
            d: `M -4 ${wy2 + 4} Q ${TILE * 0.30} ${wy2 + 1} ${TILE / 2} ${wy2 + 4} Q ${TILE * 0.70} ${wy2 + 7} ${TILE + 4} ${wy2 + 4}`,
            stroke: 'rgba(80,150,220,0.22)', 'stroke-width': 0.8, fill: 'none'
          })
          wv2.setAttribute('class', ['wvc', 'wva', 'wvb'][wi])
          wg.appendChild(wv2)
        }

        const bseed = r * 13 + c * 59
        if (bseed % 5 < 2) {
          const bx = TILE * 0.2 + ((bseed * 3) % 60) / 100 * TILE * 0.6
          const by = TILE * 0.5 + ((bseed * 7) % 40) / 100 * TILE * 0.3
          const bubble = svgEl('circle', {
            cx: bx, cy: by, r: 1.5 + (bseed % 3) * 0.5,
            fill: 'none', stroke: 'rgba(180,230,255,0.35)', 'stroke-width': 0.6
          })
          bubble.setAttribute('class', 'bubble')
          wg.appendChild(bubble)
          wg.appendChild(svgEl('circle', { cx: bx - 0.5, cy: by - 0.5, r: 0.6, fill: 'rgba(220,245,255,0.5)' }))
        }

        g.appendChild(wg)
      }

      terrainG.appendChild(g)
    }
  }
  svg.appendChild(terrainG)

  // Coordinate labels
  if (map.id === 'compact') {
    const files = 'abcdefghijklmnopqrstuvwxyz'
    for (let c = 0; c < cols; c++) {
      const lbl = svgEl('text', { x: c * TILE + TILE / 2, y: H - 3, 'text-anchor': 'middle', class: 'coord' })
      lbl.textContent = files[c]
      svg.appendChild(lbl)
    }
    for (let r = 0; r < rows; r++) {
      const lbl = svgEl('text', { x: 4, y: r * TILE + TILE / 2 + 4, 'text-anchor': 'start', class: 'coord' })
      lbl.textContent = rows - r
      svg.appendChild(lbl)
    }
  }
}

function renderBoard(map, pieces, selectedR, selectedC, legalMoves, legalAttacks, onSquareClick, lastMove) {
  boardState = { map, selectedR, selectedC, legalMoves, legalAttacks, onSquareClick }

  const svg = document.getElementById('dungeon-board')

  // Build static layer once per battle (or on TILE size change)
  if (!_staticLayerBuilt || _staticLayerMap !== map) {
    renderBoardStatic(map)
  }

  // Remove previous dynamic layer
  const oldDyn = svg.getElementById('board-dynamic')
  if (oldDyn) oldDyn.remove()

  // Build dynamic layer — only pieces and highlights
  const dynG = svgEl('g', { id: 'board-dynamic' })

  const { grid, rows, cols } = map

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c]
      if (cell === null) continue

      const x = c * TILE, y = r * TILE
      const isSelected = selectedR === r && selectedC === c
      const isLegal = legalMoves.some(([lr, lc]) => lr === r && lc === c)
      const isAttack = legalAttacks.some(([ar, ac]) => ar === r && ac === c)
      const piece = pieces.find(p => p.r === r && p.c === c)
      const isLastFrom = lastMove && lastMove.fr === r && lastMove.fc === c
      const isLastTo = lastMove && lastMove.tr === r && lastMove.tc === c

      if (!isSelected && !isLegal && !isAttack && !piece && !isLastFrom && !isLastTo) continue

      const g = svgEl('g', {
        class: 'sq' + (isSelected ? ' selected' : ''),
        'data-r': r, 'data-c': c,
        transform: `translate(${x},${y})`,
        style: 'cursor:pointer'
      })

      // Last move highlight
      if (isLastFrom || isLastTo) {
        g.appendChild(svgEl('rect', { x:1, y:1, width:TILE-2, height:TILE-2,
          fill: isLastTo ? 'rgba(176,141,45,0.12)' : 'rgba(176,141,45,0.06)',
          stroke:'rgba(176,141,45,0.35)', 'stroke-width':1, 'pointer-events':'none' }))
      }
      // Highlight overlays
      if (isSelected) {
        g.appendChild(svgEl('rect', { x: 1, y: 1, width: TILE - 2, height: TILE - 2,
          fill: 'rgba(246,199,71,0.12)', stroke: 'rgba(246,199,71,0.50)',
          'stroke-width': 1.5, 'pointer-events': 'none' }))
      }
      if (isLegal) {
        const rg2 = svgEl('g', { class: 'rune-move', style: 'pointer-events:none' })
        const cx2 = TILE / 2, cy2 = TILE / 2, rs = TILE * 0.28
        rg2.appendChild(svgEl('circle', { cx: cx2, cy: cy2, r: rs,
          fill: 'rgba(40,180,60,0.15)', stroke: 'rgba(80,220,80,0.60)', 'stroke-width': 1.2,
          'stroke-dasharray': '5,3' }))
        rg2.appendChild(svgEl('path', {
          d: `M ${cx2 - rs * 0.55} ${cy2} L ${cx2 + rs * 0.55} ${cy2} M ${cx2} ${cy2 - rs * 0.55} L ${cx2} ${cy2 + rs * 0.55}`,
          stroke: 'rgba(80,220,80,0.70)', 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round' }))
        rg2.appendChild(svgEl('circle', { cx: cx2, cy: cy2, r: rs * 0.25, fill: 'rgba(80,220,80,0.50)' }))
        g.appendChild(rg2)
      }
      if (isAttack) {
        const ag = svgEl('g', { class: 'rune-attack', style: 'pointer-events:none' })
        const cx2 = TILE / 2, cy2 = TILE / 2, rs = TILE * 0.38
        ag.appendChild(svgEl('circle', { cx: cx2, cy: cy2, r: rs,
          fill: 'rgba(200,30,20,0.10)', stroke: 'rgba(220,60,40,0.65)', 'stroke-width': 1.5,
          'stroke-dasharray': '4,2' }))
        ag.appendChild(svgEl('path', {
          d: `M ${cx2 - rs * 0.45} ${cy2 - rs * 0.2} L ${cx2} ${cy2 - rs * 0.58} L ${cx2 + rs * 0.45} ${cy2 - rs * 0.2}`,
          stroke: 'rgba(220,60,40,0.85)', 'stroke-width': 1.5, fill: 'none',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
        ag.appendChild(svgEl('path', {
          d: `M ${cx2 - rs * 0.45} ${cy2 + rs * 0.2} L ${cx2} ${cy2 + rs * 0.58} L ${cx2 + rs * 0.45} ${cy2 + rs * 0.2}`,
          stroke: 'rgba(220,60,40,0.85)', 'stroke-width': 1.5, fill: 'none',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
        g.appendChild(ag)
      }

      // Piece
      if (piece) {
        const def = UNITS[piece.key]
        const ownerSp = piece.owner === 'player' ? G.playerSp
          : piece.owner === 'ai' ? G.aiSp
          : piece.owner === 'ai2' ? G.ai2Sp : G.ai3Sp
        const color = spToColor(ownerSp)
        const sid = color + FEN_CH[def.type]
        const offset = (TILE - TILE * 0.88) / 2
        const sz = TILE * 0.88

        g.appendChild(svgEl('ellipse', { cx: TILE / 2, cy: TILE - 4, rx: TILE * 0.28, ry: 3.5, fill: 'rgba(0,0,0,0.60)' }))
        const use = svgEl('use', { href: `#piece-${sid}`, x: offset, y: offset, width: sz, height: sz })
        if (isSelected) use.setAttribute('filter', 'url(#piece-glow)')
        g.appendChild(use)
        const tintCol = SP_PIECE_COLOR[ownerSp]
        if (tintCol) {
          g.appendChild(svgEl('rect', { x: offset, y: offset, width: sz, height: sz, fill: tintCol, style: 'pointer-events:none;mix-blend-mode:multiply' }))
        }
      }

      dynG.appendChild(g)
    }
  }

  svg.appendChild(dynG)

  // Keyboard cursor overlay
  if (typeof kbRenderCursor === 'function') kbRenderCursor(svg, map)

  // Clickable overlay — transparent rects for squares without dynamic content
  // Use event delegation on the SVG instead
  svg.onclick = (e) => {
    const sq = e.target.closest('[data-r]') || e.target.closest('.sq')
    if (!sq) {
      // Clicked on terrain — find which square by position
      const rect = svg.getBoundingClientRect()
      const WALL = TILE * 2.2
      const svgX = (e.clientX - rect.left) / rect.width * (cols * TILE + WALL * 2) - WALL
      const svgY = (e.clientY - rect.top) / rect.height * (rows * TILE + WALL * 2) - WALL
      const clickR = Math.floor(svgY / TILE)
      const clickC = Math.floor(svgX / TILE)
      if (clickR >= 0 && clickR < rows && clickC >= 0 && clickC < cols && grid[clickR][clickC] !== null) {
        if (boardState.onSquareClick) boardState.onSquareClick(clickR, clickC)
      }
      return
    }
    const r2 = parseInt(sq.getAttribute('data-r'))
    const c2 = parseInt(sq.getAttribute('data-c'))
    if (!isNaN(r2) && !isNaN(c2) && boardState.onSquareClick) {
      boardState.onSquareClick(r2, c2)
    }
  }
}

function invalidateStaticBoard() {
  _staticLayerBuilt = false
  _staticLayerMap = null
}

// Surround cache — avoids redrawing the expensive wall/brick/vine canvas
let _surroundCache = { mapId: null, tile: null, canvas: null }

// Shared dungeon surround renderer — draws on a <canvas> behind the SVG
function drawDungeonSurround(canvasEl, map) {
  const { grid, rows, cols } = map
  const W = cols * TILE, H = rows * TILE

  const WALL = TILE * 2.2
  const DEEP = Math.min(W, H) * 0.82

  const fullW = W + WALL*2, fullH = H + WALL*2
  canvasEl.width  = fullW
  canvasEl.height = fullH

  const ctx = canvasEl.getContext('2d')

  // If we have a cached version for this map+tile, just stamp it and return
  if (_surroundCache.mapId === map.id && _surroundCache.tile === TILE && _surroundCache.canvas) {
    ctx.drawImage(_surroundCache.canvas, 0, 0)
    return
  }

  ctx.clearRect(0,0,fullW,fullH)

  const BX = WALL, BY = WALL  // board top-left on canvas
  const isBoard = (r,c) => r>=0&&r<rows&&c>=0&&c<cols && grid[r]?.[c]!==null

  let minR=rows,maxR=0,minC=cols,maxC=0
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++)
    if (isBoard(r,c)) { minR=Math.min(minR,r);maxR=Math.max(maxR,r);minC=Math.min(minC,c);maxC=Math.max(maxC,c) }

  function rng(seed) {
    let s=(seed^0xdeadbeef)>>>0
    s=Math.imul(s^(s>>>16),0x45d9f3b); s=Math.imul(s^(s>>>16),0x45d9f3b)
    return ((s^(s>>>16))>>>0)/0xffffffff
  }
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]

  // ── Stone wall face ────────────────────────────────────────────────────
  function drawWallFace(outerA, outerB, innerA, innerB, litLevel, seed) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(outerA[0],outerA[1]); ctx.lineTo(outerB[0],outerB[1])
    ctx.lineTo(innerB[0],innerB[1]); ctx.lineTo(innerA[0],innerA[1])
    ctx.closePath(); ctx.clip()

    const br=Math.round(20+litLevel*30), bg=Math.round(13+litLevel*20), bb=Math.round(5+litLevel*9)
    ctx.fillStyle=`rgb(${br},${bg},${bb})`; ctx.fillRect(0,0,fullW,fullH)

    // Depth gradient: bright at outer (viewer), dark at inner (board)
    const midO=lerp(outerA,outerB,0.5), midI=lerp(innerA,innerB,0.5)
    const dg=ctx.createLinearGradient(midO[0],midO[1],midI[0],midI[1])
    dg.addColorStop(0,`rgba(255,185,80,${(litLevel*0.18).toFixed(3)})`)
    dg.addColorStop(0.6,'rgba(0,0,0,0)')
    dg.addColorStop(1,'rgba(0,0,0,0.60)')
    ctx.fillStyle=dg; ctx.fillRect(0,0,fullW,fullH)

    // Brick rows
    const wallDepth=Math.hypot(midI[0]-midO[0],midI[1]-midO[1])
    const nRows=Math.max(4,Math.round(wallDepth/10))
    const rowTs=[0]; let acc=0
    for(let ri=0;ri<nRows;ri++){acc+=(1/nRows)*(0.72+rng(seed*7+ri*13)*0.56);rowTs.push(acc)}
    const sc=1/rowTs[rowTs.length-1]
    for(let i=0;i<rowTs.length;i++) rowTs[i]=Math.min(rowTs[i]*sc,1)

    for(let ri=0;ri<nRows;ri++){
      const t0=rowTs[ri],t1=rowTs[ri+1]||1,tMid=(t0+t1)/2
      const r0l=lerp(outerA,innerA,t0), r0r=lerp(outerB,innerB,t0)
      const r1l=lerp(outerA,innerA,t1), r1r=lerp(outerB,innerB,t1)
      const rowLen=Math.hypot(r0r[0]-r0l[0],r0r[1]-r0l[1])
      const nBricks=Math.max(1,Math.round(rowLen/(TILE*0.82)))
      const bOff=(ri%2)*0.5
      const rowBright=litLevel*Math.pow(1-tMid,0.7)
      for(let bi=0;bi<nBricks;bi++){
        const bSeed=seed*31+ri*17+bi*7
        const bBright=Math.max(0,rowBright+(rng(bSeed)-0.5)*0.10)
        const bR=Math.round(br+bBright*68+rng(bSeed+1)*9-4)
        const bG=Math.round(bg+bBright*44+rng(bSeed+2)*5-2)
        const bBc=Math.round(bb+bBright*22+rng(bSeed+3)*3-1)
        const f0=(bi+bOff)/nBricks, f1=(bi+1+bOff)/nBricks
        const tl=lerp(r0l,r0r,Math.min(f0,1)), tr2=lerp(r0l,r0r,Math.min(f1,1))
        const bl2=lerp(r1l,r1r,Math.min(f0,1)), br2=lerp(r1l,r1r,Math.min(f1,1))
        ctx.fillStyle=`rgb(${bR},${bG},${bBc})`
        ctx.beginPath(); ctx.moveTo(tl[0],tl[1]); ctx.lineTo(tr2[0],tr2[1])
        ctx.lineTo(br2[0],br2[1]); ctx.lineTo(bl2[0],bl2[1]); ctx.closePath(); ctx.fill()
        ctx.fillStyle=`rgba(0,0,0,${(0.14+rng(bSeed+4)*0.08).toFixed(3)})`
        ctx.beginPath(); ctx.moveTo(tr2[0],tr2[1]); ctx.lineTo(br2[0],br2[1])
        ctx.lineTo(lerp(br2,bl2,0.18)[0],lerp(br2,bl2,0.18)[1])
        ctx.lineTo(lerp(tr2,tl,0.18)[0],lerp(tr2,tl,0.18)[1]); ctx.closePath(); ctx.fill()
        ctx.fillStyle=`rgba(255,220,160,${(0.05+bBright*0.08).toFixed(3)})`
        ctx.beginPath(); ctx.moveTo(tl[0],tl[1]); ctx.lineTo(tr2[0],tr2[1])
        ctx.lineTo(lerp(tr2,br2,0.14)[0],lerp(tr2,br2,0.14)[1])
        ctx.lineTo(lerp(tl,bl2,0.14)[0],lerp(tl,bl2,0.14)[1]); ctx.closePath(); ctx.fill()
        if(rng(bSeed+5)>0.65){
          ctx.fillStyle=`rgba(0,0,0,${(0.09+rng(bSeed+8)*0.12).toFixed(3)})`
          ctx.beginPath(); ctx.arc(tl[0]+(tr2[0]-tl[0])*rng(bSeed+6),tl[1]+(bl2[1]-tl[1])*rng(bSeed+7),0.8+rng(bSeed+9),0,Math.PI*2); ctx.fill()
        }
      }
      ctx.strokeStyle=`rgba(0,0,0,${ri===0?0.35:0.45})`; ctx.lineWidth=0.8
      ctx.beginPath(); ctx.moveTo(r0l[0],r0l[1]); ctx.lineTo(r0r[0],r0r[1]); ctx.stroke()

      // Moss — appears on all wall faces, denser on darker/damper walls
      // Every row has a chance; more moss deeper into the wall (higher tMid)
      // and on darker walls (lower litLevel)
      const mossChance = 0.30 + (1-litLevel)*0.35 + tMid*0.20
      if (rng(seed*3+ri*11) < mossChance) {
        const nMoss = 1 + Math.floor(rng(seed+ri*7) * (1 + (1-litLevel)*3))
        for (let mi=0; mi<nMoss; mi++) {
          const mBrick = Math.floor(rng(seed+ri*13+mi*7) * nBricks)
          const bStart = (mBrick+bOff)/nBricks
          const mSpan  = 0.08 + rng(seed+mi*3+1)*0.18   // width as fraction of row
          const mf0 = Math.max(0, bStart - mSpan*0.3)
          const mf1 = Math.min(1, bStart + mSpan*0.7)

          const ml0 = lerp(r0l,r0r,mf0), ml1 = lerp(r0l,r0r,mf1)
          const ml2 = lerp(r1l,r1r,mf1), ml3 = lerp(r1l,r1r,mf0)

          // Moss base: dark green tint on brick surface, opacity scales with dampness
          const baseAlpha = (0.10 + rng(seed+mi+2)*0.14) * (1 + (1-litLevel)*0.8)
          ctx.fillStyle = `rgba(14,32,10,${Math.min(0.38,baseAlpha).toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(ml0[0],ml0[1]); ctx.lineTo(ml1[0],ml1[1])
          ctx.lineTo(ml2[0],ml2[1]); ctx.lineTo(ml3[0],ml3[1])
          ctx.closePath(); ctx.fill()

          // Lighter green fringe on the outer edge (toward screen corner = brighter)
          const fringeAlpha = baseAlpha * 0.5
          ctx.strokeStyle = `rgba(28,52,16,${Math.min(0.25,fringeAlpha).toFixed(3)})`
          ctx.lineWidth = 0.7 + rng(seed+mi+4)*0.6
          ctx.beginPath(); ctx.moveTo(ml0[0],ml0[1]); ctx.lineTo(ml1[0],ml1[1]); ctx.stroke()

          // Occasional brighter moss highlight — a single lighter pixel cluster
          if (rng(seed+mi+5) > 0.60) {
            const hx = mf0 + (mf1-mf0)*rng(seed+mi+6)
            const hp0 = lerp(r0l,r0r,hx), hp1 = lerp(r1l,r1r,hx)
            const hpt = lerp(hp0,hp1,0.3+rng(seed+mi+7)*0.4)
            ctx.fillStyle = `rgba(40,70,22,${(baseAlpha*0.55).toFixed(3)})`
            ctx.beginPath(); ctx.arc(hpt[0],hpt[1], 1.2+rng(seed+mi+8)*1.4, 0, Math.PI*2); ctx.fill()
          }
        }
      }

      if(rng(seed+ri*3)>0.83){
        const mf=0.15+rng(seed+ri)*0.70
        const mx0=r0l[0]+(r0r[0]-r0l[0])*mf, my0=r0l[1]+(r0r[1]-r0l[1])*mf
        const mx1=r1l[0]+(r1r[0]-r1l[0])*mf, my1=r1l[1]+(r1r[1]-r1l[1])*mf
        ctx.strokeStyle='rgba(15,52,8,0.28)'; ctx.lineWidth=2; ctx.lineCap='round'
        ctx.beginPath(); ctx.moveTo(mx0,my0); ctx.lineTo(mx0+(mx1-mx0)*0.55,my0+(my1-my0)*0.55); ctx.stroke()
      }
    }
    ctx.restore()
  }

  // ── 0. Background ─────────────────────────────────────────────────────
  ctx.fillStyle='#0a0a12'; ctx.fillRect(0,0,fullW,fullH)

  // ── 1. Compute deep corners ──────────────────────────────────────────
  function extendPast(screenCorner, boardCorner, dist) {
    const dx=boardCorner[0]-screenCorner[0], dy=boardCorner[1]-screenCorner[1]
    const len=Math.hypot(dx,dy)
    return [boardCorner[0]+(dx/len)*dist, boardCorner[1]+(dy/len)*dist]
  }
  const dTL=extendPast([0,0],         [BX,BY],    DEEP)
  const dTR=extendPast([fullW,0],     [BX+W,BY],  DEEP)
  const dBL=extendPast([0,fullH],     [BX,BY+H],  DEEP)
  const dBR=extendPast([fullW,fullH], [BX+W,BY+H],DEEP)

  // ── 2. ONE continuous wall face per side: screen edge → deep corners ──
  // Lit levels more uniform for dungeon feel (subtle directional light, not extreme)
  drawWallFace([0,0],    [fullW,0],    dTL, dTR, 0.55, 1)  // top
  drawWallFace([0,fullH],[fullW,fullH],dBL, dBR, 0.35, 2)  // bottom
  drawWallFace([0,0],    [0,fullH],    dTL, dBL, 0.45, 3)  // left
  drawWallFace([fullW,0],[fullW,fullH],dTR, dBR, 0.40, 4)  // right

  // ── 3. Corner seam lines: screen corner → deep corner (one straight line) ──
  ctx.strokeStyle='rgba(0,0,0,0.85)'; ctx.lineWidth=2; ctx.lineCap='butt'
  ;[[0,0,dTL],[fullW,0,dTR],[0,fullH,dBL],[fullW,fullH,dBR]]
    .forEach(([ox,oy,dp])=>{
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(dp[0],dp[1]); ctx.stroke()
    })

  // ── 5. Darkness fade painted over deep walls ─────────────────────────
  // Cover each deep wall face with a linear gradient that starts transparent
  // at the board edge and reaches solid black at the deep corner.
  // This is drawn per-face so it clips correctly to each trapezoid.
  // Darkness fade: from board edge toward deep corners
  // oA/oB = board edge (where fade starts transparent)
  // iA/iB = deep corners (where fade reaches black)
  const deepFaces = [
    { oA:[BX,BY],    oB:[BX+W,BY],    iA:dTL, iB:dTR },
    { oA:[BX,BY+H],  oB:[BX+W,BY+H],  iA:dBL, iB:dBR },
    { oA:[BX,BY],    oB:[BX,BY+H],    iA:dTL, iB:dBL },
    { oA:[BX+W,BY],  oB:[BX+W,BY+H],  iA:dTR, iB:dBR },
  ]
  deepFaces.forEach(({oA,oB,iA,iB}) => {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(oA[0],oA[1]); ctx.lineTo(oB[0],oB[1])
    ctx.lineTo(iB[0],iB[1]); ctx.lineTo(iA[0],iA[1])
    ctx.closePath(); ctx.clip()
    // Gradient from board edge (transparent) to deep corner (black)
    const midO=[(oA[0]+oB[0])/2,(oA[1]+oB[1])/2]
    const midI=[(iA[0]+iB[0])/2,(iA[1]+iB[1])/2]
    const grd=ctx.createLinearGradient(midO[0],midO[1],midI[0],midI[1])
    grd.addColorStop(0,   'rgba(0,0,0,0)')
    grd.addColorStop(0.30,'rgba(0,0,0,0.20)')
    grd.addColorStop(0.65,'rgba(0,0,0,0.65)')
    grd.addColorStop(1.0, 'rgba(0,0,0,1.00)')
    ctx.fillStyle=grd; ctx.fillRect(0,0,fullW,fullH)
    ctx.restore()
  })

  // Fill the very centre (deep corners region) solid black
  ctx.fillStyle='rgba(0,0,0,1)'
  ctx.beginPath()
  ctx.moveTo(dTL[0],dTL[1]); ctx.lineTo(dTR[0],dTR[1])
  ctx.lineTo(dBR[0],dBR[1]); ctx.lineTo(dBL[0],dBL[1])
  ctx.closePath(); ctx.fill()

  // ── Option 2: Mortar joint following actual board perimeter ──────────
  // Draw along every outward-facing board edge — not the bounding box.
  ctx.save()
  ctx.strokeStyle = 'rgba(15,10,5,0.75)'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'butt'
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      if (!isBoard(r,c)) continue
      const x = BX+c*TILE, y = BY+r*TILE
      if (!isBoard(r-1,c)) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+TILE,y); ctx.stroke() }
      if (!isBoard(r+1,c)) { ctx.beginPath(); ctx.moveTo(x,y+TILE); ctx.lineTo(x+TILE,y+TILE); ctx.stroke() }
      if (!isBoard(r,c-1)) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+TILE); ctx.stroke() }
      if (!isBoard(r,c+1)) { ctx.beginPath(); ctx.moveTo(x+TILE,y); ctx.lineTo(x+TILE,y+TILE); ctx.stroke() }
    }
  }
  // Inner highlight along same edges
  ctx.strokeStyle = 'rgba(255,200,120,0.12)'
  ctx.lineWidth = 1
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      if (!isBoard(r,c)) continue
      const x = BX+c*TILE, y = BY+r*TILE
      if (!isBoard(r-1,c)) { ctx.beginPath(); ctx.moveTo(x+1,y+2); ctx.lineTo(x+TILE-1,y+2); ctx.stroke() }
      if (!isBoard(r,c-1)) { ctx.beginPath(); ctx.moveTo(x+2,y+1); ctx.lineTo(x+2,y+TILE-1); ctx.stroke() }
    }
  }
  ctx.restore()

  // ── Option 3: Wall shadow cast inward along actual board perimeter ────
  const shadowReach = TILE * 2.2
  // Pre-create 4 shadow gradients (in local coords: origin at square top-left)
  const shGrdTop = ctx.createLinearGradient(0, 0, 0, shadowReach)
  shGrdTop.addColorStop(0, 'rgba(0,0,0,0.42)'); shGrdTop.addColorStop(0.35, 'rgba(0,0,0,0.19)')
  shGrdTop.addColorStop(0.70, 'rgba(0,0,0,0.05)'); shGrdTop.addColorStop(1, 'rgba(0,0,0,0)')
  const shGrdBot = ctx.createLinearGradient(0, TILE, 0, TILE - shadowReach)
  shGrdBot.addColorStop(0, 'rgba(0,0,0,0.18)'); shGrdBot.addColorStop(0.35, 'rgba(0,0,0,0.08)')
  shGrdBot.addColorStop(0.70, 'rgba(0,0,0,0.02)'); shGrdBot.addColorStop(1, 'rgba(0,0,0,0)')
  const shGrdLeft = ctx.createLinearGradient(0, 0, shadowReach, 0)
  shGrdLeft.addColorStop(0, 'rgba(0,0,0,0.30)'); shGrdLeft.addColorStop(0.35, 'rgba(0,0,0,0.14)')
  shGrdLeft.addColorStop(0.70, 'rgba(0,0,0,0.04)'); shGrdLeft.addColorStop(1, 'rgba(0,0,0,0)')
  const shGrdRight = ctx.createLinearGradient(TILE, 0, TILE - shadowReach, 0)
  shGrdRight.addColorStop(0, 'rgba(0,0,0,0.20)'); shGrdRight.addColorStop(0.35, 'rgba(0,0,0,0.09)')
  shGrdRight.addColorStop(0.70, 'rgba(0,0,0,0.02)'); shGrdRight.addColorStop(1, 'rgba(0,0,0,0)')
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      if (!isBoard(r,c)) continue
      const x = BX+c*TILE, y = BY+r*TILE
      ctx.save()
      ctx.translate(x, y)
      if (!isBoard(r-1,c)) { ctx.fillStyle = shGrdTop; ctx.fillRect(0, 0, TILE, shadowReach) }
      if (!isBoard(r+1,c)) { ctx.fillStyle = shGrdBot; ctx.fillRect(0, TILE-shadowReach, TILE, shadowReach) }
      if (!isBoard(r,c-1)) { ctx.fillStyle = shGrdLeft; ctx.fillRect(0, 0, shadowReach, TILE) }
      if (!isBoard(r,c+1)) { ctx.fillStyle = shGrdRight; ctx.fillRect(TILE-shadowReach, 0, shadowReach, TILE) }
      ctx.restore()
    }
  }




  // ── Portcullises — trapezoidal to match wall perspective ───────────────
  // Board-edge face is full width (2 tiles). Far face converges toward the
  // corner vanishing point, matching the wall seam lines exactly.
  function drawPortcullis(cx, cy, isHorizWall) {
    const pw = TILE * 2         // opening width at board edge
    const litLv = (isHorizWall && cy <= BY) ? 0.55
                : (isHorizWall) ? 0.35
                : (cx <= BX)    ? 0.45 : 0.40

    // The wall seam lines go from screen corners through board corners.
    // At the board edge the opening is pw wide.
    // At the far end (WALL px deep), it converges by the seam angle.
    // seam slope for top-left corner: dx/dy = BX/BY (both = WALL)
    // So for every pixel deeper into the wall, the edge moves inward by 1px (45°)
    const depth = WALL * 0.68   // 68% of wall depth — leaves stone header above

    // For top wall: opening face at y=BY, far face at y=BY-depth
    // The seam lines have slope 1 (BX=BY=WALL), so at depth d above board:
    // left edge moves right by d, right edge moves left by d → convergence
    // But we only want convergence matching the actual wall geometry:
    // convergence ratio = depth/WALL (how far we've gone relative to full wall)
    // Perspective spread: far end is slightly wider than board edge.
    // The spread matches the wall brick convergence visually.
    // We use a gentle spread of depth*0.18 on each side — enough to feel 3D
    // without dominating the wall. Height is 70% of WALL to leave a stone header.
    const spread = depth * 0.18
    let bL, bR, fL, fR

    if (isHorizWall) {
      const isTop = cy <= BY
      bL = [cx - pw/2, cy]
      bR = [cx + pw/2, cy]
      const farY = isTop ? cy - depth : cy + depth
      fL = [cx - pw/2 - spread, farY]
      fR = [cx + pw/2 + spread, farY]
    } else {
      const isLeft = cx <= BX
      bL = [cx, cy - pw/2]
      bR = [cx, cy + pw/2]
      const farX = isLeft ? cx - depth : cx + depth
      fL = [farX, cy - pw/2 - spread]
      fR = [farX, cy + pw/2 + spread]
    }

    const br2 = Math.round(18+litLv*25)
    const stoneC = `rgb(${br2+3},${Math.round(br2*0.62)},${Math.round(br2*0.26)})`
    const stoneD = `rgb(${br2-2},${Math.round(br2*0.50)},${Math.round(br2*0.20)})`

    // Clip to the trapezoid shape
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(bL[0],bL[1]); ctx.lineTo(bR[0],bR[1])
    ctx.lineTo(fR[0],fR[1]); ctx.lineTo(fL[0],fL[1])
    ctx.closePath(); ctx.clip()

    // Void interior
    ctx.fillStyle='rgba(3,1,0,0.97)'
    ctx.beginPath()
    ctx.moveTo(bL[0],bL[1]); ctx.lineTo(bR[0],bR[1])
    ctx.lineTo(fR[0],fR[1]); ctx.lineTo(fL[0],fL[1])
    ctx.closePath(); ctx.fill()

    // Depth gradient — lighter near board edge (ambient light), darker at far end
    const lerp2D = (a,b,t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]
    const midB = lerp2D(bL,bR,0.5), midF = lerp2D(fL,fR,0.5)
    const dGrd = ctx.createLinearGradient(midB[0],midB[1],midF[0],midF[1])
    dGrd.addColorStop(0, 'rgba(30,16,5,0.35)')
    dGrd.addColorStop(0.3,'rgba(8,4,1,0.15)')
    dGrd.addColorStop(1,  'rgba(0,0,0,0.55)')
    ctx.fillStyle=dGrd
    ctx.beginPath()
    ctx.moveTo(bL[0],bL[1]); ctx.lineTo(bR[0],bR[1])
    ctx.lineTo(fR[0],fR[1]); ctx.lineTo(fL[0],fL[1])
    ctx.closePath(); ctx.fill()

    // Stone pillars — trapezoidal, perspective-correct
    const pilFrac = 0.13
    ;[
      [0,       pilFrac],  // left pillar
      [1-pilFrac, 1.0  ],  // right pillar
    ].forEach(([s0,s1]) => {
      const pBL=lerp2D(bL,bR,s0), pBR=lerp2D(bL,bR,s1)
      const pFL=lerp2D(fL,fR,s0), pFR=lerp2D(fL,fR,s1)
      ctx.fillStyle=stoneC
      ctx.beginPath()
      ctx.moveTo(pBL[0],pBL[1]); ctx.lineTo(pBR[0],pBR[1])
      ctx.lineTo(pFR[0],pFR[1]); ctx.lineTo(pFL[0],pFL[1])
      ctx.closePath(); ctx.fill()
      // Inner shadow edge
      const iEdB=s0===0?pBR:pBL, iEdF=s0===0?pFR:pFL
      ctx.strokeStyle='rgba(0,0,0,0.85)'; ctx.lineWidth=1.8
      ctx.beginPath(); ctx.moveTo(iEdB[0],iEdB[1]); ctx.lineTo(iEdF[0],iEdF[1]); ctx.stroke()
      // Outer catch-light
      const oEdB=s0===0?pBL:pBR, oEdF=s0===0?pFL:pFR
      ctx.strokeStyle=`rgba(70,48,18,0.40)`; ctx.lineWidth=0.8
      ctx.beginPath(); ctx.moveTo(oEdB[0],oEdB[1]); ctx.lineTo(oEdF[0],oEdF[1]); ctx.stroke()
      // Brick joints on pillar
      for(let bi=1;bi<4;bi++){
        const t2=bi/4
        ctx.strokeStyle='rgba(0,0,0,0.40)'; ctx.lineWidth=0.6
        const jjL=lerp2D(pBL,pFL,t2), jjR=lerp2D(pBR,pFR,t2)
        ctx.beginPath(); ctx.moveTo(jjL[0],jjL[1]); ctx.lineTo(jjR[0],jjR[1]); ctx.stroke()
      }
    })

    // Lintel at far end
    const lintFrac = 0.08
    const lBL=lerp2D(fL,fR,0), lBR=lerp2D(fL,fR,1)
    const lTL=lerp2D(lerp2D(bL,fL,1-lintFrac),lerp2D(bR,fR,1-lintFrac),0)
    const lTR=lerp2D(lerp2D(bL,fL,1-lintFrac),lerp2D(bR,fR,1-lintFrac),1)
    ctx.fillStyle=stoneD
    ctx.beginPath()
    ctx.moveTo(lBL[0],lBL[1]); ctx.lineTo(lBR[0],lBR[1])
    ctx.lineTo(lTR[0],lTR[1]); ctx.lineTo(lTL[0],lTL[1])
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle='rgba(0,0,0,0.92)'; ctx.lineWidth=2
    ctx.beginPath(); ctx.moveTo(lTL[0],lTL[1]); ctx.lineTo(lTR[0],lTR[1]); ctx.stroke()

    // Iron bars — all corners interpolated from the 4 trapezoid corners
    // so every bar and crossbar follows the same perspective as the shape
    const nBars=5, iS=pilFrac, iE=1-pilFrac
    // Inner corners (between pillars) at board edge and far end
    const botL = lerp2D(bL,bR,iS), botR = lerp2D(bL,bR,iE)
    const topL = lerp2D(fL,fR,iS), topR = lerp2D(fL,fR,iE)
    // But topL/topR should be lintel base, not full far edge
    const lintFarL = lerp2D(lerp2D(bL,fL,1-lintFrac), lerp2D(bR,fR,1-lintFrac), iS)
    const lintFarR = lerp2D(lerp2D(bL,fL,1-lintFrac), lerp2D(bR,fR,1-lintFrac), iE)

    // Bar width at board edge
    const botW = Math.hypot(botR[0]-botL[0], botR[1]-botL[1])
    const topW = Math.hypot(lintFarR[0]-lintFarL[0], lintFarR[1]-lintFarL[1])
    const bwB = Math.max(1.2, botW / (nBars * 4.5))

    for(let bi=0;bi<=nBars;bi++){
      const t2 = bi/nBars
      const barBot = lerp2D(botL, botR, t2)
      const barTop = lerp2D(lintFarL, lintFarR, t2)
      // Bar width tapers with perspective
      const bw = bwB * (1 - t2*0 + 0)  // uniform for now, perspective from shape
      const bwScale = topW/botW  // how much thinner at far end
      const bwAt = (t) => bwB * (1 - t*(1-bwScale))

      // Compute actual bar endpoints by interpolating along depth
      const barB2 = lerp2D(botL, botR, t2)
      const barT2 = lerp2D(lintFarL, lintFarR, t2)
      const bwCur = bwB

      ctx.strokeStyle='rgba(0,0,0,0.65)'; ctx.lineWidth=bwCur*1.4
      ctx.beginPath(); ctx.moveTo(barB2[0],barB2[1]); ctx.lineTo(barT2[0],barT2[1]); ctx.stroke()
      ctx.strokeStyle='#12121C'; ctx.lineWidth=bwCur
      ctx.beginPath(); ctx.moveTo(barB2[0],barB2[1]); ctx.lineTo(barT2[0],barT2[1]); ctx.stroke()
      // Highlight on leading edge
      const perp = isHorizWall
        ? [-( barT2[1]-barB2[1]), barT2[0]-barB2[0]]
        : [-(barT2[1]-barB2[1]), barT2[0]-barB2[0]]
      const plen = Math.hypot(perp[0],perp[1]) || 1
      const px = perp[0]/plen*bwCur*0.35, py = perp[1]/plen*bwCur*0.35
      ctx.strokeStyle='rgba(55,38,14,0.55)'; ctx.lineWidth=bwCur*0.35
      ctx.beginPath(); ctx.moveTo(barB2[0]-px,barB2[1]-py); ctx.lineTo(barT2[0]-px,barT2[1]-py); ctx.stroke()
    }

    // Crossbars — lerp along depth axis, connecting left to right at each level
    for(let ci=1;ci<=3;ci++){
      const ct=ci/4
      const cL = lerp2D(botL, lintFarL, ct)
      const cR = lerp2D(botR, lintFarR, ct)
      // Width tapers with perspective
      const cw = Math.max(0.8, bwB * (1-(1-topW/botW)*ct) * 0.85)
      ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=cw*1.4
      ctx.beginPath(); ctx.moveTo(cL[0],cL[1]); ctx.lineTo(cR[0],cR[1]); ctx.stroke()
      ctx.strokeStyle='#12121C'; ctx.lineWidth=cw
      ctx.beginPath(); ctx.moveTo(cL[0],cL[1]); ctx.lineTo(cR[0],cR[1]); ctx.stroke()
    }

    // Glow through bars — more visible
    const glowMid = lerp2D(midB, midF, 0.4)
    const glowR = pw * 0.8
    const gG = ctx.createRadialGradient(glowMid[0],glowMid[1],0, glowMid[0],glowMid[1],glowR)
    gG.addColorStop(0, `rgba(255,190,80,${(0.18+litLv*0.08).toFixed(3)})`)
    gG.addColorStop(0.4,`rgba(255,160,50,${(0.09+litLv*0.04).toFixed(3)})`)
    gG.addColorStop(1,  'rgba(255,140,40,0)')
    ctx.fillStyle=gG
    ctx.beginPath()
    ctx.moveTo(bL[0],bL[1]); ctx.lineTo(bR[0],bR[1])
    ctx.lineTo(fR[0],fR[1]); ctx.lineTo(fL[0],fL[1])
    ctx.closePath(); ctx.fill()

    ctx.restore()

    // Board-edge frame line
    ctx.strokeStyle='rgba(0,0,0,0.90)'; ctx.lineWidth=2
    ctx.beginPath(); ctx.moveTo(bL[0],bL[1]); ctx.lineTo(bR[0],bR[1]); ctx.stroke()
  }

  // ── Wall decorations — drawn on the mortar face using perspective lerp ──

  // Ivy/vines growing from board edge into wall
  function drawWallVine(outerL, outerR, innerL, innerR, frac, seed2) {
    const startPt = lerp(lerp(innerL, innerR, frac), lerp(outerL, outerR, frac), 0.0)
    const endT = 0.30 + rng(seed2) * 0.30
    const endFrac = frac + (rng(seed2 + 1) - 0.5) * 0.10
    const endPt = lerp(lerp(innerL, innerR, endFrac), lerp(outerL, outerR, endFrac), endT)

    // Single gentle control point — not too curvy
    const cpFrac = frac + (rng(seed2 + 2) - 0.5) * 0.08
    const cpT = endT * 0.5
    const cpPt = lerp(lerp(innerL, innerR, cpFrac), lerp(outerL, outerR, cpFrac), cpT)

    // Sample points along the quadratic curve for leaf placement
    function sampleCurve(t) {
      const u = 1 - t
      return [
        u * u * startPt[0] + 2 * u * t * cpPt[0] + t * t * endPt[0],
        u * u * startPt[1] + 2 * u * t * cpPt[1] + t * t * endPt[1]
      ]
    }

    ctx.save()
    // Main vine stem
    ctx.strokeStyle = 'rgba(18,45,12,0.70)'
    ctx.lineWidth = 2.0
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(startPt[0], startPt[1])
    ctx.quadraticCurveTo(cpPt[0], cpPt[1], endPt[0], endPt[1])
    ctx.stroke()

    // Branch tendrils off the main vine
    const numBranches = 2 + Math.floor(rng(seed2 + 3) * 2)
    for (let b = 0; b < numBranches; b++) {
      const bt = 0.3 + (b / numBranches) * 0.5
      const bPt = sampleCurve(bt)
      const branchLen = 8 + rng(seed2 + 20 + b) * 10
      const branchAngle = (rng(seed2 + 21 + b) - 0.5) * 1.5
      const dx = endPt[0] - startPt[0], dy = endPt[1] - startPt[1]
      const baseAngle = Math.atan2(dy, dx) + branchAngle
      const branchEnd = [
        bPt[0] + Math.cos(baseAngle) * branchLen,
        bPt[1] + Math.sin(baseAngle) * branchLen
      ]
      ctx.strokeStyle = 'rgba(22,50,14,0.50)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(bPt[0], bPt[1])
      ctx.lineTo(branchEnd[0], branchEnd[1])
      ctx.stroke()

      // Leaf at branch tip
      const leafSize = 3.5 + rng(seed2 + 22 + b) * 2.5
      ctx.fillStyle = `rgba(${25 + Math.floor(rng(seed2 + 23 + b) * 25)},${55 + Math.floor(rng(seed2 + 24 + b) * 30)},12,0.50)`
      ctx.beginPath()
      ctx.ellipse(branchEnd[0], branchEnd[1], leafSize, leafSize * 0.45, baseAngle, 0, Math.PI * 2)
      ctx.fill()
    }

    // Leaves along the main vine — sampled on the curve
    const numLeaves = 4 + Math.floor(rng(seed2 + 4) * 4)
    for (let i = 0; i < numLeaves; i++) {
      const lt = 0.15 + (i / numLeaves) * 0.75
      const lPt = sampleCurve(lt)
      // Small offset perpendicular to vine direction
      const offDist = (rng(seed2 + 30 + i) - 0.5) * 7
      const tangentX = endPt[0] - startPt[0], tangentY = endPt[1] - startPt[1]
      const perpX = -tangentY, perpY = tangentX
      const perpLen = Math.hypot(perpX, perpY) || 1
      const lx = lPt[0] + (perpX / perpLen) * offDist
      const ly = lPt[1] + (perpY / perpLen) * offDist

      const leafSize = 2.8 + rng(seed2 + 31 + i) * 3.0
      const leafAlpha = 0.40 + rng(seed2 + 32 + i) * 0.25
      const greenVar = Math.floor(rng(seed2 + 33 + i) * 30)
      ctx.fillStyle = `rgba(${20 + greenVar},${52 + greenVar + 12},10,${leafAlpha.toFixed(2)})`
      ctx.beginPath()
      ctx.ellipse(lx, ly, leafSize, leafSize * 0.4,
        Math.atan2(tangentY, tangentX) + (rng(seed2 + 34 + i) - 0.5) * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Apply decorations to the 4 wall faces using their perspective coords
  // Top wall: outerL=[0,0], outerR=[fullW,0], innerL=[BX,BY], innerR=[BX+W,BY]
  const wTopOL = [0, 0], wTopOR = [fullW, 0], wTopIL = [BX, BY], wTopIR = [BX + W, BY]
  const wBotOL = [0, fullH], wBotOR = [fullW, fullH], wBotIL = [BX, BY + H], wBotIR = [BX + W, BY + H]
  const wLftOL = [0, 0], wLftOR = [0, fullH], wLftIL = [BX, BY], wLftIR = [BX, BY + H]
  const wRgtOL = [fullW, 0], wRgtOR = [fullW, fullH], wRgtIL = [BX + W, BY], wRgtIR = [BX + W, BY + H]

  // Vines/ivy on all walls
  for (let vi = 0; vi < 4; vi++) {
    const vf = 0.1 + vi * 0.22
    if (rng(vi * 23 + 400) > 0.25) {
      drawWallVine(wLftOL, wLftOR, wLftIL, wLftIR, vf, vi * 31 + 401)
    }
    if (rng(vi * 29 + 500) > 0.25) {
      drawWallVine(wRgtOL, wRgtOR, wRgtIL, wRgtIR, vf, vi * 37 + 501)
    }
  }
  for (let vi = 0; vi < 3; vi++) {
    const vf = 0.1 + vi * 0.35
    if (rng(vi * 41 + 600) > 0.3) {
      drawWallVine(wTopOL, wTopOR, wTopIL, wTopIR, vf, vi * 43 + 601)
    }
    if (rng(vi * 47 + 700) > 0.4) {
      drawWallVine(wBotOL, wBotOR, wBotIL, wBotIR, vf, vi * 53 + 701)
    }
  }

  // ── Ragged edge along actual board perimeter (batched single path) ───────
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.80)'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isBoard(r, c)) continue
      const x = BX + c * TILE, y = BY + r * TILE
      const edgeSegs = []
      if (!isBoard(r - 1, c)) edgeSegs.push([x, y, x + TILE, y, 0, -1])
      if (!isBoard(r + 1, c)) edgeSegs.push([x, y + TILE, x + TILE, y + TILE, 0, 1])
      if (!isBoard(r, c - 1)) edgeSegs.push([x, y, x, y + TILE, -1, 0])
      if (!isBoard(r, c + 1)) edgeSegs.push([x + TILE, y, x + TILE, y + TILE, 1, 0])
      edgeSegs.forEach(([ex0, ey0, ex1, ey1, outX, outY]) => {
        const eSeed = r * 131 + c * 97 + outX * 7 + outY * 13
        const steps = 6
        ctx.moveTo(ex0, ey0)
        for (let i = 1; i < steps; i++) {
          const t = i / steps
          const bx = ex0 + (ex1 - ex0) * t
          const by = ey0 + (ey1 - ey0) * t
          const jitter = (rng(eSeed + i * 7) - 0.4) * 5
          ctx.lineTo(bx + outX * jitter, by + outY * jitter)
        }
        ctx.lineTo(ex1, ey1)
      })
    }
  }
  ctx.stroke()
  ctx.restore()

  // ── Rubble along the actual board perimeter ─────────────────────────────
  ctx.save()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isBoard(r, c)) continue
      const x = BX + c * TILE, y = BY + r * TILE
      const edges = []
      if (!isBoard(r - 1, c)) edges.push([x, y, x + TILE, y, 0, -1])
      if (!isBoard(r + 1, c)) edges.push([x, y + TILE, x + TILE, y + TILE, 0, 1])
      if (!isBoard(r, c - 1)) edges.push([x, y, x, y + TILE, -1, 0])
      if (!isBoard(r, c + 1)) edges.push([x + TILE, y, x + TILE, y + TILE, 1, 0])
      edges.forEach(([ex0, ey0, ex1, ey1, outX, outY]) => {
        const eSeed = r * 131 + c * 97 + outX * 7 + outY * 13
        const numRocks = 2 + Math.floor(rng(eSeed) * 3)
        for (let i = 0; i < numRocks; i++) {
          const t = rng(eSeed + i * 3 + 1)
          const rx = ex0 + (ex1 - ex0) * t + outX * (1 + rng(eSeed + i * 5 + 2) * 6)
          const ry = ey0 + (ey1 - ey0) * t + outY * (1 + rng(eSeed + i * 7 + 3) * 6)
          const sz = 1.2 + rng(eSeed + i * 11 + 4) * 2.5
          const bright = 18 + Math.floor(rng(eSeed + i * 13 + 5) * 22)
          ctx.fillStyle = `rgba(${bright + 8},${bright},${bright - 4},${(0.35 + rng(eSeed + i * 9 + 6) * 0.30).toFixed(2)})`
          ctx.beginPath()
          ctx.ellipse(rx, ry, sz, sz * 0.55, rng(eSeed + i * 17 + 7) * Math.PI, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    }
  }
  ctx.restore()

  // ── Cobwebs — larger, more visible, varied ─────────────────────────────
  function drawCobweb(cx, cy, radiusX, radiusY, startAngle, endAngle, webSeed) {
    ctx.save()
    const numStrands = 6 + Math.floor(rng(webSeed) * 5)
    const angleSpan = endAngle - startAngle
    const strands = []
    for (let i = 0; i < numStrands; i++) {
      const a = startAngle + (i / (numStrands - 1)) * angleSpan
      const r2 = 0.6 + rng(webSeed + i + 1) * 0.4
      const ex = cx + Math.cos(a) * radiusX * r2
      const ey = cy + Math.sin(a) * radiusY * r2
      strands.push([ex, ey])
      // Radial strand with slight sag
      const midX = (cx + ex) / 2 + (rng(webSeed + i + 20) - 0.5) * 4
      const midY = (cy + ey) / 2 + rng(webSeed + i + 21) * 3
      ctx.strokeStyle = `rgba(200,190,170,${(0.15 + rng(webSeed + i + 30) * 0.12).toFixed(2)})`
      ctx.lineWidth = 0.5 + rng(webSeed + i + 40) * 0.4
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.quadraticCurveTo(midX, midY, ex, ey)
      ctx.stroke()
    }
    // Cross threads — spiral rings with sag
    for (let ring = 1; ring <= 4; ring++) {
      const t = ring / 5
      ctx.strokeStyle = `rgba(190,180,160,${(0.08 + ring * 0.02).toFixed(2)})`
      ctx.lineWidth = 0.4
      ctx.beginPath()
      for (let i = 0; i < strands.length; i++) {
        const px = cx + (strands[i][0] - cx) * t
        const py = cy + (strands[i][1] - cy) * t + rng(webSeed + ring * 7 + i) * 2
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    ctx.restore()
  }
  const webR = WALL * 0.7
  drawCobweb(BX, BY, webR, webR, Math.PI, Math.PI * 1.5, 1100)
  drawCobweb(BX + W, BY, webR, webR, Math.PI * 1.5, Math.PI * 2, 1110)
  drawCobweb(BX, BY + H, webR * 0.8, webR * 0.8, Math.PI * 0.5, Math.PI, 1120)
  drawCobweb(BX + W, BY + H, webR * 0.6, webR * 0.6, 0, Math.PI * 0.5, 1130)

  // ── Edge darkness vignette — using 4 reusable gradients ──
  const vigDepth = TILE * 2.5
  const vigOpacity = 0.55
  ctx.save()
  // Pre-create one gradient per direction (translate via transform for each square)
  const vigDown = ctx.createLinearGradient(0, 0, 0, vigDepth)
  vigDown.addColorStop(0, `rgba(0,0,0,${vigOpacity})`); vigDown.addColorStop(1, 'rgba(0,0,0,0)')
  const vigUp = ctx.createLinearGradient(0, TILE, 0, TILE - vigDepth)
  vigUp.addColorStop(0, `rgba(0,0,0,${vigOpacity})`); vigUp.addColorStop(1, 'rgba(0,0,0,0)')
  const vigRight = ctx.createLinearGradient(0, 0, vigDepth, 0)
  vigRight.addColorStop(0, `rgba(0,0,0,${vigOpacity})`); vigRight.addColorStop(1, 'rgba(0,0,0,0)')
  const vigLeft = ctx.createLinearGradient(TILE, 0, TILE - vigDepth, 0)
  vigLeft.addColorStop(0, `rgba(0,0,0,${vigOpacity})`); vigLeft.addColorStop(1, 'rgba(0,0,0,0)')
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isBoard(r, c)) continue
      const x = BX + c * TILE, y = BY + r * TILE
      ctx.save()
      ctx.translate(x, y)
      if (!isBoard(r - 1, c)) { ctx.fillStyle = vigDown; ctx.fillRect(0, 0, TILE, vigDepth) }
      if (!isBoard(r + 1, c)) { ctx.fillStyle = vigUp; ctx.fillRect(0, TILE - vigDepth, TILE, vigDepth) }
      if (!isBoard(r, c - 1)) { ctx.fillStyle = vigRight; ctx.fillRect(0, 0, vigDepth, TILE) }
      if (!isBoard(r, c + 1)) { ctx.fillStyle = vigLeft; ctx.fillRect(TILE - vigDepth, 0, vigDepth, TILE) }
      ctx.restore()
    }
  }
  ctx.restore()

  const midColX = BX+(minC+maxC+1)*TILE/2
  const midRowY = BY+(minR+maxR+1)*TILE/2
  drawPortcullis(midColX, BY,    true)
  drawPortcullis(midColX, BY+H,  true)
  if (typeof G!=='undefined' && G.numPlayers===4) {
    drawPortcullis(BX,    midRowY, false)
    drawPortcullis(BX+W,  midRowY, false)
  }

  // Cache the result for instant redraw on subsequent calls
  const cacheCanvas = document.createElement('canvas')
  cacheCanvas.width = fullW; cacheCanvas.height = fullH
  cacheCanvas.getContext('2d').drawImage(canvasEl, 0, 0)
  _surroundCache = { mapId: map.id, tile: TILE, canvas: cacheCanvas }
}




// ── Inline sprite injection (synchronous, no fetch needed) ──
function ensureSpriteDefs(svg) {
  let defs = svg.querySelector('defs')
  if (!defs) { defs = svgEl('defs'); svg.insertBefore(defs, svg.firstChild) }

  // Inject themed piece symbols
  // Inject SVG-internal <style> with animation keyframes
  // (inline style attr animations are unreliable in SVG; internal style works)
  if (!defs.querySelector('style')) {
    const styleEl = document.createElementNS(SVGns, 'style')
    styleEl.textContent = [
      '@keyframes gp-a{0%,100%{opacity:0.45}35%{opacity:0.12}65%{opacity:0.58}}',
      '@keyframes gp-b{0%,100%{opacity:0.38}42%{opacity:0.62}72%{opacity:0.10}}',
      '@keyframes gp-c{0%,100%{opacity:0.52}28%{opacity:0.15}55%{opacity:0.65}82%{opacity:0.12}}',
      '@keyframes fk-a{0%,100%{opacity:0.92}18%{opacity:0.60}40%{opacity:0.85}60%{opacity:0.48}80%{opacity:0.80}}',
      '@keyframes fk-b{0%,100%{opacity:0.82}30%{opacity:0.95}55%{opacity:0.58}75%{opacity:0.88}}',
      '@keyframes fk-c{0%,100%{opacity:0.75}22%{opacity:0.92}48%{opacity:0.52}70%{opacity:0.86}90%{opacity:0.50}}',
      '@keyframes wv-a{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-60px}}',
      '@keyframes wv-b{0%{stroke-dashoffset:0}100%{stroke-dashoffset:50px}}',
      '@keyframes wv-c{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-40px}}',
      '.wva{stroke-dasharray:20 8;animation:wv-a 3.2s linear infinite}',
      '.wvb{stroke-dasharray:16 10;animation:wv-b 4.1s linear infinite}',
      '.wvc{stroke-dasharray:24 6;animation:wv-c 3.7s linear infinite}',
      '.gpa{animation:gp-a 5.5s ease-in-out infinite}',
      '.gpb{animation:gp-b 6.8s ease-in-out infinite}',
      '.gpc{animation:gp-c 4.9s ease-in-out infinite}',
      '.fka{animation:fk-a 5.5s ease-in-out infinite}',
      '.fkb{animation:fk-b 6.8s ease-in-out infinite}',
      '.fkc{animation:fk-c 4.9s ease-in-out infinite}',
      '@keyframes bubble-rise{0%{transform:translateY(0) scale(1);opacity:0.35}50%{opacity:0.5}100%{transform:translateY(-30px) scale(0.6);opacity:0}}',
      '.bubble{animation:bubble-rise 4s ease-in infinite;transform-origin:center}',
    ].join('')
    defs.appendChild(styleEl)
  }

  // Glow filter for selected pieces
  if (!defs.querySelector('#piece-glow')) {
    const filter = svgEl('filter', { id:'piece-glow', x:'-20%', y:'-20%', width:'140%', height:'140%' })
    const fe = svgEl('feDropShadow', { dx:0, dy:0, stdDeviation:3, 'flood-color':'#c9a83e', 'flood-opacity':0.9 })
    filter.appendChild(fe); defs.appendChild(filter)
  }

  // Lantern warm-glow filter
  if (!defs.querySelector('#lantern-glow')) {
    const f = svgEl('filter', { id:'lantern-glow', x:'-100%', y:'-100%', width:'300%', height:'300%' })
    const blur = svgEl('feGaussianBlur', { stdDeviation:'6', result:'blur' })
    const flood = svgEl('feFlood', { 'flood-color':'#B08D2D', 'flood-opacity':'0.35', result:'color' })
    const comp = svgEl('feComposite', { in:'color', in2:'blur', operator:'in', result:'glow' })
    const merge = svgEl('feMerge')
    const m1 = svgEl('feMergeNode', { in:'glow' })
    const m2 = svgEl('feMergeNode', { in:'SourceGraphic' })
    merge.appendChild(m1); merge.appendChild(m2)
    f.appendChild(blur); f.appendChild(flood); f.appendChild(comp); f.appendChild(merge)
    defs.appendChild(f)
  }


  // Inject all piece symbols — parse from inline strings, import into SVG namespace
  if (!defs.querySelector('#piece-wp')) {
    const parser = new DOMParser()
    Object.values(PIECE_SYMBOLS).forEach(symStr => {
      const doc = parser.parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${symStr}</svg>`, 'image/svg+xml'
      )
      const sym = doc.querySelector('symbol')
      if (sym) defs.appendChild(document.importNode(sym, true))
    })
  }
}

