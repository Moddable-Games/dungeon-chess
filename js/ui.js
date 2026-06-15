import { TILE, computeTile, DATA_READY, MAPS, UNITS, SP, SP_INFO, SP_UNITS, PT, FEN_CH } from './data.js'
import { G, show, draftList, buildAiDraft, registerScreenHook } from './state.js'
import { DungeonMCE } from './mce-bridge.js'
import MCE from '../lib/mce/chess-engine.js'
import { svgEl, getDCRenderOpts } from './board-renderer.js'
import { drawDungeonSurround } from './dungeon-surround.js'
import { startLightAnimation, renderAtmosphereCanvas } from './atmosphere.js'
import { PL, autoPlace, renderTray, renderPlacementBoard, updatePlaceHint, invalidatePlacementStatic } from './screens.js'
import { getController, createBattleController, destroyBattleController, lockTileSize, unlockTileSize, updateUI, endGame, addLog } from './battle-draw.js'
import { rpSaveInitial, rpStart, rpGoToStart, rpStepBack, rpStepForward, rpGoToEnd, rpTogglePlay, rpPause } from './replay.js'
import { kbInit } from './keyboard.js'
import { kbEnsureLiveRegion } from './aria.js'
import { ttInit } from './tooltip.js'
import './battle.js'

registerScreenHook('rules', () => renderRulesUnitTable())
registerScreenHook('battle', () => ttInit())

// ═══════════════════════════════════════════════════════════
// BUTTON WIRING
// ═══════════════════════════════════════════════════════════
document.getElementById('confirm-place-btn').onclick = () => {
  // Build initial pieces from placement — AI pieces already in G.pieces, add player
  const initPieces = [...G.pieces]
  let id = Math.max(...initPieces.map(p=>p.id), 0) + 1
  Object.entries(PL.placedSquares).forEach(([sqKey, {key}]) => {
    const [r, c] = sqKey.split(',').map(Number)
    initPieces.push({ id: id++, key, r, c, owner: 'player' })
  })
  G.capturedByPlayer=[]; G.capturedByAi=[]; G.history=[]
  const orderVal = document.querySelector('[name="turn-order"]:checked').value
  const firstTurn = orderVal === 'random'
    ? (Math.random() < 0.5 ? 'player' : 'ai') : orderVal
  G.turn = firstTurn; G.aiThinking = false; G.selR=null; G.selC=null
  G.legalMoves=[]; G.legalAttacks=[]
  DungeonMCE.registerAllUnits()
  const players = G.numPlayers === 4 ? ['player','ai','ai2','ai3'] : ['player','ai']
  G.mceGame = DungeonMCE.createDungeonGame(G.map, initPieces, players)
  G.mceGame.turn = firstTurn
  G.mceGame.turnIndex = G.mceGame.players.indexOf(firstTurn)
  rpSaveInitial()
  show('battle')
  lockTileSize()
  const bCanvas2 = document.getElementById('dungeon-canvas')
  if (bCanvas2 && G.map) drawDungeonSurround(bCanvas2, G.map)
  const bLights2 = document.getElementById('dungeon-lights')
  if (bLights2 && G.map) startLightAnimation(bLights2, G.map, TILE*2.2)
  createBattleController()
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

document.getElementById('btn-play').onclick       = async ()=>{ await DATA_READY; show('players') }
document.getElementById('btn-play-bottom').onclick = async ()=>{ await DATA_READY; show('players') }
document.getElementById('players-back').onclick   = ()=>show('home')
document.getElementById('pick-2p').onclick        = ()=>{ G.numPlayers=2; show('map') }
document.getElementById('pick-4p').onclick        = ()=>{ G.numPlayers=4; G.map=MAPS[2]; show('species') }
document.getElementById('map-back').onclick       = ()=>show('home')
document.getElementById('species-back').onclick   = ()=>show('map')
document.getElementById('draft-back').onclick     = ()=>show('species')
document.getElementById('forfeit-btn').onclick = () => {
  if (!confirm('Are you sure you want to forfeit?')) return
  if (getController()) getController().forfeit()
  const aiOwners = G.numPlayers===4 ? ['ai','ai2','ai3'] : ['ai']
  const winner = aiOwners.reduce((best,o) =>
    DungeonMCE.countPieces(G.mceGame,o) > DungeonMCE.countPieces(G.mceGame,best) ? o : best
  , aiOwners[0])
  endGame(winner)
}
document.getElementById('undo-btn').onclick = () => {
  if (!getController() || G.turn !== 'player') return
  getController().undo()
  G.turn = G.mceGame.turn
  G.capturedByPlayer.pop()
  G.capturedByAi.pop()
  G.history.pop(); G.history.pop()
  G_lastMove = null
  const el = document.getElementById('h-list')
  el.innerHTML = ''
  G.history.forEach(text => { const d = document.createElement('div'); d.className='h-entry'; d.textContent=text; el.insertBefore(d, el.firstChild) })
  if (getController()) getController().render()
  updateUI()
}

document.getElementById('play-again-btn').onclick = ()=>{
  destroyBattleController()
  G_lastMove = null
  Object.assign(G,{numPlayers:2,playerSp:null,aiSp:null,ai2Sp:null,ai3Sp:null,playerDraft:[],aiDraft:[],ai2Draft:[],ai3Draft:[],map:null,pieces:[],mceGame:null,
    turn:'player',aiThinking:false,aiTimer:null,selR:null,selC:null,
    legalMoves:[],legalAttacks:[],capturedByPlayer:[],capturedByAi:[],history:[]})
  Object.assign(PL,{selectedTrayIdx:null,placedSquares:{},placementPieces:[],spawnRows:[]})
  unlockTileSize()
  show('home')
}

document.getElementById('rematch-btn').onclick = ()=>{
  destroyBattleController()
  G_lastMove = null
  const savedMap = G.map, savedSp = G.playerSp, savedAiSp = G.aiSp
  const savedNum = G.numPlayers, savedAi2 = G.ai2Sp, savedAi3 = G.ai3Sp
  Object.assign(G,{pieces:[],mceGame:null,turn:'player',aiThinking:false,aiTimer:null,selR:null,selC:null,
    legalMoves:[],legalAttacks:[],capturedByPlayer:[],capturedByAi:[],history:[],
    playerDraft:[],aiDraft:[],ai2Draft:[],ai3Draft:[]})
  Object.assign(PL,{selectedTrayIdx:null,placedSquares:{},placementPieces:[],spawnRows:[]})
  G.map = savedMap; G.playerSp = savedSp; G.aiSp = savedAiSp
  G.numPlayers = savedNum; G.ai2Sp = savedAi2; G.ai3Sp = savedAi3
  unlockTileSize()
  show('draft')
}

document.getElementById('rematch-same-btn').onclick = ()=>{
  destroyBattleController()
  G_lastMove = null
  const savedDraft = [...G.playerDraft], savedAiDraft = [...G.aiDraft]
  const savedAi2Draft = G.ai2Draft ? [...G.ai2Draft] : []
  const savedAi3Draft = G.ai3Draft ? [...G.ai3Draft] : []
  Object.assign(G,{pieces:[],mceGame:null,turn:'player',aiThinking:false,aiTimer:null,selR:null,selC:null,
    legalMoves:[],legalAttacks:[],capturedByPlayer:[],capturedByAi:[],history:[]})
  Object.assign(PL,{selectedTrayIdx:null,placedSquares:{},placementPieces:[],spawnRows:[]})
  G.playerDraft = savedDraft; G.aiDraft = savedAiDraft
  G.ai2Draft = savedAi2Draft; G.ai3Draft = savedAi3Draft
  unlockTileSize()
  show('place')
}

// ═══════════════════════════════════════════════════════════
// PIECE STYLE TOGGLE
// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.piece-style-toggle').forEach(toggle => {
  toggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.pst-btn')
    if (!btn) return
    const style = btn.dataset.style
    G.pieceStyle = style
    document.querySelectorAll('.pst-btn').forEach(b => b.classList.toggle('active', b.dataset.style === style))
    invalidatePlacementStatic()
    if (getController()) getController().render()
  })
})

// ═══════════════════════════════════════════════════════════
// RULES SCREEN
// ═══════════════════════════════════════════════════════════
let rulesReturnScreen = 'home'

document.getElementById('btn-rules').onclick = async () => { await DATA_READY; rulesReturnScreen = 'home'; show('rules') }
document.getElementById('battle-rules-btn').onclick = () => { rulesReturnScreen = 'battle'; show('rules') }
document.getElementById('rules-back').onclick = () => show(rulesReturnScreen)

export function renderRulesUnitTable() {
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
