'use strict'
// ═══════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════
const G = {
  numPlayers:2,
  playerSp:null, aiSp:null, ai2Sp:null, ai3Sp:null,
  playerDraft:[], aiDraft:[], ai2Draft:[], ai3Draft:[],
  map:null,
  pieces:[],        // derived from MCE state: { id, key, r, c, owner }
  mceGame:null,     // MCE game object — source of truth for board state
  turn:'player', aiThinking:false, aiTimer:null,
  selR:null, selC:null,
  legalMoves:[], legalAttacks:[],
  capturedByPlayer:[], capturedByAi:[],
  history:[],
}
let draftList = []



function spToColor(sp) {
  return sp===SP.U ? 'b' : 'w'
}
const SP_PIECE_COLOR = {
  [SP.H]: null,
  [SP.U]: null,
  [SP.R]: 'rgba(200,50,20,0.55)',
  [SP.G]: 'rgba(40,140,30,0.55)',
}

// ═══════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════
function show(id) {
  // Stop light animation when leaving any screen — prevents GPU compositing overhead
  if (lightAnimState) { lightAnimState.stop = true; lightAnimState = null }
  // Release large canvas GPU memory from battle/placement screens when navigating away
  if (id !== 'battle') {
    const bc = document.getElementById('dungeon-canvas')
    const bl = document.getElementById('dungeon-lights')
    if (bc) { bc.width = 1; bc.height = 1 }
    if (bl) { bl.width = 1; bl.height = 1 }
  }
  if (id !== 'place') {
    const pc = document.getElementById('place-canvas')
    const pl = document.getElementById('place-lights')
    if (pc) { pc.width = 1; pc.height = 1 }
    if (pl) { pl.width = 1; pl.height = 1 }
  }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'))
  document.getElementById('screen-'+id).classList.add('active')
  if (id==='map')     renderMapScreen()
  if (id==='home') {
    const hc = document.getElementById('home-canvas')
    if (hc) renderAtmosphereCanvas(hc)
    document.getElementById('screen-home').scrollTop = 0
  }
  if (id==='end') {
    const ec = document.getElementById('end-canvas')
    if (ec) renderAtmosphereCanvas(ec)
  }
  if (id==='species') renderSpeciesScreen()
  if (id==='draft')   renderDraftScreen()
  if (id==='place')   renderPlacementScreen()
  if (id !== 'replay') {
    const rc = document.getElementById('replay-canvas')
    const rl = document.getElementById('replay-lights')
    if (rc) { rc.width = 1; rc.height = 1 }
    if (rl) { rl.width = 1; rl.height = 1 }
  }
  if (id==='replay' && typeof rpBuildLog === 'function') rpBuildLog()
  if (id==='battle' && typeof ttInit === 'function') ttInit()
  // canvas surround drawn after drawBoard() in confirm-place-btn handler
}

// ═══════════════════════════════════════════════════════════
// MAP SCREEN
// ═══════════════════════════════════════════════════════════
function renderMapScreen() {
  const grid = document.getElementById('map-grid')
  grid.innerHTML = ''
  const visibleMaps = MAPS.filter(m => G.numPlayers===4 ? m.players===4 : m.players===2)
  visibleMaps.forEach(m => {
    const card = document.createElement('div')
    card.className = 'map-card'
    card.innerHTML = `
      <div class="mc-icon">${m.icon}</div>
      <h3>${m.name}</h3>
      <p>${m.desc}</p>
      <div class="map-card-preview">
        ${miniMapSVG(m)}
      </div>
    `
    card.onclick = () => { G.map = m; show('species') }
    grid.appendChild(card)
  })
}

function miniMapSVG(m) {
  const s = 5
  const WALL_S = 8  // mini wall surround
  const W = m.cols*s + WALL_S*2, H = m.rows*s + WALL_S*2
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`

  // Cavern wall background — dark stone
  svg += `<rect width="${W}" height="${H}" fill="#12121C"/>`

  // Wall gradient suggestion — darker toward centre
  svg += `<defs>
    <radialGradient id="mg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#2a2a38" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#0a0a12" stop-opacity="0.4"/>
    </radialGradient>
  </defs>`
  svg += `<rect width="${W}" height="${H}" fill="url(#mg)"/>`

  // Board squares — dark stone colours matching actual board
  for (let r=0;r<m.rows;r++) for (let c=0;c<m.cols;c++) {
    const cell = m.grid[r][c]
    if (cell===null) continue
    const light = (r+c)%2===0
    let fill = light ? '#4a3728' : '#251a10'  // matches SQ_LIGHT/SQ_DARK
    if (cell==='w') fill = light ? '#0f2f52' : '#081e35'  // water
    svg += `<rect x="${WALL_S+c*s}" y="${WALL_S+r*s}" width="${s}" height="${s}" fill="${fill}"/>`
  }

  // Torch glow dots at corners
  const corners = [[WALL_S*0.5,WALL_S*0.5],[W-WALL_S*0.5,WALL_S*0.5],
                   [WALL_S*0.5,H-WALL_S*0.5],[W-WALL_S*0.5,H-WALL_S*0.5]]
  const glows = ['rgba(255,175,60,0.7)','rgba(255,210,80,0.7)',
                 'rgba(255,140,45,0.7)','rgba(255,190,55,0.7)']
  corners.forEach(([cx,cy],i) => {
    svg += `<circle cx="${cx}" cy="${cy}" r="${WALL_S*0.55}" fill="${glows[i]}" opacity="0.8"/>`
    svg += `<circle cx="${cx}" cy="${cy}" r="${WALL_S*0.22}" fill="#fffde0" opacity="0.95"/>`
  })

  return svg + '</svg>'
}

// ═══════════════════════════════════════════════════════════
// SPECIES SCREEN
// ═══════════════════════════════════════════════════════════
function renderSpeciesScreen() {
  const grid = document.getElementById('species-grid')
  grid.innerHTML = ''
  Object.values(SP).forEach(sp => {
    const info = SP_INFO[sp]
    const card = document.createElement('div')
    card.className = 'species-card'
    card.style.setProperty('--sp-accent', info.accent)
    card.innerHTML = `
      <div class="sp-emoji">${info.emoji}</div>
      <h3 class="sp-label">${info.label}</h3>
      <p class="sp-desc">${info.desc}</p>
      <div class="sp-roster">
        ${SP_UNITS[sp].map(k=>`<div class="sp-unit">${UNITS[k].name} · ${UNITS[k].cost}XP</div>`).join('')}
      </div>
    `
    card.onclick = () => {
      G.playerSp = sp
      const others = Object.values(SP).filter(s=>s!==sp)
      const shuffled = [...others].sort(()=>Math.random()-0.5)
      G.aiSp  = shuffled[0]
      G.ai2Sp = G.numPlayers===4 ? shuffled[1] : null
      G.ai3Sp = G.numPlayers===4 ? shuffled[2] : null
      show('draft')
    }
    grid.appendChild(card)
  })
}

// ═══════════════════════════════════════════════════════════
// DRAFT SCREEN
// ═══════════════════════════════════════════════════════════
function renderDraftScreen() {
  draftList = []
  const pi=SP_INFO[G.playerSp], ai=SP_INFO[G.aiSp]
  document.getElementById('screen-draft').style.setProperty('--sp-accent', pi.accent)
  const draftSub = G.numPlayers===4
    ? `${pi.emoji} ${pi.label} vs ${ai.emoji} ${ai.label} · ${SP_INFO[G.ai2Sp]?.emoji||''} ${SP_INFO[G.ai2Sp]?.label||''} · ${SP_INFO[G.ai3Sp]?.emoji||''} ${SP_INFO[G.ai3Sp]?.label||''}`
    : `${pi.emoji} ${pi.label} vs ${ai.emoji} ${ai.label} (AI)`
  document.getElementById('draft-sub').textContent=draftSub
  G.aiDraft = buildAiDraft(G.aiSp)
  document.getElementById('ai-prev-title').textContent = G.numPlayers===4
    ? `AI 1 — ${ai.emoji} ${ai.label}` : `AI TEAM — ${ai.emoji} ${ai.label}`
  document.getElementById('ai-prev-list').innerHTML=G.aiDraft.map(k=>`<div class="ai-line">${UNITS[k].name} · ${UNITS[k].cost}XP</div>`).join('')
  if (G.numPlayers===4 && G.ai2Sp && G.ai3Sp) {
    const ai2i=SP_INFO[G.ai2Sp], ai3i=SP_INFO[G.ai3Sp]
    const ai2d=buildAiDraft(G.ai2Sp), ai3d=buildAiDraft(G.ai3Sp)
    document.getElementById('ai2-prev').style.display='block'
    document.getElementById('ai2-prev-title').textContent=`AI 2 — ${ai2i.emoji} ${ai2i.label}`
    document.getElementById('ai2-prev-list').innerHTML=ai2d.map(k=>`<div class="ai-line">${UNITS[k].name} · ${UNITS[k].cost}XP</div>`).join('')
    document.getElementById('ai3-prev').style.display='block'
    document.getElementById('ai3-prev-title').textContent=`AI 3 — ${ai3i.emoji} ${ai3i.label}`
    document.getElementById('ai3-prev-list').innerHTML=ai3d.map(k=>`<div class="ai-line">${UNITS[k].name} · ${UNITS[k].cost}XP</div>`).join('')
  } else {
    document.getElementById('ai2-prev').style.display='none'
    document.getElementById('ai3-prev').style.display='none'
  }
  refreshDraft()
}

function refreshDraft() {
  const spent=draftList.reduce((s,k)=>s+UNITS[k].cost,0), left=75-spent
  const el=document.getElementById('xp-left')
  el.textContent=left; el.className='xp-num '+(left<10?'low':'ok')
  document.getElementById('draft-count').textContent=draftList.length
  const pi=SP_INFO[G.playerSp]

  document.getElementById('draft-avail').innerHTML=SP_UNITS[G.playerSp].map(k=>{
    const d=UNITS[k], can=left>=d.cost
    return `<div class="unit-row">
      <div><span class="unit-name">${d.name}</span><span class="unit-tag">${d.type}</span></div>
      <div class="unit-row-actions">
        <span class="unit-cost">${d.cost}XP</span>
        <button class="btn sm" data-add="${k}" ${can?'':'disabled'}>+</button>
      </div>
    </div>`
  }).join('')
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{draftList.push(b.dataset.add);refreshDraft()})

  document.getElementById('draft-team').innerHTML=draftList.length===0
    ?'<div class="draft-empty">No units drafted yet</div>'
    :draftList.map((k,i)=>{const d=UNITS[k];return`<div class="unit-row">
      <span class="unit-name">${d.name}</span>
      <div class="unit-row-actions">
        <span class="unit-cost">${d.cost}XP</span>
        <button class="btn sm" data-rm="${i}">×</button>
      </div>
    </div>`}).join('')
  document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{draftList.splice(+b.dataset.rm,1);refreshDraft()})

  const hasK=draftList.some(k=>UNITS[k].type===PT.K)
  const hasP=draftList.some(k=>UNITS[k].type===PT.P)
  document.getElementById('draft-warns').innerHTML=[
    !hasK?'<div class="draft-warn">⚠ Must include a King unit</div>':'',
    !hasP?'<div class="draft-warn">⚠ Must include at least one Pawn</div>':'',
  ].join('')
  document.getElementById('begin-btn').disabled=!(hasK&&hasP&&left>=0)
}

function buildAiDraft(sp,budget=75) {
  if (!sp || !SP_UNITS[sp]) return []
  const avail=SP_UNITS[sp],draft=[]; let xp=budget
  const take=k=>{draft.push(k);xp-=UNITS[k].cost}
  const pick=type=>avail.find(k=>UNITS[k].type===type&&!draft.includes(k))
  const kk=pick(PT.K); if(kk)take(kk)
  const pk=pick(PT.P); if(pk&&xp>=UNITS[pk].cost)take(pk)
  for(const t of[PT.Q,PT.B,PT.N,PT.C]){const k=pick(t);if(k&&xp>=UNITS[k].cost)take(k)}
  while(xp>=2){const p2=avail.find(k=>UNITS[k].type===PT.P&&UNITS[k].cost<=xp);if(!p2)break;take(p2)}
  return draft
}

