# MCE Decoupling Roadmap

**Goal:** Dungeon Chess becomes purely a skin — custom graphics, custom screens, and a variant plugin config. All game logic, AI, rendering, interaction, and replay are powered by MCE or MCE plugin hooks.

**End state:** DC ships zero "core" game logic. Its JS is limited to:
- `data.js` — unit definitions, maps, faction metadata (consumed by MCE plugin)
- `dc-variant.js` — MCE variant plugin (unit handlers, hooks, evaluator)
- Screen controllers — draft, placement, landing page, end screen (pure UI)
- Theme/skin — dungeon textures, canvas surround, particle effects (renderer extension)

---

## Phase 1: Action Moves & Hex (MCE already supports this)

**DC work:**
- Migrate hex from manual `advanceTurn()` to MCE action move system
- Shaman generates a `flag: 'action'` move via `moveFilter` when hex is available
- AI evaluates hex as part of normal search (no more 25% random coin flip)
- Remove `aiTryHex`, `G.hexUsed`, `G.hexTargeting` UI state → replace with MCE effects + action UI

**MCE work:** None — action moves (#59) and effects already shipped.

**Result:** AI reasons about hex strategically. ~50 lines removed from battle-draw.js.

---

## Phase 2: Salamander Retreat as Multi-Step Turn

**DC work:**
- Salamander capture triggers a follow-up action move (retreat) via `turnLogic` hook
- For player: UI shows retreat options as legal moves for the same turn
- For AI: MCE search evaluates retreat positions naturally

**MCE work:** Possibly extend `turnLogic` to support "pending action" state where a piece must complete a follow-up move before the turn ends. May already work with existing `movesThisTurn` counter + `aiMoveCount` hook.

**Result:** Salamander retreat logic (~40 lines) moves from battle-draw.js into the variant plugin. AI picks optimal retreat squares.

---

## Phase 3: Position Key Accuracy

**DC work:** Set `g.positionKeyFn` or equivalent on game creation.

**MCE work:** Add a `positionKey` hook to variant config (or accept a custom key function on the game object). DC provides a key function that hashes pieceData keys alongside board state.

**Result:** Transposition table becomes accurate for custom-piece games. AI strength improves meaningfully in longer searches.

---

## Phase 4: Board Renderer Consumption

This is the biggest single change. MCE has a full SVG board renderer with:
- Themes, square coloring, piece rendering
- Legal move dots, last-move highlights, selection
- Click handling, animation (arc, slide, burst)
- Flip support, coordinate labels

**DC work:**
- Replace `board-renderer.js` piece rendering + click handling with MCE's `renderBoard()`
- Keep DC's dungeon-specific layers as a "renderer extension":
  - Stone texture tiles (replace MCE's flat color squares)
  - Water tile styling
  - Canvas surround (walls, portcullis, vines, cobwebs)
  - Particle/light effects (canvas overlay)
- Extract `ensureSpriteDefs`, `appendPieceTint` into a sprite provider consumed by MCE renderer

**MCE work:**
- Add renderer extension points: custom tile painter, custom piece provider, overlay hooks
- `renderBoard(container, game, { tilePainter, pieceProvider, afterRender })`
- `tilePainter(svg, sq, r, c, tileSize, isLight)` — draw custom tile content
- `pieceProvider(game, sq)` — return SVG element for piece at sq (DC uses species-colored SVG symbols)
- `afterRender(svg, game, tileSize)` — add overlays (selection glow, hex indicators, etc.)

**Result:** DC's `board-renderer.js` shrinks from 1338 lines to ~200 (dungeon textures + canvas surround). Animation, click handling, legal move display, and piece rendering come from MCE.

---

## Phase 5: Game Controller / Interaction Loop

MCE's `game-controller.js` handles the full play loop:
- Click → select piece → show legal moves → click target → make move → animate → check status → switch turns
- Undo, move history, game-over detection
- AI turn scheduling (setTimeout → aiPickMove → animate)

**DC work:**
- Replace `handleSquareClick`, `applyMove`, `runAi`, undo logic with MCE game controller consumption
- DC provides callbacks: `onMove(move, undo)` for logging, `onGameEnd(winner)` for end screen, `onTurnChange(turn)` for UI updates
- Salamander retreat and hex targeting become controller "interrupts" via MCE's action-move UI flow

**MCE work:**
- Extract game-controller into a reusable module (currently tightly coupled to MCE's own UI)
- `MCE.createGameController(container, game, { onMove, onGameEnd, onTurnChange, aiDifficulty, players })`
- Support multi-player turn cycling (DC has 4 players)
- Support "human" vs "AI" player designation per player slot

**Result:** `battle-draw.js` and `engine.js` disappear entirely. DC's battle screen becomes: mount game controller, wire callbacks, show/hide UI panels.

---

## Phase 6: Replay System

MCE stores move history in `g.history[]`. A generic replay system needs:
- Step forward/back through history
- Render board at any position
- Auto-play with speed control
- Move log display

**DC work:** Replace `replay.js` with MCE replay consumption.

**MCE work:** Build `MCE.createReplayController(container, game, { onStep })` that renders a replay UI with transport controls. DC just skins the controls.

**Result:** `replay.js` (148 lines) removed.

---

## Phase 7: Data Format Standardization

DC's `data.js` contains unit definitions with XP costs, types, names, and faction assignments. This should follow a standard format that MCE variant plugins expect.

**DC work:**
- Move unit definitions to a JSON data file (`data/units.json`)
- Map definitions to `data/maps.json`
- Variant plugin reads these at registration time

**MCE work:** Define a standard schema for variant data files (pieces, maps, factions). Document in the plugin API guide.

**Result:** `data.js` becomes a thin loader. Unit/map data is hot-swappable and toolable.

---

## Summary: What Remains in DC After Full Decoupling

| File | Purpose | Lines (est.) |
|------|---------|------|
| `index.html` | Screen shells, layout | ~500 |
| `css/style.css` | All visual styling | ~2000 |
| `js/dc-variant.js` | MCE variant plugin (units, hooks, evaluator) | ~400 |
| `js/dungeon-skin.js` | Dungeon renderer extension (textures, surround, particles) | ~600 |
| `js/screens.js` | Draft, placement, landing, end screen controllers | ~400 |
| `js/data-loader.js` | Load units.json + maps.json, register variant | ~50 |
| `data/units.json` | Unit definitions | ~100 |
| `data/maps.json` | Map definitions | ~200 |

**Total DC-specific JS: ~1450 lines** (down from current ~4640)

Everything else — board rendering, interaction, AI, animation, replay, undo, move execution, legal move generation, win detection — comes from MCE.

---

## Dependency Graph

```
Phase 1 (Hex action moves)     → no MCE changes needed
Phase 2 (Salamander multi-step) → minor MCE extension (turnLogic pending action)
Phase 3 (Position key)          → minor MCE extension (positionKey hook)
Phase 4 (Board renderer)        → moderate MCE work (renderer extension points)
Phase 5 (Game controller)       → significant MCE refactor (extract reusable controller)
Phase 6 (Replay)                → moderate MCE work (replay module)
Phase 7 (Data format)           → documentation + schema definition
```

Phases 1-3 can proceed immediately (MCE side is ready or needs trivial changes).
Phases 4-6 require MCE architectural work that benefits all MCE consumers.
Phase 7 is documentation/tooling that can happen anytime.
