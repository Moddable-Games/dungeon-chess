'use strict'

// ═══════════════════════════════════════════════════════════
// UI UPDATES
// ═══════════════════════════════════════════════════════════
function updateUI() {
  const pi=SP_INFO[G.playerSp], ai=SP_INFO[G.aiSp]
  const tp=document.getElementById('turn-panel')
  tp.classList.toggle('turn-panel--player', G.turn==='player')
  tp.classList.toggle('turn-panel--enemy', G.turn!=='player')
  document.getElementById('t-emoji').textContent=G.aiThinking?'⏳':G.turn==='player'?pi.emoji:ai.emoji
  const tl=document.getElementById('t-label')
  const inCheck = G.turn==='player' && isInCheck('player')
  tl.textContent = G.aiThinking ? 'AI thinking…'
    : inCheck ? '⚠ Your king is in check!'
    : G.turn==='player' ? 'Your turn' : "AI's turn"
  tl.classList.toggle('t-label--check', inCheck)
  tl.classList.toggle('t-label--player', !inCheck && G.turn==='player')
  tl.classList.toggle('t-label--enemy', !inCheck && G.turn!=='player')
  // Announce turn changes for screen readers
  if (typeof kbAnnounce === 'function') {
    if (inCheck) kbAnnounce('Warning: your king is in check!')
    else if (G.turn === 'player' && !G.aiThinking) kbAnnounce('Your turn')
  }
  const pi2=SP_INFO[G.playerSp], ai2i=SP_INFO[G.aiSp]
  document.getElementById('p-label').textContent=`${pi2.emoji} YOU`
  document.getElementById('a-label').textContent=`${ai2i.emoji} AI${G.numPlayers===4?' 1':''}`
  document.getElementById('p-pieces').textContent=`Pieces: ${G.pieces.filter(p=>p.owner==='player').length}`
  document.getElementById('a-pieces').textContent=`Pieces: ${G.pieces.filter(p=>p.owner==='ai').length}${
    G.numPlayers===4 && G.ai2Sp ? ` | ${SP_INFO[G.ai2Sp].emoji}${G.pieces.filter(p=>p.owner==='ai2').length} | ${SP_INFO[G.ai3Sp].emoji}${G.pieces.filter(p=>p.owner==='ai3').length}`:''}`
  document.getElementById('p-cap').textContent=G.capturedByPlayer.length
    ?'Cap: '+G.capturedByPlayer.map(k=>UNITS[k].name).join(', ')
    :'Captured: none'
  document.getElementById('a-cap').textContent=G.capturedByAi.length
    ?'Lost: '+G.capturedByAi.map(k=>UNITS[k].name).join(', ')
    :'Lost: none'
}

function showSelected(p){
  const d=UNITS[p.key]
  const {moves,attacks}=getLegal(p)
  const safeMoves=moves.filter(([tr,tc])=>!wouldLeaveInCheck(p,tr,tc))
  const safeAttacks=attacks.filter(([tr,tc])=>!wouldLeaveInCheck(p,tr,tc))
  const spInfo=SP_INFO[p.owner==='player'?G.playerSp:G.aiSp]
  document.getElementById('sel-info').innerHTML=
    `<div class="sel-name">${d.name}</div>
     <div class="sel-meta">${d.type} · ${d.cost}XP</div>
     <div class="sel-meta sel-meta--moves">${safeMoves.length} moves</div>
     <div class="sel-meta sel-meta--attacks">${safeAttacks.length} attacks</div>`
}

function addLog(text){
  G.history.push(text)
  const el=document.getElementById('h-list')
  const d=document.createElement('div')
  d.className='h-entry';d.textContent=text
  el.insertBefore(d,el.firstChild)
  document.getElementById('undo-btn').disabled = G.history.length < 2 || G.turn !== 'player'
}

// ═══════════════════════════════════════════════════════════
// END GAME
// ═══════════════════════════════════════════════════════════
function endGame(winner){
  if(G.aiTimer)clearTimeout(G.aiTimer)
  G.aiThinking=false
  // Announce game result for screen readers
  if (typeof kbAnnounce === 'function') {
    kbAnnounce(winner === 'player' ? 'Victory! You won the battle.' : 'Defeat. The enemy has conquered.')
  }
  const pw=winner==='player'
  const pi=SP_INFO[G.playerSp]
  const winnerSp = winner==='player'?G.playerSp:winner==='ai'?G.aiSp:winner==='ai2'?G.ai2Sp:G.ai3Sp
  const winnerInfo = SP_INFO[winnerSp]

  const endEl = document.querySelector('.stone-frame--end')
  endEl.classList.remove('end-victory','end-defeat')
  endEl.classList.add(pw ? 'end-victory' : 'end-defeat')

  document.getElementById('end-icon').textContent=pw?'👑':'💀'
  document.getElementById('end-title').textContent=pw?'VICTORY':'DEFEAT'
  document.getElementById('end-sub').textContent=pw
    ?`${pi.emoji} ${pi.label} triumph!`
    :`${winnerInfo.emoji} ${winnerInfo.label} have conquered!`

  const mvp = G.capturedByPlayer.length
    ? G.capturedByPlayer.reduce((best, k) => UNITS[k].cost > UNITS[best].cost ? k : best)
    : null
  const survivors = G.pieces.filter(p => p.owner === 'player')
  const bestSurvivor = survivors.length
    ? survivors.reduce((best, p) => UNITS[p.key].cost > UNITS[best.key].cost ? p : best)
    : null

  document.getElementById('end-stats').innerHTML=[
    ['Turns', Math.ceil(G.history.length / 2)],
    ['Captured', G.capturedByPlayer.length],
    ['Lost', G.capturedByAi.length],
    ['MVP Kill', mvp ? UNITS[mvp].name : '—'],
    ['Top Survivor', bestSurvivor ? UNITS[bestSurvivor.key].name : '—'],
  ].map(([l,v])=>`<div class="end-stat"><div class="end-val${typeof v==='string'?' end-val--text':''}">${v}</div><div class="end-lbl">${l}</div></div>`).join('')

  const surviving = survivors.map(p => UNITS[p.key].name)
  const lost = G.capturedByAi.map(k => UNITS[k].name)
  let piecesHtml = ''
  if (surviving.length) {
    piecesHtml += `<div>Surviving: <div class="end-pieces-row">${surviving.map((n,i)=>`<span class="end-piece-tag end-piece-tag--alive" style="--i:${i}">${n}</span>`).join('')}</div></div>`
  }
  if (lost.length) {
    piecesHtml += `<div>Lost: <div class="end-pieces-row">${lost.map((n,i)=>`<span class="end-piece-tag end-piece-tag--dead" style="--i:${i}">${n}</span>`).join('')}</div></div>`
  }
  document.getElementById('end-pieces').innerHTML = piecesHtml
  setTimeout(()=>show('end'),900)
}


// ── Light animation system ────────────────────────────────────────────────
// Runs on a separate canvas via requestAnimationFrame — completely independent
// of SVG redraws so animations never restart on moves.
let lightAnimState = null

function startLightAnimation(lightsCanvas, map, WALL) {
  if (lightAnimState) { lightAnimState.stop = true }
  const state = { stop: false }
  lightAnimState = state

  const { cols, rows } = map
  const W = cols * TILE, H = rows * TILE
  const fullW = W + WALL*2, fullH = H + WALL*2
  const BX = WALL, BY = WALL

  lightsCanvas.width  = fullW
  lightsCanvas.height = fullH
  const ctx = lightsCanvas.getContext('2d')

  // ── Ambient particles — dust motes and embers ──
  const particles = []
  const NUM_PARTICLES = 25 + Math.floor(Math.min(cols, rows) * 2)
  for (let i = 0; i < NUM_PARTICLES; i++) {
    const isEmber = Math.random() < 0.3
    particles.push({
      x: BX + Math.random() * W,
      y: BY + Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: isEmber ? -(0.2 + Math.random() * 0.5) : (Math.random() - 0.5) * 0.15,
      size: isEmber ? 1.0 + Math.random() * 1.5 : 0.5 + Math.random() * 1.0,
      alpha: 0.2 + Math.random() * 0.4,
      isEmber,
      phase: Math.random() * Math.PI * 2,
      drift: 0.3 + Math.random() * 0.5,
    })
  }

  const lerp = (a,b,t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]

  // Torch dimensions relative to WALL
  const TORCH_LEN = WALL * 0.55
  const TORCH_W   = WALL * 0.13
  const FLAME_R   = WALL * 0.06

  // Screen corners and board corners
  const screenCorners = [[0,0],[fullW,0],[0,fullH],[fullW,fullH]]
  const boardCorners  = [[BX,BY],[BX+W,BY],[BX,BY+H],[BX+W,BY+H]]

  // Torch position: 35% along seam from screen corner toward board corner
  const T = 0.35
  const torchColors = [
    { glow:[255,175,60],  core:'#fff8d0', phase:0.0, speed:0.70 },
    { glow:[255,210,80],  core:'#fffde0', phase:2.1, speed:0.83 },
    { glow:[255,140,45],  core:'#fff0c0', phase:4.2, speed:0.67 },
    { glow:[255,190,55],  core:'#fff8d8', phase:1.6, speed:0.78 },
  ]
  const torches = screenCorners.map((sc, i) => {
    const bc = boardCorners[i]
    const pos = lerp(sc, bc, T)
    // Seam direction: from screen corner toward board corner
    const dx = bc[0]-sc[0], dy = bc[1]-sc[1]
    const len = Math.hypot(dx,dy)
    const seamAngle = Math.atan2(dy, dx)  // angle along seam toward board
    return { pos, seamAngle, ...torchColors[i] }
  })

  const boardCx = BX + W/2, boardCy = BY + H/2

  function flicker(torch, t) {
    const {phase:ph,speed:sp} = torch
    return 0.78+0.22*(
      Math.sin(t*sp+ph)*0.50+
      Math.sin(t*sp*1.62+ph*2.3)*0.30+
      Math.sin(t*sp*2.73+ph*0.7)*0.20
    )
  }

  function drawFrame(ts) {
    if (state.stop) return
    const t = ts/1000
    ctx.clearRect(0,0,fullW,fullH)

    torches.forEach(torch => {
      const f = flicker(torch, t)
      const [tx,ty] = torch.pos
      const [gr,gg,gb] = torch.glow

      // ── 1. Large glow cone toward board centre ──────────────────────
      const diag = Math.hypot(fullW,fullH)
      const reach = diag * 0.88 * f
      const refDiag = 900
      const sizeScale = Math.min(1.0, refDiag / diag)
      const op = 0.09 * f * sizeScale
      const gAngle = Math.atan2(boardCy-ty, boardCx-tx)

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.translate(tx,ty)
      ctx.rotate(gAngle)
      ctx.scale(1, 0.55)
      const grd = ctx.createRadialGradient(0,0,0,0,0,reach)
      grd.addColorStop(0,    `rgba(${gr},${gg},${gb},${(op*2.8).toFixed(3)})`)
      grd.addColorStop(0.15, `rgba(${gr},${gg},${gb},${(op*2.0).toFixed(3)})`)
      grd.addColorStop(0.45, `rgba(${gr},${gg},${gb},${(op*0.8).toFixed(3)})`)
      grd.addColorStop(0.75, `rgba(${gr},${gg},${gb},${(op*0.2).toFixed(3)})`)
      grd.addColorStop(1,    `rgba(${gr},${gg},${gb},0)`)
      ctx.fillStyle = grd
      ctx.beginPath(); ctx.arc(0,0,reach,0,Math.PI*2); ctx.fill()
      ctx.restore()

      // ── 2. Torch sprite ─────────────────────────────────────────────
      // Drawn in local space where +X is along seam toward board (flame end)
      // and -X is toward screen corner (mount end).
      // The torch lies flat on the wall face along the seam line.
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(torch.seamAngle)  // align with seam direction

      // In local coords: x=0 is torch centre, +x toward board (flame), -x toward wall

      // Iron wall bracket — at the screen-corner end (-x side)
      const bx0 = -TORCH_LEN*0.42  // bracket centre x
      ctx.fillStyle = '#1a1208'
      // Bracket plate
      ctx.fillRect(bx0-TORCH_W*0.15, -TORCH_W*0.70, TORCH_W*0.30, TORCH_W*1.40)
      // Bracket arms holding torch
      ctx.fillRect(bx0-TORCH_W*0.50, -TORCH_W*0.28, TORCH_W*1.00, TORCH_W*0.20)
      ctx.fillRect(bx0-TORCH_W*0.50,  TORCH_W*0.08, TORCH_W*1.00, TORCH_W*0.20)
      // Rivets
      ctx.fillStyle = '#3a2a10'
      ;[-TORCH_W*0.20, TORCH_W*0.20].forEach(ry => {
        ctx.beginPath(); ctx.arc(bx0, ry, TORCH_W*0.10, 0, Math.PI*2); ctx.fill()
      })
      // Bracket highlight
      ctx.fillStyle = 'rgba(150,110,50,0.50)'
      ctx.fillRect(bx0-TORCH_W*0.15, -TORCH_W*0.70, TORCH_W*0.30, TORCH_W*0.15)

      // Wooden handle — runs most of the torch length
      const hx0 = -TORCH_LEN*0.30, hx1 = TORCH_LEN*0.20
      const hLen = hx1-hx0, hw = TORCH_W*0.38
      ctx.fillStyle = '#7a4a20'
      ctx.beginPath()
      ctx.moveTo(hx0, -hw*0.90); ctx.lineTo(hx1, -hw)
      ctx.lineTo(hx1,  hw);      ctx.lineTo(hx0,  hw*0.90)
      ctx.closePath(); ctx.fill()
      // Wood grain
      ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.lineWidth = TORCH_W*0.05
      ;[-0.35, 0, 0.35].forEach(gy => {
        ctx.beginPath()
        ctx.moveTo(hx0, gy*hw*0.90)
        ctx.lineTo(hx1, gy*hw)
        ctx.stroke()
      })
      // Knot rings
      ctx.strokeStyle='rgba(50,25,5,0.35)'; ctx.lineWidth=TORCH_W*0.06
      ;[0.25,0.55,0.78].forEach(tp => {
        const kx = hx0+hLen*tp
        ctx.beginPath(); ctx.ellipse(kx,0,TORCH_W*0.06,hw,0,0,Math.PI*2); ctx.stroke()
      })

      // Pitch head — at the board-facing end (+x side)
      const px = TORCH_LEN*0.22
      const ph2 = TORCH_W*0.65, pw = TORCH_W*0.72
      ctx.fillStyle = '#100904'
      ctx.beginPath(); ctx.ellipse(px,0,pw,ph2,0,0,Math.PI*2); ctx.fill()
      // Cloth wrapping bands
      ctx.strokeStyle='rgba(50,35,10,0.55)'; ctx.lineWidth=TORCH_W*0.07
      ;[-0.50,-0.20,0.10,0.40].forEach(bt => {
        ctx.beginPath()
        ctx.ellipse(px,0,pw*0.85,ph2*(0.3+Math.abs(bt)*0.4),bt*Math.PI*0.3,0,Math.PI*2)
        ctx.stroke()
      })
      // Ember glow on head
      ctx.fillStyle=`rgba(${gr},${(gg*0.5)|0},0,0.50)`
      ctx.beginPath(); ctx.ellipse(px+pw*0.15,0,pw*0.60,ph2*0.55,0,0,Math.PI*2); ctx.fill()

      ctx.restore()

      // ── 3. Flame tip — at the outer end of the pitch head ──────────
      // Flame position: along seam direction, past the pitch head
      const fDist = TORCH_LEN*0.22 + TORCH_W*0.80
      const flameX = tx + Math.cos(torch.seamAngle) * fDist
      const flameY2= ty + Math.sin(torch.seamAngle) * fDist

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      // Outer warm halo
      const fGrd = ctx.createRadialGradient(flameX,flameY2,0,flameX,flameY2,FLAME_R*5*f)
      fGrd.addColorStop(0,   `rgba(${gr},${gg},${gb},${(0.80*f).toFixed(3)})`)
      fGrd.addColorStop(0.40,`rgba(${gr},${gg},${gb},${(0.35*f).toFixed(3)})`)
      fGrd.addColorStop(1,   `rgba(${gr},${gg},${gb},0)`)
      ctx.fillStyle = fGrd
      ctx.beginPath(); ctx.arc(flameX,flameY2,FLAME_R*5*f,0,Math.PI*2); ctx.fill()
      // White hot core
      ctx.fillStyle=torch.core; ctx.globalAlpha=f
      ctx.beginPath(); ctx.arc(flameX,flameY2,FLAME_R,0,Math.PI*2); ctx.fill()
      ctx.restore()
    })

    // ── Draw ambient particles ──
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    particles.forEach(p => {
      // Update position
      p.x += p.vx + Math.sin(t * p.drift + p.phase) * 0.2
      p.y += p.vy
      // Fade based on vertical drift
      const flickerAlpha = p.alpha * (0.6 + 0.4 * Math.sin(t * 2 + p.phase))

      // Wrap around within board area
      if (p.x < BX - 10) p.x = BX + W + 10
      if (p.x > BX + W + 10) p.x = BX - 10
      if (p.y < BY - 10) { p.y = BY + H; p.x = BX + Math.random() * W }
      if (p.y > BY + H + 10) { p.y = BY - 10; p.x = BX + Math.random() * W }

      if (p.isEmber) {
        // Embers: warm orange-red, slightly larger
        const emberR = 180 + Math.floor(Math.random() * 50)
        ctx.fillStyle = `rgba(${emberR},${80 + Math.floor(flickerAlpha * 100)},20,${flickerAlpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.8 + 0.2 * Math.sin(t * 3 + p.phase)), 0, Math.PI * 2)
        ctx.fill()
        // Tiny glow around ember
        ctx.fillStyle = `rgba(${emberR},100,30,${(flickerAlpha * 0.3).toFixed(3)})`
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2); ctx.fill()
      } else {
        // Dust motes: pale, tiny
        ctx.fillStyle = `rgba(200,180,140,${(flickerAlpha * 0.6).toFixed(3)})`
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      }
    })
    ctx.restore()

    requestAnimationFrame(drawFrame)
  }

  requestAnimationFrame(drawFrame)
}


// ── Atmosphere canvas for home/end screens ────────────────────────────────
function renderAtmosphereCanvas(canvas) {
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height

  // Dark cavern background
  ctx.fillStyle = '#060402'
  ctx.fillRect(0,0,W,H)

  // Four perspective walls — same as game board surround
  const BX = W*0.25, BY = H*0.20
  const BW = W*0.50, BH = H*0.60
  const DEEP = Math.min(BW,BH)*0.7

  function extPast(sc,bc,d){
    const dx=bc[0]-sc[0],dy=bc[1]-sc[1],len=Math.hypot(dx,dy)
    return [bc[0]+(dx/len)*d, bc[1]+(dy/len)*d]
  }
  const dTL=extPast([0,0],[BX,BY],DEEP)
  const dTR=extPast([W,0],[BX+BW,BY],DEEP)
  const dBL=extPast([0,H],[BX,BY+BH],DEEP)
  const dBR=extPast([W,H],[BX+BW,BY+BH],DEEP)

  function drawAtmoWall(oA,oB,iA,iB,lit) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(oA[0],oA[1]); ctx.lineTo(oB[0],oB[1])
    ctx.lineTo(iB[0],iB[1]); ctx.lineTo(iA[0],iA[1])
    ctx.closePath(); ctx.clip()
    const br=Math.round(18+lit*28),bg=Math.round(11+lit*18),bb=Math.round(4+lit*8)
    ctx.fillStyle=`rgb(${br},${bg},${bb})`; ctx.fillRect(0,0,W,H)
    // Simple gradient for depth
    const mid0=[(oA[0]+oB[0])/2,(oA[1]+oB[1])/2]
    const mid1=[(iA[0]+iB[0])/2,(iA[1]+iB[1])/2]
    const grd=ctx.createLinearGradient(mid0[0],mid0[1],mid1[0],mid1[1])
    grd.addColorStop(0,`rgba(255,180,60,${(lit*0.15).toFixed(2)})`)
    grd.addColorStop(0.6,'rgba(0,0,0,0)')
    grd.addColorStop(1,'rgba(0,0,0,0.70)')
    ctx.fillStyle=grd; ctx.fillRect(0,0,W,H)
    // Brick rows
    const depth=Math.hypot(mid1[0]-mid0[0],mid1[1]-mid0[1])
    const nR=Math.max(4,Math.round(depth/12))
    for(let ri=0;ri<=nR;ri++){
      const t=ri/nR
      const lx=oA[0]+(iA[0]-oA[0])*t,ly=oA[1]+(iA[1]-oA[1])*t
      const rx=oB[0]+(iB[0]-oB[0])*t,ry=oB[1]+(iB[1]-oB[1])*t
      ctx.strokeStyle=`rgba(0,0,0,${ri===0?0.8:0.45})`; ctx.lineWidth=ri===0?2:0.8
      ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(rx,ry); ctx.stroke()
    }
    ctx.restore()
  }

  drawAtmoWall([0,0],[W,0],dTL,dTR,0.90)
  drawAtmoWall([0,H],[W,H],dBL,dBR,0.14)
  drawAtmoWall([0,0],[0,H],dTL,dBL,0.55)
  drawAtmoWall([W,0],[W,H],dTR,dBR,0.20)

  // Darkness fade over centre
  const fadeGrd=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.min(W,H)*0.5)
  fadeGrd.addColorStop(0,'rgba(0,0,0,0)')
  fadeGrd.addColorStop(0.6,'rgba(0,0,0,0)')
  fadeGrd.addColorStop(1,'rgba(0,0,0,0.85)')
  ctx.fillStyle=fadeGrd; ctx.fillRect(0,0,W,H)

  // Corner seam lines
  ctx.strokeStyle='rgba(0,0,0,0.85)'; ctx.lineWidth=2
  ;[[0,0,dTL],[W,0,dTR],[0,H,dBL],[W,H,dBR]].forEach(([ox,oy,dp])=>{
    ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(dp[0],dp[1]); ctx.stroke()
  })

  // Warm torch glows in corners
  ;[[W*0.08,H*0.15],[W*0.92,H*0.15],[W*0.08,H*0.85],[W*0.92,H*0.85]].forEach(([tx,ty],i)=>{
    const cols=['255,200,80','255,160,60','255,180,40','255,200,80']
    const grd=ctx.createRadialGradient(tx,ty,0,tx,ty,W*0.18)
    grd.addColorStop(0,`rgba(${cols[i]},0.22)`)
    grd.addColorStop(1,`rgba(${cols[i]},0)`)
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(tx,ty,W*0.18,0,Math.PI*2); ctx.fill()
    // Source dot
    ctx.fillStyle=`rgba(${cols[i]},0.9)`
    ctx.beginPath(); ctx.arc(tx,ty,4,0,Math.PI*2); ctx.fill()
  })
}

// ═══════════════════════════════════════════════════════════
// BUTTON WIRING
// ═══════════════════════════════════════════════════════════
document.getElementById('confirm-place-btn').onclick = () => {
  // Build G.pieces from placement — AI pieces already set, add player pieces
  let id = Math.max(...G.pieces.map(p=>p.id), 0) + 1
  Object.entries(PL.placedSquares).forEach(([sqKey, {key}]) => {
    const [r, c] = sqKey.split(',').map(Number)
    G.pieces.push({ id: id++, key, r, c, owner: 'player' })
  })
  G.capturedByPlayer=[]; G.capturedByAi=[]; G.history=[]; G.trollWounded={}
  const orderVal = document.querySelector('[name="turn-order"]:checked').value
  const firstTurn = orderVal === 'random'
    ? (Math.random() < 0.5 ? 'player' : 'ai') : orderVal
  G.turn = firstTurn; G.aiThinking = false; G.selR=null; G.selC=null
  G.legalMoves=[]; G.legalAttacks=[]
  // Initialize MCE game state
  DungeonMCE.registerAllUnits()
  const players = G.numPlayers === 4 ? ['player','ai','ai2','ai3'] : ['player','ai']
  G.mceGame = DungeonMCE.createDungeonGame(G.map, G.pieces, players)
  G.mceGame.turn = firstTurn
  G.mceGame.turnIndex = G.mceGame.players.indexOf(firstTurn)
  if (typeof rpSaveInitial === 'function') rpSaveInitial()
  show('battle')
  drawBoard()
  lockTileSize()
  const bCanvas2 = document.getElementById('dungeon-canvas')
  if (bCanvas2 && G.map) drawDungeonSurround(bCanvas2, G.map)
  const bLights2 = document.getElementById('dungeon-lights')
  if (bLights2 && G.map) startLightAnimation(bLights2, G.map, TILE*2.2)
  updateUI()
  if (firstTurn !== 'player') {
    G.aiThinking = true
    G.aiTimer = setTimeout(runAi, 600 + Math.random() * 400)
  }
}
document.getElementById('place-back').onclick = () => show('draft')
document.getElementById('place-auto').onclick = () => autoPlace()
document.getElementById('place-reset').onclick = () => {
  PL.placementPieces.forEach(p => p.placed = false)
  PL.placedSquares = {}
  PL.selectedTrayIdx = null
  document.getElementById('confirm-place-btn').disabled = true
  if (G.map) computeTile(G.map)
  renderTray()
  renderPlacementBoard()
  updatePlaceHint()
}
// Render atmosphere on initial home screen
window.addEventListener('load', ()=>{ const hc=document.getElementById('home-canvas'); if(hc) renderAtmosphereCanvas(hc) })

document.getElementById('btn-play').onclick       = ()=>show('players')
document.getElementById('btn-play-bottom').onclick = ()=>show('players')
document.getElementById('players-back').onclick   = ()=>show('home')
document.getElementById('pick-2p').onclick        = ()=>{ G.numPlayers=2; show('map') }
document.getElementById('pick-4p').onclick        = ()=>{ G.numPlayers=4; G.map=MAPS[2]; show('species') }
document.getElementById('map-back').onclick       = ()=>show('home')
document.getElementById('species-back').onclick   = ()=>show('map')
document.getElementById('draft-back').onclick     = ()=>show('species')
document.getElementById('forfeit-btn').onclick = () => {
  if (!confirm('Are you sure you want to forfeit?')) return
  if (G.aiTimer) clearTimeout(G.aiTimer)
  G.aiThinking=false
  // In 4-player, pick the AI with most pieces as winner
  const aiOwners = G.numPlayers===4 ? ['ai','ai2','ai3'] : ['ai']
  const winner = aiOwners.reduce((best,o) =>
    G.pieces.filter(p=>p.owner===o).length > G.pieces.filter(p=>p.owner===best).length ? o : best
  , aiOwners[0])
  endGame(winner)
}
document.getElementById('undo-btn').onclick = () => {
  if (G.turn !== 'player' || G_undoStack.length < 2) return
  for (let i = 0; i < 2; i++) {
    const move = G_undoStack.pop()
    if (!move) break
    if (move.mceUndo) MCE.unmakeMove(G.mceGame, move.mceUndo)
    if (move.capturedPiece) {
      if (move.owner === 'player') G.capturedByPlayer.pop()
      else G.capturedByAi.pop()
    }
    G.history.pop()
  }
  G.pieces = DungeonMCE.syncPiecesFromMCE(G.mceGame)
  G.turn = G.mceGame.turn; G.aiThinking = false
  G_lastMove = G_undoStack.length ? { fr: G_undoStack[G_undoStack.length-1].fr, fc: G_undoStack[G_undoStack.length-1].fc, tr: G_undoStack[G_undoStack.length-1].tr, tc: G_undoStack[G_undoStack.length-1].tc } : null
  G.selR = null; G.selC = null; G.legalMoves = []; G.legalAttacks = []
  const el = document.getElementById('h-list')
  el.innerHTML = ''
  G.history.forEach(text => { const d = document.createElement('div'); d.className='h-entry'; d.textContent=text; el.insertBefore(d, el.firstChild) })
  document.getElementById('undo-btn').disabled = G_undoStack.length < 2
  drawBoard(); updateUI()
}

document.getElementById('play-again-btn').onclick = ()=>{
  if(G.aiTimer)clearTimeout(G.aiTimer)
  G_undoStack.length = 0; G_lastMove = null
  Object.assign(G,{numPlayers:2,playerSp:null,aiSp:null,ai2Sp:null,ai3Sp:null,playerDraft:[],aiDraft:[],ai2Draft:[],ai3Draft:[],map:null,pieces:[],mceGame:null,
    turn:'player',aiThinking:false,aiTimer:null,selR:null,selC:null,
    legalMoves:[],legalAttacks:[],capturedByPlayer:[],capturedByAi:[],history:[],trollWounded:{}})
  Object.assign(PL,{selectedTrayIdx:null,placedSquares:{},placementPieces:[],spawnRows:[]})
  unlockTileSize(); invalidateStaticBoard()
  show('home')
}

document.getElementById('rematch-btn').onclick = ()=>{
  if(G.aiTimer)clearTimeout(G.aiTimer)
  G_undoStack.length = 0; G_lastMove = null
  const savedMap = G.map, savedSp = G.playerSp, savedAiSp = G.aiSp
  const savedNum = G.numPlayers, savedAi2 = G.ai2Sp, savedAi3 = G.ai3Sp
  Object.assign(G,{pieces:[],mceGame:null,turn:'player',aiThinking:false,aiTimer:null,selR:null,selC:null,
    legalMoves:[],legalAttacks:[],capturedByPlayer:[],capturedByAi:[],history:[],trollWounded:{},
    playerDraft:[],aiDraft:[],ai2Draft:[],ai3Draft:[]})
  Object.assign(PL,{selectedTrayIdx:null,placedSquares:{},placementPieces:[],spawnRows:[]})
  G.map = savedMap; G.playerSp = savedSp; G.aiSp = savedAiSp
  G.numPlayers = savedNum; G.ai2Sp = savedAi2; G.ai3Sp = savedAi3
  unlockTileSize(); invalidateStaticBoard()
  show('draft')
}

document.getElementById('rematch-same-btn').onclick = ()=>{
  if(G.aiTimer)clearTimeout(G.aiTimer)
  G_undoStack.length = 0; G_lastMove = null
  const savedDraft = [...G.playerDraft], savedAiDraft = [...G.aiDraft]
  const savedAi2Draft = G.ai2Draft ? [...G.ai2Draft] : []
  const savedAi3Draft = G.ai3Draft ? [...G.ai3Draft] : []
  Object.assign(G,{pieces:[],mceGame:null,turn:'player',aiThinking:false,aiTimer:null,selR:null,selC:null,
    legalMoves:[],legalAttacks:[],capturedByPlayer:[],capturedByAi:[],history:[],trollWounded:{}})
  Object.assign(PL,{selectedTrayIdx:null,placedSquares:{},placementPieces:[],spawnRows:[]})
  G.playerDraft = savedDraft; G.aiDraft = savedAiDraft
  G.ai2Draft = savedAi2Draft; G.ai3Draft = savedAi3Draft
  unlockTileSize(); invalidateStaticBoard()
  show('place')
}

// ═══════════════════════════════════════════════════════════
// RULES SCREEN
// ═══════════════════════════════════════════════════════════
let rulesReturnScreen = 'home'

document.getElementById('btn-rules').onclick = () => { rulesReturnScreen = 'home'; show('rules') }
document.getElementById('battle-rules-btn').onclick = () => { rulesReturnScreen = 'battle'; show('rules') }
document.getElementById('rules-back').onclick = () => show(rulesReturnScreen)

function renderRulesUnitTable() {
  const container = document.getElementById('rules-unit-table')
  if (!container) return

  const UNIT_ABILITIES = {
    hero: null,
    stronghold: null,
    knight_h: null,
    archer: 'Piercing: attacks through 1 piece',
    wizard: 'Split: moves as Rook, attacks all directions',
    princess: 'Mobile: diagonal slide for repositioning (no capture)',
    skeleton: 'Fragile: any adjacent enemy can capture it',
    tomb: 'Phase fire: rook attacks pass through 1 friendly piece',
    reaper: 'Water-walk: can land on water squares',
    wraith: 'Phase: slides through friendly pieces',
    vampire: 'Split: moves as Bishop, attacks all directions',
    warlock: 'Ranged: attacks at distance via diagonal slide',
    kobold: 'Cannon: ranged orthogonal attack over a screen',
    iron_golem: 'Cannon + Cannon-proof: immune to enemy cannons',
    salamander: 'Hit-and-run: move 1 extra square after capturing',
    fire_elem: 'Water weakness: water blocks slide entirely',
    demonics: 'Volatile: explodes on death, destroying adjacent enemies',
    red_dragon: 'Ranged: attacks via L-shaped knight leap',
    goblin: 'Cannon: ranged orthogonal attack over a screen',
    ogre: 'Cannon + Intimidate: adjacent enemy Pawns cannot attack',
    orc: 'Flexible: can also move 2 squares orthogonally',
    troll: 'Thick-skinned: survives first capture (pushed back)',
    shaman: 'Hex: once per game, immobilise 1 visible enemy for 2 turns',
    warlord: 'Ranged: attacks via L-shaped knight leap',
  }

  const factions = [
    { sp: SP.H, label: 'Humans', css: 'human' },
    { sp: SP.U, label: 'Undead', css: 'undead' },
    { sp: SP.R, label: 'Redskins', css: 'redskin' },
    { sp: SP.G, label: 'Greenskins', css: 'greenskin' },
  ]

  let html = ''
  factions.forEach(f => {
    html += `<div class="rules-faction-group">`
    html += `<h4 class="rules-faction-title rules-faction-title--${f.css}">${SP_INFO[f.sp].emoji} ${f.label}</h4>`
    html += `<table class="rules-unit-table"><thead><tr><th>Unit</th><th>Role</th><th>Cost</th><th>Ability</th></tr></thead><tbody>`
    SP_UNITS[f.sp].forEach(key => {
      const u = UNITS[key]
      const ability = UNIT_ABILITIES[key] || '—'
      html += `<tr>`
      html += `<td class="rules-unit-name">${u.name}</td>`
      html += `<td>${u.type}</td>`
      html += `<td class="rules-unit-cost">${u.cost} XP</td>`
      html += `<td class="rules-unit-ability">${ability}</td>`
      html += `</tr>`
    })
    html += `</tbody></table></div>`
  })

  container.innerHTML = html
}

// ═══════════════════════════════════════════════════════════
// REPLAY CONTROLS
// ═══════════════════════════════════════════════════════════
document.getElementById('replay-btn').onclick = () => rpStart()
document.getElementById('rp-start').onclick = () => rpGoToStart()
document.getElementById('rp-back').onclick = () => rpStepBack()
document.getElementById('rp-fwd').onclick = () => rpStepForward()
document.getElementById('rp-end').onclick = () => rpGoToEnd()
document.getElementById('rp-play').onclick = () => rpTogglePlay()
document.getElementById('rp-exit').onclick = () => { rpPause(); show('end') }

// ═══════════════════════════════════════════════════════════
// ACCESSIBILITY INIT
// ═══════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  kbInit()
  kbEnsureLiveRegion()
  ttInit()
})
