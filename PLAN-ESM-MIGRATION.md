# ESM Migration Plan

**Goal:** Convert all DC JavaScript files from global-script to native ES modules, matching MCE's ESM migration.

**Branch:** `dev` (local development, `main` is production-only)

## Strategy

Single entry point `js/main.js` loaded as `<script type="module">`. Each file gets explicit `import`/`export` statements. MCE files (already ESM from pull) import from each other; DC files import MCE via `../lib/mce/chess-engine.js`.

## Conversion Order (leaves → root)

### Phase 1: Data layer (no cross-file deps)
- [ ] `js/data.js` — export: TILE, SIDE_W, TILE_MIN, TILE_MAX, computeTile, PIECE_TO_SPRITE, PIECE_SYMBOLS, SP, PT, FEN_CH, UNITS, SP_UNITS, SP_INFO, MAPS, DRAFT_RULES, DATA_READY

### Phase 2: Utilities (depend only on data)
- [ ] `js/board-renderer.js` — export: SVGns, svgEl, SQ_LIGHT, SQ_DARK, SQ_WATER, SQ_WATER2, dcTilePainter, dcPieceProvider, dcSurroundRenderer, dcEffectOverlay, dcLegalMoveRenderer, dcAfterRender, getDCRenderOpts, ensureSpriteDefs, drawStoneTexture, drawFloorDetails, drawCandle, drawLantern
- [ ] `js/dungeon-surround.js` — export: drawDungeonSurround

### Phase 3: Core game logic
- [ ] `js/state.js` — export: G, draftList, spToColor, SP_PIECE_COLOR, appendPieceTint, show, renderMapScreen, renderSpeciesScreen, renderDraftScreen, refreshDraft, buildAiDraft
- [ ] `js/mce-bridge.js` — export: DungeonMCE (unwrap IIFE, use named exports)

### Phase 4: Game systems
- [ ] `js/engine.js` — export: getLegal, wouldLeaveInCheck, isInCheck
- [ ] `js/battle.js` — export: buildStarting, placeAiPiecesColumn
- [ ] `js/screens.js` — export: PL, renderPlacementScreen, populatePlacePanels, autoPlace, placeAiPieces, renderTray, invalidatePlacementStatic, renderPlacementBoard, handlePlacementClick, updatePlaceHint, drawPlaceSurroundOnce

### Phase 5: UI & interaction
- [ ] `js/battle-draw.js` — export: G_lastMove, G_controller, lockTileSize, unlockTileSize, createBattleController, destroyBattleController, animateMove, flashCapture, updateUI, showSelected, playerHex, cancelHex, addLog, endGame, lightAnimState, startLightAnimation, renderAtmosphereCanvas
- [ ] `js/replay.js` — export: RP, rpSaveInitial, rpStart, rpGoToStart, rpGoToEnd, rpStepForward, rpStepBack, rpTogglePlay, rpPause, rpBuildLog
- [ ] `js/aria.js` — export: kbEnsureLiveRegion, kbAnnounce, kbAnnounceSquare, kbAnnounceAction
- [ ] `js/keyboard.js` — export: KB, kbInit, kbRenderCursor
- [ ] `js/tooltip.js` — export: TT, ttInit, ttShowForCursor, ttHide

### Phase 6: Entry point & HTML
- [ ] `js/ui.js` — convert to ESM (imports everything, wires buttons, no exports needed)
- [ ] Create `js/main.js` — single entry that imports ui.js (which chains everything)
- [ ] Update `index.html` — replace 23 script tags with `<script type="module" src="js/main.js?v=...">`

### Phase 7: Validation
- [ ] Test in browser — verify game loads, play through a match
- [ ] Version bump (1.2.1 → 1.3.0 for breaking module change)

## Key Decisions

1. **`TILE` and `UNITS` (mutable let):** Use `export let` — ESM live bindings mean importers always see the current value. Only data.js writes to TILE (via `computeTile`). Standard ESM.

2. **MCE import:** DC files import `MCE` from `'../lib/mce/chess-engine.js'` (default export). Also import named exports as needed (e.g. `makeMove` from chess-play.js for replay).

3. **`draftList` is mutable array:** Fine — arrays are objects, mutations propagate.

## Circular Dependency Resolution

### Cycle 1: state.js ↔ board-renderer.js
- **Problem:** board-renderer uses `spToColor`, `appendPieceTint` (defined in state.js), and state.js uses `svgEl` (defined in board-renderer).
- **Fix:** Move `spToColor`, `SP_PIECE_COLOR`, `appendPieceTint` to board-renderer.js (they're rendering helpers). state.js no longer imports from board-renderer.
- **New direction:** board-renderer.js → state.js (for `G`). One-way.

### Cycle 2: state.js ↔ battle-draw.js
- **Problem:** state.js `show()` calls `renderAtmosphereCanvas()` and reads `lightAnimState` (from battle-draw.js). battle-draw.js `endGame()` calls `show()` (from state.js).
- **Fix:** Extract `renderAtmosphereCanvas`, `lightAnimState`, `startLightAnimation` into `js/atmosphere.js`. Both state.js and battle-draw.js import from it. No reverse dep.
- **New direction:** state.js → atmosphere.js, battle-draw.js → atmosphere.js, battle-draw.js → state.js (for `show`). All one-way.

### Cycle 3: board-renderer.js ↔ keyboard.js
- **Problem:** board-renderer's `dcAfterRender` calls `kbRenderCursor` (from keyboard.js). keyboard.js uses `svgEl` and `TILE` (from board-renderer/data).
- **Fix:** board-renderer exposes `registerCursorRenderer(fn)`. keyboard.js calls it at init time with `kbRenderCursor`. No import of keyboard from board-renderer.
- **New direction:** keyboard.js → board-renderer.js (for `svgEl`, `registerCursorRenderer`). One-way.

### Cycle 4: ui.js ↔ battle-draw.js
- **Problem:** ui.js calls functions from battle-draw.js (`updateUI`, `addLog`, etc.). battle-draw uses `show()` from state.js (not from ui.js directly).
- **Fix:** No actual cycle — ui.js imports from battle-draw.js, battle-draw imports from state.js. ui.js wires DOM and is the leaf entry point.

## Completed Steps

- [x] `js/data.js` — all exports added (export let TILE, export let UNITS, etc.)
- [x] `js/mce-bridge.js` — imports MCE + data, unwrapped IIFE, exports DungeonMCE
- [x] `js/dungeon-surround.js` — imports TILE from data, exports drawDungeonSurround
- [x] MCE pulled (ESM v0.9.0) and committed on dev

## Next Steps (resume here)

1. Create `js/atmosphere.js` — extract from battle-draw.js (lightAnimState, startLightAnimation, renderAtmosphereCanvas)
2. Convert `js/board-renderer.js` — add imports, move spToColor/appendPieceTint here, add registerCursorRenderer, export all public functions
3. Convert `js/state.js` — import from data/board-renderer/atmosphere, export G/show/draft functions
4. Convert remaining files in dependency order (engine → battle → screens → battle-draw → replay → aria → keyboard → tooltip → ui)
5. Create `js/main.js` entry point
6. Update index.html

## Rollback

If migration breaks mid-way: `git checkout -- js/ index.html lib/` restores pre-ESM state. MCE pull can be re-done after.
