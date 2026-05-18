'use strict'
// ═══════════════════════════════════════════════════════════
// BATTLE SETUP
// ═══════════════════════════════════════════════════════════
document.getElementById('begin-btn').onclick = () => {
  G.playerDraft = [...draftList]
  G.aiDraft = buildAiDraft(G.aiSp)
  if (G.numPlayers === 4) {
    G.ai2Draft = buildAiDraft(G.ai2Sp)
    G.ai3Draft = buildAiDraft(G.ai3Sp)
  } else {
    G.ai2Draft = []; G.ai3Draft = []
  }
  show('place')
}

function placeAiPiecesColumn(draft, owner, fromLeft) {
  if (!draft || !draft.length) return
  const { grid, rows, cols } = G.map
  const playCols = r => grid[r].map((_,c)=>c).filter(c=>grid[r][c]!==null&&grid[r][c]!=='w')

  // Gather cells in the side section only
  const leftMaxC = 6, rightMinC = cols - 6
  const sectionCells = []
  for (let r=0;r<rows;r++) {
    const cs = playCols(r)
    const filtered = fromLeft ? cs.filter(c=>c<leftMaxC) : cs.filter(c=>c>=rightMinC)
    filtered.forEach(c=>sectionCells.push({r,c}))
  }
  if (!sectionCells.length) return

  // Group by column, sorted outermost first
  const colGroups = {}
  sectionCells.forEach(({r,c})=>{if(!colGroups[c])colGroups[c]=[];colGroups[c].push(r)})
  const sortedCols = Object.keys(colGroups).map(Number).sort((a,b)=>fromLeft?a-b:b-a)

  // Separate drafted pawns from non-pawns
  const pawns    = draft.filter(k=>UNITS[k].type===PT.P)
  const nonPawns = draft.filter(k=>UNITS[k].type!==PT.P)

  // Place non-pawn units vertically in the outermost column — one per row, only as many as drafted
  const backCol = sortedCols[0]
  if (backCol !== undefined && nonPawns.length) {
    const bRows = colGroups[backCol].sort((a,b)=>a-b)
    nonPawns.forEach((k, i) => {
      if (i >= bRows.length) return
      G.pieces.push({id: Date.now()+i|0, key:k, r:bRows[i], c:backCol, owner})
    })
  }

  // Place pawns in the next column inward — one per row, only as many as drafted
  const pawnCol = sortedCols[1]
  if (pawnCol !== undefined && pawns.length) {
    const pRows = colGroups[pawnCol].sort((a,b)=>a-b)
    pawns.forEach((k, i) => {
      if (i >= pRows.length) return
      G.pieces.push({id: Date.now()+100+i|0, key:k, r:pRows[i], c:pawnCol, owner})
    })
  }
}

function buildStarting() {
  const pieces=[]; let id=0
  const { grid, rows, cols } = G.map
  const playCols = r => grid[r].map((_,c)=>c).filter(c=>grid[r][c]!==null)
  const BACK = [PT.C,PT.N,PT.B,PT.Q,PT.K,PT.B,PT.N,PT.C]
  const pickUnit=(draft,type,used)=>draft.find(k=>UNITS[k].type===type&&!used.has(k))

  const placeRank = (draft, row, isPawn, owner) => {
    const cs = playCols(row).slice(0,8)
    if (isPawn) {
      cs.forEach(c=>{ const k=draft.find(k=>UNITS[k].type===PT.P); if(k) pieces.push({id:id++,key:k,r:row,c,owner}) })
    } else {
      const used=new Set()
      BACK.forEach((type,i)=>{ if(i>=cs.length) return; const k=pickUnit(draft,type,used); if(k){used.add(k);pieces.push({id:id++,key:k,r:row,c:cs[i],owner})} })
    }
  }

  if (G.numPlayers === 4) {
    const zoneRows = (fromTop, n=2) => {
      const valid=[]
      if (fromTop) { for(let r=0;r<rows;r++){ if(playCols(r).length>=4) valid.push(r); if(valid.length>=n) break } }
      else         { for(let r=rows-1;r>=0;r--){ if(playCols(r).length>=4) valid.push(r); if(valid.length>=n) break } }
      return valid
    }
    const topZ = zoneRows(true), botZ = zoneRows(false)
    // Left/right: find rows in the left/right connector sections
    // Left/right rows unused — placeColumn handles everything

    if(botZ[0]!==undefined) placeRank(G.playerDraft, botZ[0], false, 'player')
    if(botZ[1]!==undefined) placeRank(G.playerDraft, botZ[1], true,  'player')
    if(topZ[0]!==undefined) placeRank(G.aiDraft,     topZ[0], false, 'ai')
    if(topZ[1]!==undefined) placeRank(G.aiDraft,     topZ[1], true,  'ai')

    // Left player (ai2): back column = leftmost available col, pawns in next col
    // Right player (ai3): back column = rightmost available col, pawns in next col inward
    // Find the left section rows — middle rows that have cells in col 0-2
    // Left section: cols 0-5 (cols 0-2 = main section, 3-5 = connector)
    // Right section: cols 14-19 (14-17 = connector, 17-19 = main section)
    const leftMaxC  = 6   // exclusive — left section is cols < 6
    const rightMinC = cols - 6  // right section is cols >= rightMinC

    const placeColumn = (draft, owner, fromLeft) => {
      const sectionCells = []
      for(let r=0;r<rows;r++){
        const cs = playCols(r)
        if(!cs.length) continue
        const filtered = fromLeft
          ? cs.filter(c => c < leftMaxC)
          : cs.filter(c => c >= rightMinC)
        filtered.forEach(c => sectionCells.push({r,c}))
      }
      if(!sectionCells.length) return
      // Sort by column: back rank = outermost col (leftmost for left, rightmost for right)
      const colGroups = {}
      sectionCells.forEach(({r,c})=>{ if(!colGroups[c]) colGroups[c]=[]; colGroups[c].push(r) })
      const sortedCols = Object.keys(colGroups).map(Number).sort((a,b)=>fromLeft?a-b:b-a)
      const backCol = sortedCols[0]
      const pawnCol = sortedCols[1]
      // Place back rank vertically in backCol
      if(backCol!==undefined){
        const rows2 = colGroups[backCol].sort((a,b)=>a-b)
        const used=new Set()
        rows2.slice(0,8).forEach((r,i)=>{
          const type=BACK[i]||PT.P
          const k=pickUnit(draft,type,used)||draft.find(k=>UNITS[k].type===PT.P&&!used.has(k))
          if(k){used.add(k);pieces.push({id:id++,key:k,r,c:backCol,owner})}
        })
      }
      // Place pawns in pawnCol
      if(pawnCol!==undefined){
        colGroups[pawnCol].sort((a,b)=>a-b).forEach(r=>{
          const k=draft.find(k=>UNITS[k].type===PT.P)
          if(k) pieces.push({id:id++,key:k,r,c:pawnCol,owner})
        })
      }
    }
    if(G.ai2Draft.length) placeColumn(G.ai2Draft, 'ai2', true)
    if(G.ai3Draft.length) placeColumn(G.ai3Draft, 'ai3', false)
  } else {
    const validRows=[]
    for(let r=0;r<rows;r++){ if(playCols(r).length>=4) validRows.push(r) }
    const topRows=validRows.slice(0,2), botRows=validRows.slice(-2).reverse()
    if(botRows[0]!==undefined) placeRank(G.playerDraft, botRows[0], false, 'player')
    if(botRows[1]!==undefined) placeRank(G.playerDraft, botRows[1], true,  'player')
    if(topRows[0]!==undefined) placeRank(G.aiDraft,     topRows[0], false, 'ai')
    if(topRows[1]!==undefined) placeRank(G.aiDraft,     topRows[1], true,  'ai')
  }
  return pieces
}

