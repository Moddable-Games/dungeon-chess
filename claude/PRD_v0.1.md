# PRD: Moddable Chess — Online Game (v0.1)

**Product:** Moddable Chess Web App  
**Scope:** Dungeon Chess Battles — Phase 1  
**Platform:** Desktop Web Browser  
**Multiplayer:** Solo vs AI (Phase 1) → Online Multiplayer (Phase 2)  
**Status:** Draft  
**Last Updated:** May 12, 2026

---

## 1. Overview

Moddable Chess is a tabletop game by Moddable Games that reimagines chess as an asymmetric dungeon crawler. This PRD covers the design and development of the official online implementation, starting with **Dungeon Chess Battles** — the 2–4 player skirmish mode — with a solo-vs-AI experience shipping first.

The web app must faithfully represent the physical game's modular board system, XP-based team drafting, and asymmetric unit abilities, while delivering a polished, accessible browser experience.

---

## 2. Goals

| # | Goal |
|---|------|
| G1 | Ship a fully playable solo-vs-AI Dungeon Chess Battles experience |
| G2 | Implement the full XP drafting system (species, units, cards) |
| G3 | Accurately represent all 4 species and their unit abilities |
| G4 | Support modular board construction matching the physical game |
| G5 | Build a foundation that can extend to real-time online multiplayer in Phase 2 |

---

## 3. Out of Scope (Phase 1)

- Chess variant modes (Traditional, XingQi, Capablanca, Courier, 4Board, etc.)
- Dungeon Chess Campaigns (progression, story, puzzles)
- Online matchmaking or real-time multiplayer
- Mobile / responsive layout
- Account system / persistent profiles

---

## 4. Players & Species

Four playable species are supported for Battles, each mapping to chess piece colours:

| Colour | Species | Flavour |
|--------|---------|---------|
| White | Humans | Heroes, knights, archers |
| Black | Undead | Skeletons, reapers, vampires |
| Red | Redskins | Kobolds, iron golems, fire elementals |
| Green | Greenskins | Goblins, ogres, trolls |

In Phase 1 (solo vs AI), the player picks one species and the AI controls one opposing species (2-player battle). The groundwork for 4-player battles should be architected but not exposed in the UI.

---

## 5. Core Game Loop

```
1. MAP SELECTION
   └─ Pick a pre-defined battle map (from appendix templates)
   └─ [Stretch] Cooperative map builder

2. SPECIES SELECTION
   └─ Player picks a species (Human / Undead / Redskin / Greenskin)
   └─ AI is assigned the opposing species

3. TEAM DRAFTING
   └─ Each player receives 75 XP to spend
   └─ Constraints: at least 1 pawn, 1 king, max 3 cards
   └─ Spend XP on units + cards (proficiencies, objects, spells)

4. BATTLE
   └─ Turn-based play on the modular dungeon board
   └─ Units move/attack using modified chess movement rules
   └─ Interact with tokens (doors, portals, chests, exits)
   └─ Cards activated by eligible pieces

5. END CONDITION
   └─ King captured → opponent wins
   └─ [Or] Objective-based exit conditions (variant scenarios)
```

---

## 6. Board System

### 6.1 Modular Sections
The physical game uses 26 board sections (256 total squares). The online version must replicate this:

- A library of named board section tiles (various sizes, shapes, connector types)
- Pre-defined battle maps assembled from these tiles — start with at least 3 maps (1 for 2-player, 1 for 4-player structure, 1 compact)
- Each section is a grid of squares that can be traversed, blocked, or marked with tokens
- The board must visually distinguish: normal squares, water squares, token squares (doors, portals, chests, exits)

### 6.2 Token Types

| Token | Category | Behaviour |
|-------|----------|-----------|
| Door | Obstacle | Locked / open / closed states; requires key or Locksmith proficiency |
| Portal | Obstacle | Can freeze, teleport, or transform a piece |
| Chest | Objective | Must be landed on; yields object, spell, key, or trap |
| Exit | Objective | Must be landed on; triggers scenario end or progression |

---

## 7. Units & Abilities

All units map from traditional chess pieces. Phase 1 must implement the full ability table from the rulebook:

### 7.1 Pawns (move in any direction)

| Unit | Species | Cost | Special |
|------|---------|------|---------|
| Hero | Human | 2 XP | Standard pawn movement in any direction |
| Skeleton | Undead | 2 XP | Standard pawn movement in any direction |
| Kobold | Redskin | 5 XP | Pawn movement + can cannon pawns |
| Goblin | Greenskin | 5 XP | Pawn movement + can cannon pawns |

### 7.2 Castles (Rooks)

| Unit | Species | Cost | Special |
|------|---------|------|---------|
| Stronghold | Human | 10 XP | Move 1 square only; attack as normal rook |
| Tomb | Undead | 10 XP | Move 1 square only; attack as normal rook |
| Iron Golem | Redskin | 15 XP | Move 1 square only, attack normal + cannon castles |
| Ogre | Greenskin | 15 XP | Move 1 square only, attack normal + cannon castles |

### 7.3 Bishops

| Unit | Species | Cost | Special |
|------|---------|------|---------|
| Archer | Human | 15 XP | Attack across gaps; cannot move across gaps |
| Wraith | Undead | 15 XP | Move across gaps; cannot attack across gaps |
| Fire Elemental | Redskin | 15 XP | Cannot move or attack across water |
| Troll | Greenskin | 15 XP | Cannot move or attack across water |

### 7.4 Queens (Magic Wielders)

| Unit | Species | Cost | Special |
|------|---------|------|---------|
| Wizard | Human | 20 XP | Attack as bishop; cannot move as bishop |
| Vampire | Undead | 20 XP | Move as bishop; cannot attack as bishop |
| Demonics | Redskin | 20 XP | Cannot attack across water |
| Shaman | Greenskin | 20 XP | Cannot attack across water |

### 7.5 Kings

| Unit | Species | Cost | Special |
|------|---------|------|---------|
| Princess | Human | 15 XP | Can also move as bishop |
| Warlock | Undead | 20 XP | Can also attack as bishop + wield magic |
| Red Dragon | Redskin | 20 XP | Can also attack as knight + wield magic |
| Warlord | Greenskin | 15 XP | Can also attack as knight |

### 7.6 Knights (Standard Cost: 15 XP)

Knight (Human), Reaper (Undead), Salamander (Redskin), Orc (Greenskin) — standard chess knight movement.

---

## 8. Card System

Cards are drafted during team setup and played during battle. Each species has its own card set.

### 8.1 Card Types

**Proficiencies** — attached to an entire set of pieces (faction-wide skills)

| Card | Cost | Effect |
|------|------|--------|
| Acrobatics | 5 XP | Use of Knight moves |
| Hand Combat | 10 XP | Use of Knight attacks |
| Archery | 15 XP | Use of ranged Bishop attacks |
| Locksmith | 20 XP | Ability to open locks |

**Objects** — attached to and used by a single piece

| Card | Cost | Effect |
|------|------|--------|
| Keys | 5 XP | Open locked doors |
| Longbow | 10 XP | Increased ranged attacks for archers |
| Winged Boots | 15 XP | Use of bishop moves |
| Wand | 20 XP | Enables non-magic wielders to use spells |

**Spells** — single use, only usable by magic wielders

| Card | Cost | Effect |
|------|------|--------|
| Fireball | 5 XP | Ranged castle attacks |
| Drain | 10 XP | Remove proficiencies from pieces within range |
| Lightning | 15 XP | Ranged bishop attacks |
| Teleport | 20 XP | Switch places with two pieces within range |

**Piece Cards** — used to attach other cards; one card per piece type (23 total).

### 8.2 Draft Constraints
- Max 3 cards total per player in Phase 1 Battles
- Cards must be attached to a piece card to be active
- Spell cards may only be activated by magic-wielding units

---

## 9. AI Opponent (Phase 1)

The AI must be functional and provide a meaningful challenge without requiring a full engine:

- **Difficulty:** Single difficulty level for Phase 1 (balanced/casual)
- **Behaviour:** Rule-aware — the AI respects all unit abilities, terrain constraints, and card effects
- **Decision-making:** Heuristic-based (capture > advance > protect king priority)
- **Drafting:** AI auto-drafts a valid team within the 75 XP budget
- **Turn time:** AI should "think" for 0.5–2 seconds for UX realism

Phase 2 will introduce difficulty tiers and potentially a stronger search-based engine.

---

## 10. UI / UX Requirements

### 10.1 Screens

| Screen | Description |
|--------|-------------|
| Home | Game title, Play vs AI CTA, rules reference link |
| Map Selection | Grid of pre-defined battle maps with previews |
| Species Selection | Pick your faction with flavour art and unit roster |
| Team Drafting | XP budget tracker, unit picker, card picker, validation |
| Battle Board | Main game screen — board, units, card hand, turn indicator |
| End Screen | Winner display, unit summary, play again / home |

### 10.2 Battle Board UI

- Modular board rendered in the centre with clear grid lines
- Tokens visually distinct (icons for door, portal, chest, exit)
- Water squares visually distinct (affects Fire Elemental, Troll, Demonics, Shaman)
- Selected unit highlights valid move squares and valid attack squares (colour-coded)
- Card hand shown at bottom of screen; cards activate when eligible unit is selected
- Turn indicator (Player / AI) clearly shown
- Captured pieces tray shown per player
- Move history panel (collapsible)

### 10.3 Accessibility
- Keyboard navigable board
- Colour-blind friendly square/token differentiation (icon + colour)
- Unit tooltips on hover showing name, species, abilities, cost

---

## 11. Tech Stack (Recommended)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React + TypeScript | Component-based, good for game state management |
| Game State | Zustand or Redux | Predictable state for turn-based logic |
| Rendering | HTML Canvas or SVG | Board + piece rendering; Canvas preferred for performance |
| AI | In-browser JS heuristics | No server needed for Phase 1 AI |
| Backend | None (Phase 1) | Stateless; all game logic client-side |
| Backend (Phase 2) | Node.js + WebSockets | Real-time multiplayer sessions |
| Styling | CSS Modules or Tailwind | Scoped styles, dungeon aesthetic |
| Hosting | Vercel / Netlify | Static deployment, fast CDN |

---

## 12. Phased Roadmap

### Phase 1 — Solo vs AI Battles
- [ ] Board rendering engine (modular sections, tokens, terrain)
- [ ] All 4 species, all unit types and abilities
- [ ] XP drafting system with card support
- [ ] Turn-based game loop with win/loss detection
- [ ] Basic AI opponent (heuristic)
- [ ] 3 pre-defined battle maps
- [ ] Home, draft, battle, and end screens

### Phase 2 — Online Multiplayer
- [ ] Account system (email or OAuth)
- [ ] Real-time 2-player battles via WebSockets
- [ ] Lobby / matchmaking
- [ ] 4-player battle support
- [ ] Custom map builder

### Phase 3 — Campaigns & Variants
- [ ] Solo campaign mode (story, progression, puzzles)
- [ ] Chess variant modes (Traditional, XingQi, Capablanca, etc.)
- [ ] Campaign master mode (1–6 players)

---

## 13. Open Questions

| # | Question | Owner |
|---|----------|-------|
| OQ1 | What are the exact win conditions for each pre-defined battle map? (appendixes TBD in rulebook) | Moddable Games |
| OQ2 | How does "cannon" movement work precisely for Kobold/Goblin/Iron Golem/Ogre? | Moddable Games |
| OQ3 | What does "doom and dust" mean as a chest outcome? | Moddable Games |
| OQ4 | How do portals interact with multi-piece abilities (e.g. teleport + freeze)? | Moddable Games |
| OQ5 | Are there any restrictions on which cards can attach to which piece types? | Moddable Games |
| OQ6 | What is the exact range definition for spell cards (e.g. Drain, Teleport)? | Moddable Games |
| OQ7 | Should AI drafting be visible/transparent to the player before battle starts? | Product |

---

## 14. Success Metrics (Phase 1)

| Metric | Target |
|--------|--------|
| Average session length | > 15 minutes |
| Draft-to-battle completion rate | > 80% |
| Player win rate vs AI | 40–60% (balanced) |
| Rules-related bug reports | < 5 per 100 sessions |

---

*This PRD will be updated as the rulebook matures and open questions are resolved. Version history tracked in Git.*