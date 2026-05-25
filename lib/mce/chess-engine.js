'use strict';
/**
 * Moddable Chess Engine — core game logic
 * Supports variable board sizes (8×8, 10×8, 10×10, 12×8).
 */

const MCE = (function() {

const PIECE = { P: 'p', N: 'n', B: 'b', R: 'r', Q: 'q', K: 'k', A: 'a', C: 'c', S: 's', M: 'm' };
const WHITE = 'w', BLACK = 'b';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const VARIANT_BOARDS = {
  capablanca: { rows: 8, cols: 10, fen: 'rnabqkbcnr/pppppppppp/10/10/10/10/PPPPPPPPPP/RNABQKBCNR w KQkq - 0 1' },
  grand: { rows: 10, cols: 10, fen: 'r8r/1nbqkcbn1/pppppppppp/10/10/10/10/PPPPPPPPPP/1NBQKCBN1/R8R w - - 0 1' },
  courier: { rows: 8, cols: 12, fen: 'rnbbqsksbbnr/pppppppppppp/12/12/12/12/PPPPPPPPPPPP/RNBBQSKSBBNR w - - 0 1' },
  horde: { rows: 8, cols: 8, fen: 'rnbqkbnr/pppppppp/8/1PP2PP1/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1' },
  breakthrough: { rows: 7, cols: 7, fen: 'ppppppp/ppppppp/7/7/7/PPPPPPP/PPPPPPP w - - 0 1' },
  maharaja: { rows: 8, cols: 8, fen: 'rnbqkbnr/pppppppp/8/8/8/8/8/4M3 w kq - 0 1' },
};

const pieceRegistry = {};

function createGame(config) {
  if (typeof config === 'string' || config === undefined) {
    return createVariantGame(config);
  }
  const rows = config.rows || 8;
  const cols = config.cols || 8;
  const total = rows * cols;
  const players = config.players || [WHITE, BLACK];
  const g = {
    rows: rows,
    cols: cols,
    board: Array(total).fill(null),
    terrain: config.terrain || Array(total).fill(0),
    pieceData: config.pieceData || Array(total).fill(null),
    turn: players[0],
    players: players,
    turnIndex: 0,
    eliminated: new Set(),
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: -1,
    halfmove: 0,
    fullmove: 1,
    history: [],
    positionHistory: [],
    variant: config.variant || null,
    checkCount: { w: 0, b: 0 },
    movesThisTurn: 0,
    duckSq: -1,
    duckPhase: false,
    status: 'active',
    noCastling: config.noCastling || false,
    noEnPassant: config.noEnPassant || false,
    noPromotion: config.noPromotion || false,
    ownershipMode: config.ownershipMode || 'case',
    legalityFilter: null,
    winCondition: null,
  };
  if (config.fen) loadFEN(g, config.fen);
  g.positionHistory.push(positionKey(g));
  return g;
}

function createVariantGame(variant) {
  const vb = VARIANT_BOARDS[variant];
  const rows = vb ? vb.rows : 8;
  const cols = vb ? vb.cols : 8;
  const total = rows * cols;
  const g = {
    rows: rows,
    cols: cols,
    board: Array(total).fill(null),
    terrain: Array(total).fill(0),
    pieceData: Array(total).fill(null),
    turn: WHITE,
    players: [WHITE, BLACK],
    turnIndex: 0,
    eliminated: new Set(),
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: -1,
    halfmove: 0,
    fullmove: 1,
    history: [],
    positionHistory: [],
    variant: variant || 'standard',
    checkCount: { w: 0, b: 0 },
    movesThisTurn: 0,
    duckSq: -1,
    duckPhase: false,
    status: 'active',
    noCastling: false,
    noEnPassant: false,
    noPromotion: false,
    legalityFilter: null,
    winCondition: null,
  };
  if (variant === 'noCastling') g.noCastling = true;
  if (variant === 'torpedo') g.torpedo = true;
  if (variant === 'breakthrough') { g.noCastling = true; g.noEnPassant = true; g.noPromotion = true; }
  if (variant === 'maharaja') { g.noCastling = true; }
  const fen = vb ? vb.fen : INITIAL_FEN;
  loadFEN(g, fen);
  g.positionHistory.push(positionKey(g));
  return g;
}

function rc(i, g) {
  const cols = (g && g.cols) || 8;
  return [Math.floor(i / cols), i % cols];
}
function sq(r, c, g) {
  const cols = (g && g.cols) || 8;
  return r * cols + c;
}
function onBoard(r, c, g) {
  const rows = (g && g.rows) || 8;
  const cols = (g && g.cols) || 8;
  if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
  if (g && g.terrain) {
    return g.terrain[r * cols + c] !== null;
  }
  return true;
}

function getTerrain(sqIdx, g) {
  if (!g || !g.terrain) return 0;
  return g.terrain[sqIdx];
}

function registerPiece(typeChar, handlers) {
  pieceRegistry[typeChar] = handlers;
}

function getPieceRegistry() {
  return pieceRegistry;
}

function setLegalityFilter(g, fn) {
  g.legalityFilter = fn;
}

function setWinCondition(g, fn) {
  g.winCondition = fn;
}

function advanceTurn(g) {
  const count = g.players.length;
  let next = (g.turnIndex + 1) % count;
  let attempts = 0;
  while (g.eliminated.has(g.players[next]) && attempts < count) {
    next = (next + 1) % count;
    attempts++;
  }
  g.turnIndex = next;
  g.turn = g.players[next];
}

function pieceColor(p) { return p === p.toUpperCase() ? WHITE : BLACK; }
function pieceType(p) { return p.toLowerCase(); }

function pieceOwner(sqIdx, g) {
  if (g.ownershipMode === 'pieceData' && g.pieceData && g.pieceData[sqIdx]) {
    return g.pieceData[sqIdx].owner;
  }
  const p = g.board[sqIdx];
  return p ? pieceColor(p) : null;
}

function isFriendly(sqIdx, side, g) {
  if (!g.board[sqIdx]) return false;
  return pieceOwner(sqIdx, g) === side;
}

function isEnemy(sqIdx, side, g) {
  if (!g.board[sqIdx]) return false;
  return pieceOwner(sqIdx, g) !== side;
}

function loadFEN(g, fen) {
  const parts = fen.split(' ');
  const fenRows = parts[0].split('/');
  g.board.fill(null);
  for (let r = 0; r < g.rows; r++) {
    let c = 0;
    if (!fenRows[r]) continue;
    let i = 0;
    while (i < fenRows[r].length) {
      const ch = fenRows[r][i];
      if (ch >= '0' && ch <= '9') {
        let num = ch;
        if (i + 1 < fenRows[r].length && fenRows[r][i+1] >= '0' && fenRows[r][i+1] <= '9') {
          num += fenRows[r][i+1]; i++;
        }
        c += parseInt(num);
      } else {
        g.board[sq(r, c, g)] = ch; c++;
      }
      i++;
    }
  }
  g.turn = parts[1] === 'b' ? BLACK : WHITE;
  if (g.players) {
    g.turnIndex = g.players.indexOf(g.turn);
    if (g.turnIndex < 0) g.turnIndex = 0;
  }
  const cas = parts[2] || '-';
  g.castling = { K: cas.includes('K'), Q: cas.includes('Q'), k: cas.includes('k'), q: cas.includes('q') };
  g.enPassant = parts[3] && parts[3] !== '-' ? algebraicToSq(parts[3], g) : -1;
  g.halfmove = parseInt(parts[4]) || 0;
  g.fullmove = parseInt(parts[5]) || 1;
}

function toFEN(g) {
  let fen = '';
  for (let r = 0; r < g.rows; r++) {
    let empty = 0;
    for (let c = 0; c < g.cols; c++) {
      const p = g.board[sq(r, c, g)];
      if (!p) { empty++; }
      else { if (empty) { fen += empty; empty = 0; } fen += p; }
    }
    if (empty) fen += empty;
    if (r < g.rows - 1) fen += '/';
  }
  fen += ' ' + g.turn;
  let cas = '';
  if (g.castling.K) cas += 'K'; if (g.castling.Q) cas += 'Q';
  if (g.castling.k) cas += 'k'; if (g.castling.q) cas += 'q';
  fen += ' ' + (cas || '-');
  fen += ' ' + (g.enPassant >= 0 ? sqToAlgebraic(g.enPassant, g) : '-');
  fen += ' ' + g.halfmove + ' ' + g.fullmove;
  return fen;
}

function algebraicToSq(s, g) {
  const rows = (g && g.rows) || 8;
  const col = s.charCodeAt(0) - 97;
  const row = rows - parseInt(s.substring(1));
  return sq(row, col, g);
}
function sqToAlgebraic(i, g) {
  const [r, c] = rc(i, g);
  const rows = (g && g.rows) || 8;
  return String.fromCharCode(97 + c) + (rows - r);
}

function positionKey(g) {
  const fen = toFEN(g);
  const parts = fen.split(' ');
  return parts.slice(0, 4).join(' ');
}

return { PIECE, WHITE, BLACK, INITIAL_FEN, VARIANT_BOARDS, createGame, loadFEN, toFEN, positionKey, rc, sq, onBoard, getTerrain, pieceColor, pieceType, pieceOwner, isFriendly, isEnemy, algebraicToSq, sqToAlgebraic, registerPiece, getPieceRegistry, setLegalityFilter, setWinCondition, advanceTurn };
})();
