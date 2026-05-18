'use strict'
// ═══════════════════════════════════════════════════════════
// MOVEMENT ENGINE
// ═══════════════════════════════════════════════════════════
function getLegal(piece) {
  const {key,r:row,c:col,owner}=piece
  const def=UNITS[key]
  const moves=[],attacks=[]
  const {grid,rows,cols}=G.map

  const RD=[[0,1],[0,-1],[1,0],[-1,0]]
  const BD=[[1,1],[1,-1],[-1,1],[-1,-1]]
  const AD=[...RD,...BD]

  const onBoard=(r,c)=>r>=0&&r<rows&&c>=0&&c<cols
  const cell=(r,c)=>grid[r]?.[c]
  const isVoid=(r,c)=>cell(r,c)===null||cell(r,c)===undefined
  const isWater=(r,c)=>cell(r,c)==='w'
  const pieceAt=(r,c)=>G.pieces.find(p=>p.r===r&&p.c===c)
  const friendly=(r,c)=>{const p=pieceAt(r,c);return p&&p.owner===owner}
  const enemy=(r,c)=>{const p=pieceAt(r,c);return p&&p.owner!==owner}

  function slide(dirs,jump=false,waterBlock=false,moveOnly=false,atkOnly=false){
    dirs.forEach(([dr,dc])=>{
      let r=row+dr,c=col+dc,gapped=false
      while(onBoard(r,c)&&!isVoid(r,c)){
        if(isWater(r,c)){if(waterBlock)break;r+=dr;c+=dc;continue}
        const occ=pieceAt(r,c)
        if(occ){
          if(!gapped||jump){if(occ.owner!==owner&&!moveOnly)attacks.push([r,c])}
          if(!jump)break;gapped=true
        } else {if(!gapped&&!atkOnly)moves.push([r,c])}
        r+=dr;c+=dc
      }
    })
  }

  function cannon(dirs){
    dirs.forEach(([dr,dc])=>{
      let r=row+dr,c=col+dc,screen=false
      while(onBoard(r,c)&&!isVoid(r,c)){
        const occ=pieceAt(r,c)
        if(!screen){if(occ)screen=true;else if(!isWater(r,c))moves.push([r,c])}
        else{if(occ){if(occ.owner!==owner)attacks.push([r,c]);break}}
        r+=dr;c+=dc
      }
    })
  }

  function knightJumps(){
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>{
      const r=row+dr,c=col+dc
      if(!onBoard(r,c)||isVoid(r,c)||friendly(r,c))return
      if(enemy(r,c))attacks.push([r,c]);else moves.push([r,c])
    })
  }

  switch(def.type){
    case PT.P:
      AD.forEach(([dr,dc])=>{
        const r=row+dr,c=col+dc
        if(!onBoard(r,c)||isVoid(r,c)||isWater(r,c))return
        const occ=pieceAt(r,c)
        if(!occ)moves.push([r,c])
        else if(occ.owner!==owner&&Math.abs(dr)+Math.abs(dc)===2)attacks.push([r,c])
      })
      if(def.cannon==='pawn')cannon(RD)
      break
    case PT.C:
      if(def.cannon==='castle'){
        RD.forEach(([dr,dc])=>{const r=row+dr,c=col+dc;if(!onBoard(r,c)||isVoid(r,c)||isWater(r,c)||friendly(r,c))return;if(enemy(r,c))attacks.push([r,c]);else moves.push([r,c])})
        cannon(RD)
      } else {
        RD.forEach(([dr,dc])=>{const r=row+dr,c=col+dc;if(!onBoard(r,c)||isVoid(r,c)||isWater(r,c)||friendly(r,c))return;if(enemy(r,c))attacks.push([r,c]);else moves.push([r,c])})
        slide(RD,false,false,false,true)
      }
      break
    case PT.N: knightJumps(); break
    case PT.B:
      if(key==='archer'){slide(BD,false,false,true);slide(BD,true,false,false,true)}
      else if(key==='wraith'){slide(BD,true,false,true);slide(BD,false,false,false,true)}
      else slide(BD,false,['fire_elem','troll'].includes(key))
      break
    case PT.Q:
      if(key==='wizard'){slide(RD);slide(BD,false,false,false,true)}
      else if(key==='vampire'){slide(BD);slide(RD,false,false,false,true)}
      else slide(AD,false,['demonics','shaman'].includes(key))
      break
    case PT.K:
      AD.forEach(([dr,dc])=>{const r=row+dr,c=col+dc;if(!onBoard(r,c)||isVoid(r,c)||isWater(r,c)||friendly(r,c))return;if(enemy(r,c))attacks.push([r,c]);else moves.push([r,c])})
      if(key==='princess')slide(BD,false,false,true)
      if(key==='warlock')slide(BD,false,false,false,true)
      if(['red_dragon','warlord'].includes(key)){
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>{
          const r=row+dr,c=col+dc;if(onBoard(r,c)&&!isVoid(r,c)&&enemy(r,c))attacks.push([r,c])
        })
      }
      break
  }

  const dedup=arr=>[...new Map(arr.map(([r,c])=>[`${r},${c}`,[r,c]])).values()].filter(([r,c])=>!friendly(r,c))
  return{moves:dedup(moves),attacks:dedup(attacks)}
}

function wouldLeaveInCheck(piece, tr, tc) {
  // Simulate the move and check if own king is still in check
  const saved = {r:piece.r, c:piece.c}
  const captured = G.pieces.find(p=>p.r===tr&&p.c===tc&&p.owner!==piece.owner)
  const captIdx = captured ? G.pieces.indexOf(captured) : -1
  if (captured) G.pieces.splice(captIdx, 1)
  piece.r=tr; piece.c=tc
  const inCheck = isInCheck(piece.owner)
  piece.r=saved.r; piece.c=saved.c
  if (captured) G.pieces.splice(captIdx, 0, captured)
  return inCheck
}

function isInCheck(owner) {
  const king = G.pieces.find(p=>p.owner===owner && UNITS[p.key].type===PT.K)
  if (!king) return false
  const opponents = G.pieces.filter(p=>p.owner!==owner)
  return opponents.some(opp => {
    const {attacks} = getLegal(opp)
    return attacks.some(([r,c])=>r===king.r && c===king.c)
  })
}
