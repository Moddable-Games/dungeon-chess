# Modding Dungeon Chess

Dungeon Chess is built to be modified. All game data lives in three JSON files in the `data/` directory — edit them and reload the page to see your changes instantly.

## Files

| File | What it controls |
|---|---|
| `data/factions.json` | Units, faction metadata, and species rosters |
| `data/maps.json` | Board layouts (which squares exist and their type) |
| `data/draft-rules.json` | XP budget, draft constraints, and AI behaviour |

---

## `data/factions.json`

### `units`

Each key is a unit identifier used throughout the engine. All units must have:

| Field | Type | Description |
|---|---|---|
| `type` | string | Chess role: `"pawn"`, `"castle"`, `"knight"`, `"bishop"`, `"queen"`, or `"king"` |
| `sp` | string | Faction key: `"human"`, `"undead"`, `"redskin"`, or `"greenskin"` (or a custom faction key) |
| `cost` | number | XP cost for drafting. Keep within a reasonable range (1–30) |
| `name` | string | Display name shown in the UI |
| `cannon` | string\|null | Cannon attack type: `"pawn"` (orthogonal), `"castle"` (rook-line), or `null` for no cannon |

Example:

```json
"my_hero": { "type": "pawn", "sp": "human", "cost": 5, "name": "My Hero", "cannon": null }
```

### `spUnits`

Maps each faction key to an ordered list of unit identifiers. Order determines display order in the draft and faction picker screens.

```json
"spUnits": {
  "human": ["hero", "stronghold", "knight_h", "archer", "wizard", "princess"]
}
```

### `spInfo`

Display metadata for each faction:

| Field | Type | Description |
|---|---|---|
| `label` | string | Faction name shown in the UI |
| `accent` | string | CSS colour (hex) used for UI accents |
| `emoji` | string | Emoji shown next to faction name |
| `desc` | string | Short description on the faction picker |

---

## `data/maps.json`

The `maps` array contains one entry per playable board. Each map has:

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier (used internally) |
| `name` | string | Display name |
| `icon` | string | Emoji shown on the map picker card |
| `players` | number | `2` or `4` — which player-count modes this map appears in |
| `rows` | number | Number of rows in the grid |
| `cols` | number | Number of columns in the grid |
| `desc` | string | Short description on the map card |
| `grid` | array | 2D array of cell values (see below) |

### Cell values

| Value | Meaning |
|---|---|
| `0` | Normal floor square — pieces can move and stand here |
| `"w"` | Water — most pieces cannot land here; cannon lines pass through it |
| `null` | Void — off-board; no square is drawn; all movement stops here |

### Grid format

The grid is an array of rows, each row an array of column values. Indices are `[row][col]` with `[0][0]` at the top-left.

```json
"grid": [
  [0, 0, 0, 0],
  [0, "w", "w", 0],
  [0, null, null, 0],
  [0, 0, 0, 0]
]
```

### Spawn zones

Spawn zones are inferred automatically. Player pieces start on the bottom rows; AI on the top rows. For 4-player maps, left and right sections become spawn zones for additional AI players.

---

## `data/draft-rules.json`

| Field | Type | Description |
|---|---|---|
| `budget` | number | Total XP available for drafting (default: 80) |
| `constraints.mustHaveKing` | boolean | Whether the draft must include a King unit |
| `constraints.mustHavePawn` | boolean | Whether the draft must include at least one Pawn |
| `ai.firstPickTypes` | array | Ordered chess roles the AI prioritises when building its team |
| `ai.fillWithPawns` | boolean | Whether the AI fills remaining XP with Pawns after its priority picks |

---

## Creating a custom faction

1. Add entries to `units` for each unit in your faction.
2. Add your faction key to `spUnits` with an ordered list of your unit keys.
3. Add display metadata to `spInfo`.

The new faction will appear automatically on the faction picker screen.

New factions use the existing chess movement rules — the `type` field controls movement. Custom movement rules require changes to the engine (`js/mce-bridge.js`).

## Piece images

For custom units, add a PNG to `assets/pieces/` and `assets/pieces-alt/` named after the unit key (e.g. `my_hero.png`). The classic SVG style falls back to the standard chess sprite determined by `type`.

## Notes

- JSON files are loaded once at startup. Reload the page after any edit.
- Unit keys must be valid identifiers — no spaces, use underscores.
- Keep the `budget` high enough to field a King + at least one Pawn, or the draft screen will be stuck.
