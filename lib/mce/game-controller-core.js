'use strict';
(function() {

function createGameController(boardContainer, game, opts) {
  opts = opts || {};
  const players = opts.players || { w: 'human', b: 'ai' };
  let aiDifficulty = opts.aiDifficulty || 'medium';
  const renderOpts = opts.renderOpts || {};
  const onMove = opts.onMove || null;
  const onGameEnd = opts.onGameEnd || null;
  const onTurnChange = opts.onTurnChange || null;
  const onSelect = opts.onSelect || null;
  const onPendingAction = opts.onPendingAction || null;
  const onRender = opts.onRender || null;

  let selected = null;
  let lastMove = null;
  let undoStack = [];
  let redoStack = [];
  let flipped = false;
  let aiThinking = false;
  let gameOver = false;
  let destroyed = false;

  let aiWorker = null;
  let aiWorkerReady = false;
  let aiMoveId = 0;

  function initWorker() {
    if (opts.workerPath) {
      try {
        aiWorker = new Worker(opts.workerPath);
        aiWorker.addEventListener('message', onWorkerMessage);
        if (opts.variantPaths) {
          aiWorker.postMessage({ type: 'init', variantPaths: opts.variantPaths });
        } else {
          aiWorker.postMessage({ type: 'init', variantPaths: [] });
        }
      } catch (e) { aiWorker = null; }
    }
  }

  function onWorkerMessage(e) {
    if (destroyed) return;
    const msg = e.data;
    if (msg.type === 'ready') { aiWorkerReady = true; return; }
    if (msg.type === 'move') {
      handleAIResult(msg.move);
      return;
    }
    if (msg.type === 'duck') {
      if (msg.sq >= 0) placeDuck(msg.sq);
      aiThinking = false;
      render();
      return;
    }
  }

  function serializeGame(g) {
    const snap = {};
    const keys = ['rows', 'cols', 'board', 'terrain', 'pieceData', 'turn', 'players',
      'turnIndex', 'castling', 'enPassant', 'halfmove', 'fullmove', 'variant',
      'checkCount', 'movesThisTurn', 'duckSq', 'duckPhase', 'status',
      'noCastling', 'noEnPassant', 'noPromotion', 'noCheck', 'torpedo',
      'pawnDirection', 'pawnStartRow', 'royalPiece', 'pieceRoles',
      'maxMovesPerTurn', 'progressiveMove', 'checkThreshold', 'stalemateMeaning',
      'promotionPieces', 'promotionRank', 'pawnMoveStyle', 'divergentPieces',
      'wrapFiles', 'wrapRanks', 'lastMovedSq', 'ownershipMode', 'effects'];
    for (let i = 0; i < keys.length; i++) {
      if (g[keys[i]] !== undefined) snap[keys[i]] = g[keys[i]];
    }
    snap._eliminated = Array.from(g.eliminated || []);
    snap.positionHistory = g.positionHistory ? g.positionHistory.slice() : [];
    snap.history = [];
    return snap;
  }

  function isHuman(side) {
    return players[side] === 'human';
  }

  function isAI(side) {
    return players[side] === 'ai';
  }

  function getAIColor() {
    for (const s of (game.players || [MCE.WHITE, MCE.BLACK])) {
      if (isAI(s)) return s;
    }
    return null;
  }

  function isGameOverCheck() {
    if (gameOver) return true;
    const variantStatus = MCE.getVariantStatus ? MCE.getVariantStatus(game) : null;
    if (variantStatus) return true;
    const status = MCE.getStatus(game);
    return status === 'checkmate' || status === 'stalemate' ||
      status === 'draw-50' || status === 'draw-repetition' || status === 'draw-material';
  }

  function getLegalMoves() {
    const vc = MCE.getVariantConfig ? MCE.getVariantConfig(game.variant) : null;
    if (vc && vc.moveFilter) return MCE.variantLegalMoves(game);
    return MCE.legalMoves(game);
  }

  function render() {
    if (destroyed) return;
    const mergedOpts = Object.assign({}, renderOpts, {
      selected: selected,
      lastMove: lastMove,
      flipped: flipped,
      legalMoves: [],
      onSquareClick: handleClick,
      duckSq: game.duckSq >= 0 ? game.duckSq : null,
    });

    if (!game.duckPhase && !aiThinking) {
      const allMoves = getLegalMoves();
      mergedOpts.legalMoves = selected !== null ? allMoves.filter(m => m.from === selected) : [];
    }

    const vc = MCE.getVariantConfig ? MCE.getVariantConfig(game.variant) : null;
    if (vc && vc.visibility) {
      const viewSide = isHuman(game.turn) ? game.turn : getAIColor() === MCE.BLACK ? MCE.WHITE : MCE.BLACK;
      mergedOpts.fogMask = vc.visibility(game, viewSide);
    }

    MCE.renderBoard(boardContainer, game, mergedOpts);
    if (onRender) onRender(game, mergedOpts);
  }

  function handleClick(sq) {
    if (destroyed || gameOver) return;
    if (!isHuman(game.turn) && !game.duckPhase) return;

    if (game.duckPhase) {
      if (!game.board[sq] && sq !== game.duckSq) {
        placeDuck(sq);
        if (!isGameOverCheck() && isAI(game.turn)) {
          scheduleAIMove();
        }
      }
      return;
    }

    if (game._pendingAction) {
      const allMoves = getLegalMoves();
      const candidates = allMoves.filter(m => m.to === sq);
      if (candidates.length > 0) {
        executeMove(candidates[0]);
      }
      return;
    }

    const piece = game.board[sq];
    const allMoves = getLegalMoves();

    if (selected !== null) {
      const candidates = allMoves.filter(m => m.from === selected && m.to === sq);
      if (candidates.length > 1 && candidates[0].promo) {
        if (opts.onPromotionNeeded) {
          opts.onPromotionNeeded(candidates, game.turn, function(promoType) {
            const move = candidates.find(m => m.promo === promoType);
            if (move) executeMove(move);
          });
        } else {
          executeMove(candidates[0]);
        }
        return;
      }
      if (candidates.length > 0) {
        executeMove(candidates[0]);
        return;
      }
    }

    if (piece && MCE.pieceOwner(sq, game) === game.turn) {
      selected = sq;
      if (onSelect) onSelect(sq, piece, allMoves.filter(m => m.from === sq));
    } else {
      selected = null;
    }
    render();
  }

  function executeMove(move) {
    const side = game.turn;
    const captured = game.board[move.to] || (move.flag === 'ep' ? true : null);
    const undo = MCE.makeMove(game, move);
    undoStack.push(undo);
    redoStack = [];
    lastMove = { from: move.from, to: move.to };
    selected = null;

    if (onMove) onMove(move, undo, captured);

    if (game._pendingAction) {
      if (onPendingAction) onPendingAction(game._pendingAction);
      render();
      if (isAI(game.turn)) scheduleAIMove();
      return;
    }

    if (onTurnChange) onTurnChange(game.turn, game.turnIndex);

    render();
    checkGameEnd();

    if (!gameOver && isAI(game.turn) && !game.duckPhase) {
      scheduleAIMove();
    }
  }

  function checkGameEnd() {
    if (isGameOverCheck()) {
      gameOver = true;
      const status = MCE.getStatus(game);
      const variantStatus = MCE.getVariantStatus ? MCE.getVariantStatus(game) : null;
      if (onGameEnd) onGameEnd(variantStatus || status);
    }
  }

  function placeDuck(sq) {
    game.duckSq = sq;
    game.duckPhase = false;
    if (game.turn === MCE.BLACK) game.fullmove++;
    game.turn = game.turn === MCE.WHITE ? MCE.BLACK : MCE.WHITE;
    selected = null;
    render();
  }

  function scheduleAIMove() {
    aiThinking = true;
    render();
    setTimeout(doAIMove, 150);
  }

  function doAIMove() {
    if (destroyed || isGameOverCheck()) { aiThinking = false; render(); return; }

    const vc = MCE.getVariantConfig ? MCE.getVariantConfig(game.variant) : null;
    if (vc && vc.aiMoveCount) {
      const count = vc.aiMoveCount(game);
      if (count > 1) { doAIMoveMulti(count); return; }
    }

    if (game._pendingAction) {
      const moves = getLegalMoves();
      if (moves.length > 0) {
        const pick = moves[Math.floor(Math.random() * moves.length)];
        handleAIResult(pick);
      } else {
        aiThinking = false;
        render();
      }
      return;
    }

    if (aiWorker && aiWorkerReady) {
      aiMoveId++;
      aiWorker.postMessage({
        type: 'pickMove',
        game: serializeGame(game),
        difficulty: aiDifficulty,
        id: aiMoveId
      });
      return;
    }

    const move = MCE.aiPickMove(game, null, { difficulty: aiDifficulty });
    handleAIResult(move);
  }

  function handleAIResult(move) {
    if (destroyed) return;
    if (!move) { aiThinking = false; render(); return; }

    const side = game.turn;
    const captured = game.board[move.to] || (move.flag === 'ep' ? true : null);
    const undo = MCE.makeMove(game, move);
    undoStack.push(undo);
    redoStack = [];
    lastMove = { from: move.from, to: move.to };

    if (onMove) onMove(move, undo, captured);

    if (game._pendingAction) {
      if (onPendingAction) onPendingAction(game._pendingAction);
      setTimeout(doAIMove, 150);
      return;
    }

    if (game.variant === 'duckChess' && game.duckPhase) {
      if (aiWorker && aiWorkerReady) {
        aiWorker.postMessage({
          type: 'pickDuck',
          game: serializeGame(game),
          id: ++aiMoveId
        });
        return;
      }
      const duckSq = MCE.aiPickDuckSquare(game);
      if (duckSq >= 0) placeDuck(duckSq);
    }

    aiThinking = false;
    if (onTurnChange) onTurnChange(game.turn, game.turnIndex);
    render();
    checkGameEnd();
  }

  function doAIMoveMulti(count) {
    const side = game.turn;
    for (let i = 0; i < count; i++) {
      if (isGameOverCheck() || game.turn !== side) break;
      const move = MCE.aiPickMove(game, null, { difficulty: aiDifficulty });
      if (!move) break;
      const captured = game.board[move.to] || (move.flag === 'ep' ? true : null);
      const undo = MCE.makeMove(game, move);
      undoStack.push(undo);
      lastMove = { from: move.from, to: move.to };
      if (onMove) onMove(move, undo, captured);
    }
    aiThinking = false;
    if (onTurnChange) onTurnChange(game.turn, game.turnIndex);
    render();
    checkGameEnd();
  }

  function undo() {
    if (undoStack.length === 0 || aiThinking) return;
    const u = undoStack.pop();
    MCE.unmakeMove(game, u);
    redoStack.push(u);
    if (isAI(game.turn) && undoStack.length > 0) {
      const u2 = undoStack.pop();
      MCE.unmakeMove(game, u2);
      redoStack.push(u2);
    }
    selected = null;
    gameOver = false;
    lastMove = undoStack.length > 0 ? { from: undoStack[undoStack.length - 1].from, to: undoStack[undoStack.length - 1].to } : null;
    render();
  }

  function redo() {
    if (redoStack.length === 0 || aiThinking) return;
    const u = redoStack.pop();
    MCE.makeMove(game, { from: u.from, to: u.to, flag: u.flag, promo: u.promo });
    selected = null;
    lastMove = { from: u.from, to: u.to };
    render();
  }

  function forfeit() {
    gameOver = true;
    if (onGameEnd) onGameEnd('forfeit');
    render();
  }

  function setDifficulty(level) {
    aiDifficulty = level;
  }

  function setFlipped(val) {
    flipped = val;
    render();
  }

  function getGame() {
    return game;
  }

  function isThinking() {
    return aiThinking;
  }

  function destroy() {
    destroyed = true;
    if (aiWorker) {
      aiWorker.terminate();
      aiWorker = null;
    }
  }

  initWorker();
  render();

  return {
    undo,
    redo,
    forfeit,
    setDifficulty,
    setFlipped,
    getGame,
    isThinking,
    render,
    destroy,
  };
}

Object.assign(MCE, { createGameController });
})();
