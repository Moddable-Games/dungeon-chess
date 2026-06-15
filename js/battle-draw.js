import { TILE, UNITS, PT, SP_INFO } from './data.js'
import { G, show } from './state.js'
import MCE from '../lib/mce/chess-engine.js'
import '../lib/mce/chess-play.js'
import '../lib/mce/board-renderer.js'
import '../lib/mce/game-controller-core.js'
import '../lib/mce/chess-ai.js'
import { DungeonMCE } from './mce-bridge.js'
import { getDCRenderOpts } from './board-renderer.js'
import { getLegal, wouldLeaveInCheck, isInCheck } from './engine.js'
import { kbAnnounce } from './aria.js'

let G_lastMove = null
let G_controller = null
export function getController() { return G_controller }
export function clearLastMove() { G_lastMove = null }

let _lastTile = null
let _tileLocked = false
export function lockTileSize() { _tileLocked = true }
export function unlockTileSize() { _tileLocked = false }

// ═══════════════════════════════════════════════════════════
// GAME CONTROLLER SETUP — MCE.renderBoard with DC hooks
// ═══════════════════════════════════════════════════════════
let _dcOpts = null

export function createBattleController() {
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

export function destroyBattleController() {
  if (G_controller) {
    G_controller.destroy()
    G_controller = null
  }
  _dcOpts = null
}

export function updateUI() {
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
  if (inCheck) kbAnnounce('Warning: your king is in check!')
  else if (G.turn === 'player' && !G.aiThinking) kbAnnounce('Your turn')
  const pi2=SP_INFO[G.playerSp], ai2i=SP_INFO[G.aiSp]
  document.getElementById('p-label').textContent=`${pi2.emoji} YOU`
  document.getElementById('a-label').textContent=`${ai2i.emoji} AI${G.numPlayers===4?' 1':''}`
  document.getElementById('p-pieces').textContent=`Pieces: ${G.mceGame ? DungeonMCE.countPieces(G.mceGame,'player') : 0}`
  document.getElementById('a-pieces').textContent=`Pieces: ${G.mceGame ? DungeonMCE.countPieces(G.mceGame,'ai') : 0}${
    G.numPlayers===4 && G.ai2Sp && G.mceGame ? ` | ${SP_INFO[G.ai2Sp].emoji}${DungeonMCE.countPieces(G.mceGame,'ai2')} | ${SP_INFO[G.ai3Sp].emoji}${DungeonMCE.countPieces(G.mceGame,'ai3')}`:''}`
  document.getElementById('p-cap').textContent=G.capturedByPlayer.length
    ?'Cap: '+G.capturedByPlayer.map(k=>UNITS[k].name).join(', ')
    :'Captured: none'
  document.getElementById('a-cap').textContent=G.capturedByAi.length
    ?'Lost: '+G.capturedByAi.map(k=>UNITS[k].name).join(', ')
    :'Lost: none'
}

export function showSelected(p){
  const d=UNITS[p.key]
  const {moves,attacks}=getLegal(p)
  const safeMoves=moves.filter(([tr,tc])=>!wouldLeaveInCheck(p,tr,tc))
  const safeAttacks=attacks.filter(([tr,tc])=>!wouldLeaveInCheck(p,tr,tc))
  let hexBtn = ''
  if (p.key === 'shaman' && p.owner === 'player') {
    const shamanSq = MCE.sq(p.r, p.c, G.mceGame)
    const shamanPd = G.mceGame && G.mceGame.pieceData[shamanSq]
    if (shamanPd && !shamanPd.hexUsed) {
      hexBtn = `<button class="btn sm btn-hex" onclick="playerHex(${shamanSq})">⚡ HEX</button>`
    }
  }
  document.getElementById('sel-info').innerHTML=
    `<div class="sel-name">${d.name}</div>
     <div class="sel-meta">${d.type} · ${d.cost}XP</div>
     <div class="sel-meta sel-meta--moves">${safeMoves.length} moves</div>
     <div class="sel-meta sel-meta--attacks">${safeAttacks.length} attacks</div>
     ${hexBtn}`
}

export function playerHex(shamanSq) {
  G.hexTargeting = { sq: shamanSq }
  G.legalMoves = []
  G.legalAttacks = DungeonMCE.allPieces(G.mceGame)
    .filter(p => p.owner !== 'player')
    .map(p => [p.r, p.c])
  document.getElementById('sel-info').innerHTML =
    `<div class="sel-name">Hex Target</div>
     <div class="sel-meta">Click an enemy to immobilise for 2 turns</div>
     <button class="btn sm" onclick="cancelHex()">Cancel</button>`
  if (G_controller) G_controller.render()
}

export function cancelHex() {
  G.hexTargeting = null
  G.selR = null; G.selC = null; G.legalMoves = []; G.legalAttacks = []
  document.getElementById('sel-info').innerHTML = '<span class="sel-info">Click a piece</span>'
  if (G_controller) G_controller.render()
}

export function addLog(text){
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
export function endGame(winner){
  destroyBattleController()
  G.aiThinking=false
  kbAnnounce(winner === 'player' ? 'Victory! You won the battle.' : 'Defeat. The enemy has conquered.')
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
  const survivors = G.mceGame ? DungeonMCE.allPieces(G.mceGame).filter(p => p.owner === 'player') : []
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
