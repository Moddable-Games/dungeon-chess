# Dungeon Chess — Complete Ruleset

> **Canonical rulebook:** [rules.moddable.games/dist/dungeon-chess/](https://rules.moddable.games/dist/dungeon-chess/)  
> This file is a dev-focused quick reference. The canonical source above has full formatting and is the source of truth.

**Version:** 0.1 (as implemented 2026-05-21)  
**Source of truth for:** game mechanics, unit abilities, movement rules, win conditions, drafting, maps

---

## 1. Overview

Dungeon Chess is an asymmetric turn-based strategy game played on modular dungeon boards. Players draft teams from fantasy factions using an XP budget, deploy them on the board, and battle until one side's King is captured.

---

## 2. Factions

Four playable factions, each with a distinct roster of 6 unit types:

| Colour | Faction | Playstyle |
|--------|---------|-----------|
| White | Humans | Balanced — ranged attacks, bishop movement on King |
| Black | Undead | Movement trickery — gap-crossing, diagonal gliding |
| Red | Redskins | Firepower — cannon attacks on Pawns and Castles |
| Green | Greenskins | Brute force — cannon attacks on Pawns and Castles |

---

## 3. Units

Each unit maps to a chess piece type. All units within a type share base movement but have faction-specific abilities.

### 3.1 Piece Types

| Type | Chess Equivalent | Base Behaviour |
|------|-----------------|----------------|
| Pawn | Pawn | Moves 1 square in any direction (all 8) |
| Castle | Rook | Moves 1 square orthogonally; attacks along rook lines |
| Knight | Knight | L-shaped jump (2+1), leaps over pieces |
| Bishop | Bishop | Slides diagonally |
| Queen | Queen | Slides in all directions (rook + bishop) |
| King | King | Moves 1 square in any direction |

### 3.2 Full Unit Table

| Unit | Faction | Type | Cost | Special Abilities |
|------|---------|------|------|-------------------|
| Hero | Human | Pawn | 2 XP | Standard pawn |
| Skeleton | Undead | Pawn | 2 XP | Standard pawn |
| Kobold | Redskin | Pawn | 5 XP | Pawn + cannon attack along rook lines |
| Goblin | Greenskin | Pawn | 5 XP | Pawn + cannon attack along rook lines |
| Stronghold | Human | Castle | 10 XP | Move 1 square; attack along rook lines |
| Tomb | Undead | Castle | 10 XP | Move 1 square; attack along rook lines |
| Iron Golem | Redskin | Castle | 15 XP | Move 1 square + cannon attack along rook lines |
| Ogre | Greenskin | Castle | 15 XP | Move 1 square + cannon attack along rook lines |
| Knight | Human | Knight | 15 XP | Standard knight jump |
| Reaper | Undead | Knight | 15 XP | Standard knight jump |
| Salamander | Redskin | Knight | 15 XP | Standard knight jump |
| Orc | Greenskin | Knight | 15 XP | Standard knight jump |
| Archer | Human | Bishop | 15 XP | Attacks across gaps; cannot move across gaps |
| Wraith | Undead | Bishop | 15 XP | Moves across gaps; cannot attack across gaps |
| Fire Elemental | Redskin | Bishop | 15 XP | Cannot move or attack across water |
| Troll | Greenskin | Bishop | 15 XP | Cannot move or attack across water |
| Wizard | Human | Queen | 20 XP | Moves as rook; attacks as bishop (diagonal only) |
| Vampire | Undead | Queen | 20 XP | Moves as bishop; attacks as rook (orthogonal only) |
| Demonics | Redskin | Queen | 20 XP | Full queen movement; cannot attack across water |
| Shaman | Greenskin | Queen | 20 XP | Full queen movement; cannot attack across water |
| Princess | Human | King | 15 XP | King movement + can also move as bishop (slide) |
| Warlock | Undead | King | 20 XP | King movement + can also attack as bishop |
| Red Dragon | Redskin | King | 20 XP | King movement + can also attack as knight |
| Warlord | Greenskin | King | 15 XP | King movement + can also attack as knight |

---

## 4. Movement Rules

### 4.1 General Principles

- **Turn-based:** Players alternate turns. On your turn, move exactly one piece.
- **One piece per square:** No stacking. A piece cannot move onto a square occupied by a friendly piece.
- **Capture:** Move onto a square occupied by an enemy piece to capture it. Captured pieces are removed from the board permanently.
- **Void squares:** Squares marked as void (off-board) cannot be entered or crossed.
- **Water squares:** Normal pieces treat water as impassable terrain. Specific units have water-related restrictions (see unit abilities).

### 4.2 Movement Types

**Step (1 square):**
- Pawns move 1 square in any of the 8 directions (orthogonal + diagonal).
- Castles move 1 square orthogonally only (4 directions).
- Kings move 1 square in any of the 8 directions.

**Slide (unlimited range along a line):**
- Bishops slide diagonally until blocked by a piece, void, or water (faction-dependent).
- Queens slide in all 8 directions until blocked.
- Rook-line sliding is used for Castle attacks (not movement).
- A sliding piece stops when it hits any piece (cannot pass through).

**Jump (L-shape):**
- Knights move in an L-shape: 2 squares in one direction + 1 square perpendicular.
- Knights leap over all intervening pieces and terrain.

**Cannon (requires screen piece):**
- The piece slides along a line. Before hitting any piece, it can stop on empty squares (normal move).
- After passing over exactly one piece (the "screen"), it can capture the next enemy it encounters along that line.
- Cannot capture without a screen piece between attacker and target.
- Cannon attacks use rook lines (orthogonal).

### 4.3 Gaps

A "gap" is a void square interrupting a diagonal line. The gap rules apply only to Bishops:

- **Archer (Human Bishop):** Can ATTACK across a gap (ranged shot), but cannot MOVE across one.
- **Wraith (Undead Bishop):** Can MOVE across a gap (phases through), but cannot ATTACK across one.
- Other bishops: gaps block both movement and attacks.

### 4.4 Water Restrictions

Water squares are impassable to most pieces. Specific interactions:

- **Fire Elemental & Troll (Bishops):** Cannot move or attack across water. Water terminates their diagonal slide.
- **Demonics & Shaman (Queens):** Can move across water (water doesn't block sliding), but cannot ATTACK across it. If a water square lies between the queen and a target along the line, the attack is blocked.
- **Pawns, Castles, Kings:** Cannot step onto water squares.
- **Knights:** Cannot land on water squares (but leap over them freely).

### 4.5 Check

- A King is "in check" when an enemy piece could capture it on the next move.
- A player whose King is in check MUST resolve the check on their turn (move King, block, or capture attacker).
- Moves that would leave your own King in check are illegal and cannot be made.

---

## 5. Win Condition

**King capture:** The game ends immediately when a King is captured. The player who captures the enemy King wins.

In 4-player mode: the game ends when only one player's King remains on the board.

---

## 6. Drafting

### 6.1 Budget

Each player has **80 XP** to spend on their team.

### 6.2 Constraints

- **Must include exactly 1 King** (mandatory — no team is valid without a King)
- **Must include at least 1 Pawn** (minimum one frontline piece)
- **No maximum team size** — as many pieces as budget allows
- **Duplicate units allowed** — you can draft multiple of the same unit type

### 6.3 Draft Process

1. Player sees their faction's unit roster with costs.
2. Add/remove units freely until budget is met and constraints satisfied.
3. AI auto-drafts a valid team from its faction using the same 80 XP budget.
4. AI draft is visible to the player before battle begins.

---

## 7. Deployment (Placement)

### 7.1 Spawn Zones

Each player is assigned a spawn zone — a set of rows/squares at their edge of the board:

- **2-player:** Player spawns in the bottom 2 rows; AI spawns in the top 2 rows.
- **4-player:** Each player spawns in their respective outer section (top, bottom, left, right).

### 7.2 Placement Rules

- All drafted pieces must be placed in the spawn zone before battle begins.
- One piece per square.
- Only non-void, non-water squares in the spawn zone are valid.
- Player places manually (or uses auto-place for random valid placement).
- AI places automatically using a heuristic (King protected, pieces spread across available squares).

### 7.3 Turn Order

Before confirming placement, the player chooses who moves first:
- **You First** (default) — Player takes the first turn.
- **AI First** — AI moves before the player.
- **Random** — Coin flip determines who goes first.

---

## 8. Maps

### 8.1 Compact Skirmish (2-player)

- **Grid:** 10 × 10
- **Water:** 4×4 block in the centre (rows 3–6, cols 3–6)
- **Spawn zones:** Top 2 rows (AI), bottom 2 rows (Player)
- **Character:** Small arena, forces early engagement across water hazard.

### 8.2 Two Player Dungeon (2-player)

- **Grid:** 20 × 8 (cross-shaped)
- **Layout:** Top section (8×3) → connector (2×4) → centre (8×8) → connector (2×4) → bottom section (8×3)
- **Water:** 4×4 in the centre of the middle section
- **Spawn zones:** Bottom section (Player), top section (AI)
- **Character:** Long corridor forces pieces through narrow connectors; strategic chokepoints.

### 8.3 Four Player Dungeon (4-player)

- **Grid:** 20 × 20 (symmetric cross)
- **Layout:** Centre 8×8 + four arms (top, bottom, left, right) each with connector + section
- **Water:** 4×4 in the centre
- **Spawn zones:** Bottom (Player), Top (AI 1), Left (AI 2), Right (AI 3)
- **Character:** Symmetric four-way battle; alliances and backstabs possible.

---

## 9. AI Behaviour

### 9.1 Decision Priority

The AI uses a heuristic evaluation (not exhaustive search):
1. **Capture** — Take the highest-value enemy piece available.
2. **Advance** — Move pieces toward the enemy King.
3. **Protect** — Keep King safe, avoid leaving pieces hanging.

### 9.2 Timing

AI "thinks" for 0.5–1.5 seconds (randomised) before moving for UX realism.

### 9.3 Drafting

AI drafts using a template: always includes a King, then fills with a balanced mix of unit types within the 80 XP budget.

---

## 10. Post-Game Features

### 10.1 End Screen

Displays:
- Victory or Defeat indicator with animation
- Stats: Turns taken, Pieces captured, Pieces lost, MVP Kill (highest-cost capture), Top Survivor
- Surviving and lost pieces listed with visual tags

### 10.2 Replay

Full game replay available from end screen:
- Transport controls: start, back, forward, end, play/pause
- Auto-play at ~800ms per move
- Clickable move log to jump to any point
- Keyboard support (left/right arrows, space for play/pause)

### 10.3 Post-Game Options

- **New Game** — Return to home screen, start fresh.
- **Rematch** — Same map and species, re-draft teams.
- **Same Team** — Same map, species, and team composition, re-deploy only.

---

## 11. Undo

During battle, the player may undo their last move (reverts both the player's move and the AI's response). Available only on the player's turn when at least one full turn pair has been made.

---

## 12. Not Yet Implemented

The following are defined in the PRD but not yet present in the game:

- **Card System** — Proficiencies, Objects, and Spells (XP-drafted abilities)
- **Board Tokens** — Doors (locked/open), Portals (teleport/freeze), Chests (loot), Exits
- **Campaign Mode** — Story progression, puzzles, multi-session play
- **Online Multiplayer** — Real-time PvP via WebSockets
- **Chess Variants** — Traditional, XingQi, Capablanca, Courier, 4Board modes

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Cannon | Attack that requires a "screen" piece between attacker and target along a line |
| Gap | A void square interrupting a diagonal; some Bishops can cross it |
| Screen | Any piece (friendly or enemy) that enables a cannon attack |
| Spawn zone | Designated rows where a player places pieces before battle |
| Void | Off-board square; cannot be entered or crossed |
| Water | Terrain square; blocks certain pieces, passable by others |
| XP | Experience points; the currency for drafting units |
| Check | State where a King can be captured on the next enemy turn |

---

*This document reflects the game as currently implemented. Update it when rules change or new systems are added.*
