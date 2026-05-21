'use strict'

// ═══════════════════════════════════════════════════════════
// INLINE PIECE SPRITES — Cburnett set (CC BY-SA 3.0)
// Same pieces used by Wikipedia, Lichess, and cm-chessboard's
// "standard.svg" set. Inlined here so no CDN fetch is needed.
// Each symbol uses viewBox="0 0 45 45".
// ═══════════════════════════════════════════════════════════
let TILE = 56  // px per square — recomputed dynamically

const SIDE_W = 148   // meta column width px
const TILE_MIN = 24, TILE_MAX = 62

function computeTile(map) {
  const sidePad = (SIDE_W + 12) * 2 + 40  // 2 cols + gaps + screen padding
  const WALL = 2.2
  const avW = Math.max(200, window.innerWidth - sidePad)
  // Only constrain by width — let the page scroll vertically if needed
  const tileFromW = Math.floor(avW / (map.cols + WALL*2))
  TILE = Math.max(TILE_MIN, Math.min(TILE_MAX, tileFromW))
}

// Piece letter → sprite id suffix
const PIECE_TO_SPRITE = { p:'p', r:'r', n:'n', b:'b', q:'q', k:'k' }

// All 12 piece symbols as inline SVG strings (id = piece-wp, piece-bp, etc.)
const PIECE_SYMBOLS = {
'wp': `<symbol id="piece-wp" viewBox="0 0 45 45"><path d="M 22,9 C 19.79,9 18,10.79 18,13 C 18,13.89 18.29,14.71 18.78,15.38 C 16.83,16.5 15.5,18.59 15.5,21 C 15.5,23.03 16.44,24.84 17.91,26.03 C 14.91,27.09 10.5,31.58 10.5,39.5 L 33.5,39.5 C 33.5,31.58 29.09,27.09 26.09,26.03 C 27.56,24.84 28.5,23.03 28.5,21 C 28.5,18.59 27.17,16.5 25.22,15.38 C 25.71,14.71 26,13.89 26,13 C 26,10.79 24.21,9 22,9 z" style="fill:#fff;stroke:#000;stroke-width:1.5;stroke-linecap:round"/></symbol>`,
'bp': `<symbol id="piece-bp" viewBox="0 0 45 45"><path d="M 22,9 C 19.79,9 18,10.79 18,13 C 18,13.89 18.29,14.71 18.78,15.38 C 16.83,16.5 15.5,18.59 15.5,21 C 15.5,23.03 16.44,24.84 17.91,26.03 C 14.91,27.09 10.5,31.58 10.5,39.5 L 33.5,39.5 C 33.5,31.58 29.09,27.09 26.09,26.03 C 27.56,24.84 28.5,23.03 28.5,21 C 28.5,18.59 27.17,16.5 25.22,15.38 C 25.71,14.71 26,13.89 26,13 C 26,10.79 24.21,9 22,9 z" style="fill:#000;stroke:#000;stroke-width:1.5;stroke-linecap:round"/></symbol>`,
'wr': `<symbol id="piece-wr" viewBox="0 0 45 45"><g style="opacity:1;fill:#fff;fill-opacity:1;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z"/><path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z"/><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14"/><path d="M 34,14 L 31,17 L 14,17 L 11,14"/><path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17"/><path d="M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5"/><path d="M 11,14 L 34,14" style="fill:none"/></g></symbol>`,
'br': `<symbol id="piece-br" viewBox="0 0 45 45"><g style="opacity:1;fill:#000;fill-opacity:1;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" style="stroke-linecap:butt"/><path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" style="stroke-linecap:butt"/><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" style="stroke-linecap:butt"/><path d="M 34,14 L 31,17 L 14,17 L 11,14"/><path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17"/><path d="M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5"/><path d="M 11,14 L 34,14" style="fill:none;stroke:#fff;stroke-linejoin:miter"/><path d="M 12,35.5 L 33,35.5" style="fill:none;stroke:#fff;stroke-width:1;stroke-linejoin:miter"/><path d="M 13,31.5 L 32,31.5" style="fill:none;stroke:#fff;stroke-width:1;stroke-linejoin:miter"/><path d="M 14,29.5 L 31,29.5" style="fill:none;stroke:#fff;stroke-width:1;stroke-linejoin:miter"/></g></symbol>`,
'wn': `<symbol id="piece-wn" viewBox="0 0 45 45"><g style="opacity:1;fill:none;fill-opacity:1;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#fff;stroke:#000"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:#fff;stroke:#000"/><path d="M 9.5,25.5 A 0.5,0.5 0 1 1 8.5,25.5 A 0.5,0.5 0 1 1 9.5,25.5 z" style="fill:#000;stroke:#000"/><path d="M 15,15.5 A 0.5,1.5 0 1 1 14,15.5 A 0.5,1.5 0 1 1 15,15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#000;stroke:#000"/></g></symbol>`,
'bn': `<symbol id="piece-bn" viewBox="0 0 45 45"><g style="opacity:1;fill:none;fill-opacity:1;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#000;stroke:#000"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:#000;stroke:#000"/><path d="M 9.5,25.5 A 0.5,0.5 0 1 1 8.5,25.5 A 0.5,0.5 0 1 1 9.5,25.5 z" style="fill:#fff;stroke:#fff"/><path d="M 15,15.5 A 0.5,1.5 0 1 1 14,15.5 A 0.5,1.5 0 1 1 15,15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#fff;stroke:#fff"/><path d="M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z" style="fill:#fff;stroke:none"/></g></symbol>`,
'wb': `<symbol id="piece-wb" viewBox="0 0 45 45"><g style="opacity:1;fill:none;fill-rule:evenodd;fill-opacity:1;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><g style="fill:#fff;stroke:#000;stroke-linecap:butt"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.2,38.91 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.8,38.91 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z"/><path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"/><path d="M 25,8 A 2.5,2.5 0 1 1 20,8 A 2.5,2.5 0 1 1 25,8 z"/></g><path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" style="fill:none;stroke:#000;stroke-linejoin:miter"/></g></symbol>`,
'bb': `<symbol id="piece-bb" viewBox="0 0 45 45"><g style="opacity:1;fill:none;fill-rule:evenodd;fill-opacity:1;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><g style="fill:#000;stroke:#000;stroke-linecap:butt"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.2,38.91 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.8,38.91 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z"/><path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"/><path d="M 25,8 A 2.5,2.5 0 1 1 20,8 A 2.5,2.5 0 1 1 25,8 z"/></g><path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" style="fill:none;stroke:#fff;stroke-linejoin:miter"/></g></symbol>`,
'wq': `<symbol id="piece-wq" viewBox="0 0 45 45"><g style="fill:#fff;stroke:#000;stroke-width:1.5;stroke-linejoin:round"><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z"/><path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11.5,38.5 11.5,38.5 C 17.5,39.5 27.5,39.5 33.5,38.5 C 33.5,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z"/><path d="M 11.5,30 C 15,29 30,29 33.5,30" style="fill:none"/><path d="M 12,33.5 C 15,32.5 30,32.5 33,33.5" style="fill:none"/><circle cx="6" cy="12" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31" cy="9" r="2"/><circle cx="39" cy="12" r="2"/></g></symbol>`,
'bq': `<symbol id="piece-bq" viewBox="0 0 45 45"><g style="fill:#000;stroke:#000;stroke-width:1.5;stroke-linejoin:round"><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z"/><path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11.5,38.5 11.5,38.5 C 17.5,39.5 27.5,39.5 33.5,38.5 C 33.5,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z"/><path d="M 11.5,30 C 15,29 30,29 33.5,30" style="fill:none;stroke:#fff"/><path d="M 12,33.5 C 15,32.5 30,32.5 33,33.5" style="fill:none;stroke:#fff"/><circle cx="6" cy="12" r="2" style="fill:#fff"/><circle cx="14" cy="9" r="2" style="fill:#fff"/><circle cx="22.5" cy="8" r="2" style="fill:#fff"/><circle cx="31" cy="9" r="2" style="fill:#fff"/><circle cx="39" cy="12" r="2" style="fill:#fff"/></g></symbol>`,
'wk': `<symbol id="piece-wk" viewBox="0 0 45 45"><g style="fill:#fff;stroke:#000;stroke-width:1.5;stroke-linejoin:round"><path d="M 22.5,11.63 L 22.5,6" style="fill:none;stroke:#000;stroke-linejoin:miter"/><path d="M 20,8 L 25,8" style="fill:none;stroke:#000;stroke-linejoin:miter"/><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25"/><path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37"/><path d="M 12.5,30 C 18,27 27,27 32.5,30"/><path d="M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5"/><path d="M 12.5,37 C 18,34 27,34 32.5,37"/></g></symbol>`,
'bk': `<symbol id="piece-bk" viewBox="0 0 45 45"><g style="fill:#000;stroke:#000;stroke-width:1.5;stroke-linejoin:round"><path d="M 22.5,11.63 L 22.5,6" style="fill:none;stroke:#fff;stroke-linejoin:miter"/><path d="M 20,8 L 25,8" style="fill:none;stroke:#fff;stroke-linejoin:miter"/><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25"/><path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37"/><path d="M 12.5,30 C 18,27 27,27 32.5,30" style="fill:none;stroke:#fff"/><path d="M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5" style="fill:none;stroke:#fff"/><path d="M 12.5,37 C 18,34 27,34 32.5,37" style="fill:none;stroke:#fff"/></g></symbol>`,
}



// ═══════════════════════════════════════════════════════════
// GAME DATA
// ═══════════════════════════════════════════════════════════
const SP = { H:'human', U:'undead', R:'redskin', G:'greenskin' }
const PT = { P:'pawn',  C:'castle', N:'knight',  B:'bishop', Q:'queen', K:'king' }
const FEN_CH = { [PT.P]:'p', [PT.C]:'r', [PT.N]:'n', [PT.B]:'b', [PT.Q]:'q', [PT.K]:'k' }

const UNITS = {
  hero:       { type:PT.P, sp:SP.H, cost:2,  name:'Hero',        cannon:null },
  stronghold: { type:PT.C, sp:SP.H, cost:10, name:'Stronghold',  cannon:null },
  knight_h:   { type:PT.N, sp:SP.H, cost:15, name:'Knight',      cannon:null },
  archer:     { type:PT.B, sp:SP.H, cost:15, name:'Archer',      cannon:null },
  wizard:     { type:PT.Q, sp:SP.H, cost:20, name:'Wizard',      cannon:null },
  princess:   { type:PT.K, sp:SP.H, cost:15, name:'Princess',    cannon:null },
  skeleton:   { type:PT.P, sp:SP.U, cost:2,  name:'Skeleton',    cannon:null },
  tomb:       { type:PT.C, sp:SP.U, cost:10, name:'Tomb',        cannon:null },
  reaper:     { type:PT.N, sp:SP.U, cost:15, name:'Reaper',      cannon:null },
  wraith:     { type:PT.B, sp:SP.U, cost:15, name:'Wraith',      cannon:null },
  vampire:    { type:PT.Q, sp:SP.U, cost:20, name:'Vampire',     cannon:null },
  warlock:    { type:PT.K, sp:SP.U, cost:20, name:'Warlock',     cannon:null },
  kobold:     { type:PT.P, sp:SP.R, cost:5,  name:'Kobold',      cannon:'pawn' },
  iron_golem: { type:PT.C, sp:SP.R, cost:15, name:'Iron Golem',  cannon:'castle' },
  salamander: { type:PT.N, sp:SP.R, cost:15, name:'Salamander',  cannon:null },
  fire_elem:  { type:PT.B, sp:SP.R, cost:15, name:'Fire Elem.',  cannon:null },
  demonics:   { type:PT.Q, sp:SP.R, cost:20, name:'Demonics',    cannon:null },
  red_dragon: { type:PT.K, sp:SP.R, cost:20, name:'Red Dragon',  cannon:null },
  goblin:     { type:PT.P, sp:SP.G, cost:5,  name:'Goblin',      cannon:'pawn' },
  ogre:       { type:PT.C, sp:SP.G, cost:15, name:'Ogre',        cannon:'castle' },
  orc:        { type:PT.N, sp:SP.G, cost:15, name:'Orc',         cannon:null },
  troll:      { type:PT.B, sp:SP.G, cost:15, name:'Troll',       cannon:null },
  shaman:     { type:PT.Q, sp:SP.G, cost:20, name:'Shaman',      cannon:null },
  warlord:    { type:PT.K, sp:SP.G, cost:15, name:'Warlord',     cannon:null },
}
const SP_UNITS = {
  [SP.H]: ['hero','stronghold','knight_h','archer','wizard','princess'],
  [SP.U]: ['skeleton','tomb','reaper','wraith','vampire','warlock'],
  [SP.R]: ['kobold','iron_golem','salamander','fire_elem','demonics','red_dragon'],
  [SP.G]: ['goblin','ogre','orc','troll','shaman','warlord'],
}
const SP_INFO = {
  [SP.H]: { label:'Humans',     accent:'#B08D2D', emoji:'⚔️',  desc:'Heroes, knights & archers. Balanced and versatile.' },
  [SP.U]: { label:'Undead',     accent:'#7c3aed', emoji:'💀',  desc:'Skeletons & vampires. Masters of movement across gaps.' },
  [SP.R]: { label:'Redskins',   accent:'#c0392b', emoji:'👹',  desc:'Kobolds & iron golems. Cannon attacks and fire power.' },
  [SP.G]: { label:'Greenskins', accent:'#16a34a', emoji:'🐲',  desc:'Goblins, ogres & trolls. Brute force and cannon attacks.' },
}

// ═══════════════════════════════════════════════════════════
// MAP DEFINITIONS
// Grid cell values:
//   null  = void (off-board, no square drawn)
//   0     = normal square
//   'w'   = water square
//   object = token square { type, ...props }
// ═══════════════════════════════════════════════════════════
function makeGrid(rows, cols, fill=null) {
  return Array.from({length:rows}, ()=>Array(cols).fill(fill))
}

const MAPS = (() => {
  const N=0, W='w', _=null

  // ── MAP 1: Compact 10×10 ────────────────────────────────
  // 10×10 grid, 4×4 water in the middle (rows 3-6, cols 3-6)
  const compact = makeGrid(10,10,N)
  for(let r=3;r<=6;r++) for(let c=3;c<=6;c++) compact[r][c]=W

  // ── MAP 2: Two-Player Cross ──────────────────────────────
  //
  // Sections (confirmed dimensions):
  //   Top section:      8 wide × 3 tall
  //   Top connector:    2 wide × 4 tall   (centred on top section & centre)
  //   Centre:           8 wide × 8 tall   (water 4×4 in middle)
  //   Bottom connector: 2 wide × 4 tall
  //   Bottom section:   8 wide × 3 tall
  //   NO left/right sections (those are four-player only)
  //
  // Grid layout (20 rows × 10 cols, centred on cols 1-8):
  //   Centre:           rows 6–13,  cols 1–8
  //   Water:            rows 8–11,  cols 3–6   (middle 4×4 of centre)
  //   Top connector:    rows 2–5,   cols 4–5   (2 wide, 4 tall)
  //   Top section:      rows 0–2,   cols 1–8   (8 wide, 3 tall)
  //   Bottom connector: rows 14–17, cols 4–5
  //   Bottom section:   rows 17–19, cols 1–8

  const two = makeGrid(20,8,_)
  // Centre 8×8 (cols 0-7)
  for(let r=6;r<=13;r++) for(let c=0;c<=7;c++) two[r][c]=N
  // Water 4×4 in middle of centre
  for(let r=8;r<=11;r++) for(let c=2;c<=5;c++) two[r][c]=W
  // Top connector 2×4
  for(let r=2;r<=5;r++) for(let c=3;c<=4;c++) two[r][c]=N
  // Top section 8×3
  for(let r=0;r<=2;r++) for(let c=0;c<=7;c++) two[r][c]=N
  // Bottom connector 2×4
  for(let r=14;r<=17;r++) for(let c=3;c<=4;c++) two[r][c]=N
  // Bottom section 8×3
  for(let r=17;r<=19;r++) for(let c=0;c<=7;c++) two[r][c]=N

  // ── MAP 3: Four-Player Cross ─────────────────────────────
  // Identical to two-player but with left AND right sections and connectors.
  // (Two-player map already has left + right — four-player is the same shape,
  //  just with all four spawn zones active.)
  // For Phase 1 the grid is identical; the 4-player designation means all four
  // outer sections serve as spawn areas. Layout is the same 20×20 grid.
  const four = makeGrid(20,20,_)
  // Centre
  for(let r=6;r<=13;r++) for(let c=6;c<=13;c++) four[r][c]=N
  // Water
  for(let r=8;r<=11;r++) for(let c=8;c<=11;c++) four[r][c]=W
  // Top connector + section
  for(let r=2;r<=5;r++) for(let c=9;c<=10;c++) four[r][c]=N
  for(let r=0;r<=2;r++) for(let c=6;c<=13;c++) four[r][c]=N
  // Bottom connector + section
  for(let r=14;r<=17;r++) for(let c=9;c<=10;c++) four[r][c]=N
  for(let r=17;r<=19;r++) for(let c=6;c<=13;c++) four[r][c]=N
  // Left connector + section
  for(let r=9;r<=10;r++) for(let c=2;c<=5;c++) four[r][c]=N
  for(let r=6;r<=13;r++) for(let c=0;c<=2;c++) four[r][c]=N
  // Right connector + section
  for(let r=9;r<=10;r++) for(let c=14;c<=17;c++) four[r][c]=N
  for(let r=6;r<=13;r++) for(let c=17;c<=19;c++) four[r][c]=N

  return [
    { id:'compact',    name:'Compact Skirmish',   icon:'⚔',  players:2, grid:compact, rows:10, cols:10, desc:'10×10 dungeon — 4×4 water hazard in centre' },
    { id:'two_player', name:'Two Player Dungeon',  icon:'🗡', players:2, grid:two,     rows:20, cols:8,  desc:'Cross-shaped dungeon — top & bottom spawns, central water' },
    { id:'four_player',name:'Four Player Dungeon', icon:'🏰', players:4, grid:four,    rows:20, cols:20, desc:'Symmetric cross — four spawn zones, central water' },
  ]
})()
