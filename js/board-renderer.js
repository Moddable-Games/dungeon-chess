import { TILE, TILE_MIN, PIECE_SYMBOLS, SP, PT, FEN_CH, UNITS } from './data.js'
import MCE from '../lib/mce/chess-engine.js'
import { drawDungeonSurround } from './dungeon-surround.js'
import { G } from './state.js'

let _cursorRenderer = null
export function registerCursorRenderer(fn) { _cursorRenderer = fn }

export const SVGns = 'http://www.w3.org/2000/svg'

export function svgEl(tag, attrs={}) {
  const el = document.createElementNS(SVGns, tag)
  for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

export function spToColor(sp) {
  return sp === SP.U ? 'b' : 'w'
}

export const SP_PIECE_COLOR = {
  [SP.H]: null,
  [SP.U]: null,
  [SP.R]: 'rgba(200,50,20,0.55)',
  [SP.G]: 'rgba(40,140,30,0.55)',
}

export function appendPieceTint(parent, ownerSp, offset, sz) {
  const col = SP_PIECE_COLOR[ownerSp]
  if (col) {
    parent.appendChild(svgEl('rect', {
      x: offset, y: offset, width: sz, height: sz,
      fill: col, style: 'pointer-events:none;mix-blend-mode:multiply'
    }))
  }
}

export const SQ_LIGHT  = '#2a2a38'
export const SQ_DARK   = '#1a1a26'
export const SQ_WATER  = '#0f2f52'
export const SQ_WATER2 = '#081e35'
const VOID_FILL = 'none'

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
export function drawCandle(svg, cx, cy, col, flickClass, delay=0) {
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
export function drawLantern(svg, cx, cy, col, flickClass, delay=0) {
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
export function drawStoneTexture(g, isLight) {
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

export function drawFloorDetails(g, r, c, isLight) {
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



// ── Inline sprite injection (synchronous, no fetch needed) ──
export function ensureSpriteDefs(svg) {
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

// ═══════════════════════════════════════════════════════════
// MCE HOOK ADAPTERS
// ═══════════════════════════════════════════════════════════

const _tileCache = new Map()
let _tileCacheKey = null

export function dcTilePainter(svg, sqIdx, dr, dc, tileSize, isLight, game) {
  const map = G.map
  if (!map) return null
  if (!map.grid[dr]) return svgEl('g', {})
  const cell = map.grid[dr][dc]
  if (cell === null) return svgEl('g', {})

  const cacheKey = `${map.id}-${dr}-${dc}-${tileSize}`
  if (_tileCacheKey !== `${map.id}-${tileSize}`) {
    _tileCache.clear()
    _tileCacheKey = `${map.id}-${tileSize}`
  }
  if (_tileCache.has(cacheKey)) {
    return _tileCache.get(cacheKey).cloneNode(true)
  }

  const g = svgEl('g', {})
  const isWater = cell === 'w'
  const fill = isWater ? (isLight ? SQ_WATER : SQ_WATER2)
                       : (isLight ? SQ_LIGHT : SQ_DARK)
  g.appendChild(svgEl('rect', { x: 0, y: 0, width: tileSize, height: tileSize, fill }))

  if (!isWater) {
    drawStoneTexture(g, isLight)
    drawFloorDetails(g, dr, dc, isLight)
  }

  if (isWater) {
    const clipId = `mwclip-${dr}-${dc}`
    const clipPath = svgEl('clipPath', { id: clipId })
    clipPath.appendChild(svgEl('rect', { x: 0, y: 0, width: tileSize, height: tileSize }))
    let defs = svg.querySelector('defs')
    if (!defs) { defs = svgEl('defs', {}); svg.insertBefore(defs, svg.firstChild) }
    defs.appendChild(clipPath)
    const wg = svgEl('g', { 'clip-path': `url(#${clipId})`, 'pointer-events': 'none' })
    wg.appendChild(svgEl('rect', { x: 0, y: 0, width: tileSize, height: tileSize, fill: 'rgba(60,100,160,0.08)' }))
    for (let wi = 0; wi < 3; wi++) {
      const wy = tileSize * (0.22 + wi * 0.26)
      const wc = ['wva', 'wvb', 'wvc'][wi]
      wg.appendChild(svgEl('path', {
        d: `M -4 ${wy} Q ${tileSize*0.25} ${wy-4} ${tileSize/2} ${wy} Q ${tileSize*0.75} ${wy+4} ${tileSize+4} ${wy}`,
        stroke: 'rgba(140,200,255,0.40)', 'stroke-width': 1.2, fill: 'none', class: wc
      }))
      wg.appendChild(svgEl('path', {
        d: `M -4 ${wy+4} Q ${tileSize*0.30} ${wy+1} ${tileSize/2} ${wy+4} Q ${tileSize*0.70} ${wy+7} ${tileSize+4} ${wy+4}`,
        stroke: 'rgba(80,150,220,0.22)', 'stroke-width': 0.8, fill: 'none', class: ['wvc','wva','wvb'][wi]
      }))
    }
    g.appendChild(wg)
  }

  _tileCache.set(cacheKey, g.cloneNode(true))
  return g
}

export function dcPieceProvider(game, sqIdx, tileSize) {
  const pd = game.pieceData[sqIdx]
  if (!pd) return null
  const def = UNITS[pd.key]
  if (!def) return null

  const ownerSp = pd.owner === 'player' ? G.playerSp
    : pd.owner === 'ai' ? G.aiSp
    : pd.owner === 'ai2' ? G.ai2Sp : G.ai3Sp
  const sz = tileSize * 0.88
  const offset = (tileSize - sz) / 2

  const wrapper = svgEl('svg', { width: tileSize, height: tileSize, overflow: 'visible' })
  wrapper.appendChild(svgEl('ellipse', { cx: tileSize / 2, cy: tileSize - 4, rx: tileSize * 0.28, ry: 3.5, fill: 'rgba(0,0,0,0.60)' }))

  if (G.pieceStyle !== 'classic') {
    const folder = G.pieceStyle === 'custom-a' ? 'pieces' : 'pieces-alt'
    const img = svgEl('image', { x: offset, y: offset, width: sz, height: sz, preserveAspectRatio: 'xMidYMid meet' })
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `assets/${folder}/${pd.key}.png`)
    wrapper.appendChild(img)
  } else {
    const color = spToColor(ownerSp)
    const sid = color + FEN_CH[def.type]
    const use = svgEl('use', { href: `#piece-${sid}`, x: offset, y: offset, width: sz, height: sz })
    wrapper.appendChild(use)
    appendPieceTint(wrapper, ownerSp, offset, sz)
  }

  return wrapper
}

export function dcSurroundRenderer(container, game, boardRect) {
  const map = G.map
  if (!map) return
  let canvas = container.querySelector('canvas.dc-surround')
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.className = 'dc-surround'
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
  }
  const WALL = boardRect.tileSize * 2.2
  canvas.width = boardRect.width + WALL * 2
  canvas.height = boardRect.height + WALL * 2
  canvas.style.width = canvas.width + 'px'
  canvas.style.height = canvas.height + 'px'
  container.appendChild(canvas)
  drawDungeonSurround(canvas, map)
}

export function dcEffectOverlay(svg, effect, x, y, tileSize, game) {
  if (effect.type !== 'hex') return null
  const g = svgEl('g', {})
  g.appendChild(svgEl('rect', {
    x: x + 2, y: y + 2, width: tileSize - 4, height: tileSize - 4,
    fill: 'rgba(120,40,200,0.15)', stroke: 'rgba(160,60,255,0.5)',
    'stroke-width': 1.5, 'stroke-dasharray': '4,2'
  }))
  const cx = x + tileSize / 2, cy = y + tileSize / 2
  const txt = svgEl('text', {
    x: cx, y: cy + 3, 'text-anchor': 'middle', 'font-size': tileSize * 0.3,
    fill: 'rgba(160,60,255,0.7)', 'pointer-events': 'none'
  })
  txt.textContent = '⚡'
  g.appendChild(txt)
  return g
}

export function dcLegalMoveRenderer(svg, move, x, y, tileSize, isCapture, game) {
  const isAttack = move.flag === 'capture' || move.attackOnly
  const cx = x + tileSize / 2, cy = y + tileSize / 2

  if (isAttack) {
    const ag = svgEl('g', { style: 'pointer-events:none' })
    const rs = tileSize * 0.38
    ag.appendChild(svgEl('circle', { cx, cy, r: rs,
      fill: 'rgba(200,30,20,0.10)', stroke: 'rgba(220,60,40,0.65)', 'stroke-width': 1.5,
      'stroke-dasharray': '4,2' }))
    ag.appendChild(svgEl('path', {
      d: `M ${cx - rs*0.45} ${cy - rs*0.2} L ${cx} ${cy - rs*0.58} L ${cx + rs*0.45} ${cy - rs*0.2}`,
      stroke: 'rgba(220,60,40,0.85)', 'stroke-width': 1.5, fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    ag.appendChild(svgEl('path', {
      d: `M ${cx - rs*0.45} ${cy + rs*0.2} L ${cx} ${cy + rs*0.58} L ${cx + rs*0.45} ${cy + rs*0.2}`,
      stroke: 'rgba(220,60,40,0.85)', 'stroke-width': 1.5, fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    return ag
  }

  const rg = svgEl('g', { style: 'pointer-events:none' })
  const rs = tileSize * 0.28
  rg.appendChild(svgEl('circle', { cx, cy, r: rs,
    fill: 'rgba(40,180,60,0.15)', stroke: 'rgba(80,220,80,0.60)', 'stroke-width': 1.2,
    'stroke-dasharray': '5,3' }))
  rg.appendChild(svgEl('path', {
    d: `M ${cx - rs*0.55} ${cy} L ${cx + rs*0.55} ${cy} M ${cx} ${cy - rs*0.55} L ${cx} ${cy + rs*0.55}`,
    stroke: 'rgba(80,220,80,0.70)', 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round' }))
  rg.appendChild(svgEl('circle', { cx, cy, r: rs * 0.25, fill: 'rgba(80,220,80,0.50)' }))
  return rg
}

export function dcAfterRender(svg, game, tileSize, opts) {
  svg.id = 'dungeon-board'
  svg.classList.add('board-svg')
  svg.setAttribute('tabindex', '0')
  svg.setAttribute('aria-label', 'Game board - use arrow keys to navigate, Enter to select')
  ensureSpriteDefs(svg)

  if (opts.selected !== null && opts.selected !== undefined) {
    const [sr, sc] = MCE.rc(opts.selected, game)
    const sx = sc * tileSize, sy = sr * tileSize
    svg.appendChild(svgEl('rect', { x: sx + 1, y: sy + 1, width: tileSize - 2, height: tileSize - 2,
      fill: 'rgba(246,199,71,0.12)', stroke: 'rgba(246,199,71,0.50)',
      'stroke-width': 1.5, 'pointer-events': 'none' }))
  }

  if (opts.lastMove) {
    const squares = [opts.lastMove.from, opts.lastMove.to]
    for (let i = 0; i < squares.length; i++) {
      const [r, c] = MCE.rc(squares[i], game)
      const lx = c * tileSize, ly = r * tileSize
      const isTo = i === 1
      svg.appendChild(svgEl('rect', { x: lx + 1, y: ly + 1, width: tileSize - 2, height: tileSize - 2,
        fill: isTo ? 'rgba(176,141,45,0.12)' : 'rgba(176,141,45,0.06)',
        stroke: 'rgba(176,141,45,0.35)', 'stroke-width': 1, 'pointer-events': 'none' }))
    }
  }

  if (_cursorRenderer) _cursorRenderer(svg, tileSize)
}

export function getDCRenderOpts() {
  const map = G.map
  if (!map) return {}
  return {
    size: map.cols * TILE,
    tilePainter: dcTilePainter,
    pieceProvider: dcPieceProvider,
    legalMoveRenderer: dcLegalMoveRenderer,
    effectOverlay: dcEffectOverlay,
    afterRender: dcAfterRender,
    suppressHighlights: true,
    animate: true,
    animStyle: 'arc',
    animDuration: 350,
    animArcHeight: 0.25,
    animCaptureBurst: true
  }
}

