'use strict';
(function() {

function createReplay(completedGame) {
  const moves = completedGame.history ? completedGame.history.slice() : [];
  const variant = completedGame.variant || 'standard';
  let baseGame = MCE.createGame(variant);
  let currentIndex = 0;
  let undoStack = [];

  function stepForward() {
    if (currentIndex >= moves.length) return false;
    const move = moves[currentIndex];
    const undo = MCE.makeMove(baseGame, move);
    undoStack.push(undo);
    currentIndex++;
    return true;
  }

  function stepBack() {
    if (currentIndex <= 0) return false;
    const undo = undoStack.pop();
    MCE.unmakeMove(baseGame, undo);
    currentIndex--;
    return true;
  }

  function goToMove(n) {
    if (n < 0) n = 0;
    if (n > moves.length) n = moves.length;
    while (currentIndex > n) stepBack();
    while (currentIndex < n) stepForward();
  }

  function isAtEnd() {
    return currentIndex >= moves.length;
  }

  function isAtStart() {
    return currentIndex <= 0;
  }

  function currentMove() {
    return currentIndex;
  }

  function totalMoves() {
    return moves.length;
  }

  function getGame() {
    return baseGame;
  }

  function getMove(index) {
    return moves[index] || null;
  }

  return {
    stepForward,
    stepBack,
    goToMove,
    isAtEnd,
    isAtStart,
    currentMove,
    totalMoves,
    getGame,
    getMove,
  };
}

Object.assign(MCE, { createReplay });
})();
