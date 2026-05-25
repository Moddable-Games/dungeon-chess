<p align="center">
  <img src="https://img.shields.io/badge/Phase-1%20Solo%20vs%20AI-b8860b?style=for-the-badge" alt="Phase 1">
  <img src="https://img.shields.io/badge/Platform-Desktop%20Web-1a1008?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/Players-2%20or%204-3d2415?style=for-the-badge" alt="Players">
</p>

<h1 align="center">
  <br>
  DUNGEON CHESS
  <br>
  <sub>Asymmetrical Skirmishes & Dungeon Crawling</sub>
</h1>

<p align="center">
  <em>Asymmetrical skirmishes & dungeon crawling.<br>Draft your warband. Explore the dungeon. Crush your enemies.</em>
</p>

---

## The Game

Dungeon Chess takes the timeless mechanics of chess and drops them into a dark, modular dungeon. Four fantasy species clash on interconnected board sections filled with water hazards, locked doors, and arcane portals.

Every species fights differently. Every battle plays out on a different map. Every team is drafted fresh from a shared XP budget.

### Species

| | Species | Style |
|---|---------|-------|
| **White** | Humans | Balanced — heroes, archers, and a wizard |
| **Black** | Undead | Movement trickery — wraiths cross gaps, vampires glide |
| **Red** | Redskins | Firepower — kobold cannons, iron golems, a dragon king |
| **Green** | Greenskins | Brute force — goblin swarms, ogre cannons, troll muscle |

### How It Works

```
1. Pick your map        →  Compact arena or sprawling dungeon cross
2. Choose your species  →  Each has unique unit abilities
3. Draft your team      →  75 XP budget, mix units and cards
4. Deploy your forces   →  Place pieces in your spawn zone
5. Battle               →  Turn-based combat, capture the enemy king
```

---

## Running Locally

Static HTML/CSS/JS — no build step, no dependencies.

```bash
# Serve from any web server. Example with Python:
python3 -m http.server 8000

# Or just open index.html from your local server
open http://localhost/MODDABLE/dungeon-chess/index.html
```

---

## Project Structure

```
dungeon-chess/
├── index.html              HTML shell — screens and layout
├── version.txt             Single-source version string
├── bump.sh                 Version bump script (propagates to all query strings)
├── css/
│   ├── fonts.css           Self-hosted font declarations
│   └── style.css           All styles, animations, transitions
├── js/
│   ├── data.js             Sprites, units, species, map definitions
│   ├── board-renderer.js   SVG board, dungeon surround, floor details
│   ├── state.js            Game state, navigation, draft/species screens
│   ├── mce-bridge.js       MCE integration — unit registration, game creation, state sync
│   ├── screens.js          Deployment/placement screen
│   ├── engine.js           Movement API (thin wrapper over MCE)
│   ├── battle.js           Battle setup, AI piece placement
│   ├── battle-draw.js      Board drawing, move animation, AI turns
│   └── ui.js               UI updates, light animation, event wiring
└── docs/
    ├── PRD_v0.1.md         Product requirements document
    └── RULESET.md          Master ruleset
```

---

## Features (Phase 1)

- **4 playable species** with distinct unit rosters and abilities
- **3 battle maps** — compact, two-player cross, four-player cross
- **XP-based drafting** — build your team within a 75 XP budget
- **Solo vs AI** — heuristic opponent that respects all game rules
- **Animated dungeon board** — stone textures, flickering torchlight, floating embers, water caustics
- **Piece move animations** — arc movement with capture burst effects
- **Modular architecture** — clean file separation, static/dynamic render split, canvas caching

## Roadmap

| Phase | Focus |
|-------|-------|
| **1** | Solo vs AI battles (current) |
| **2** | Online multiplayer via WebSockets |
| **3** | Campaign mode, chess variants |

See [open issues](https://github.com/Moddable-Games/moddable-chess/issues) for detailed next steps.

---

## Tech

Pure client-side JavaScript. No frameworks, no build tools, no runtime dependencies.

- **Engine:** [Moddable Chess Engine](https://github.com/Moddable-Games/moddable-chess) — shared engine with custom piece registration, multi-player ownership, terrain awareness
- **Rendering:** SVG board + HTML5 Canvas surround/lighting
- **State:** MCE owns board state; UI derives piece arrays for rendering
- **AI:** In-browser heuristic (capture > advance > protect)
- **Performance:** Static terrain layer cached, dynamic pieces rebuilt per move, canvas surround cached to offscreen bitmap

---

## Changelog

#### 2026-05-25
- Add version/cache-busting system: version.txt, bump.sh, query strings on all CSS/JS
- Display version in footer for deployment verification

#### 2026-05-24
- Replace engine.js with MCE consumption — all movement logic now delegated to Moddable Chess Engine
- Add mce-bridge.js: registers 22 unit types, creates MCE game state, syncs pieces
- MCE gains: multi-player ownership model (pieceData-based), terrain-aware slides, cannon/gapped-slide primitives
- Fix 4-player AI: now targets nearest enemy king instead of only player
- Self-host Google Fonts (Cinzel, Crimson Text) — no external CDN dependency
- Lock board tile size during battle to prevent log-induced layout shifts

#### 2026-05-21
- Undo, last-move highlight, auto-place, enhanced end screen with animations
- Keyboard navigation, unit tooltips, screen reader accessibility
- Post-game replay with transport controls and auto-play
- Turn order selection (player first / AI first / random)
- Master ruleset document (docs/RULESET.md)
- Rebrand to "Dungeon Chess" — new colour palette, logo, landing page, brand-aligned typography

#### 2026-05-19
- Initial release — 4 species, 3 maps, solo vs AI, animated dungeon board

---

<p align="center">
  <sub>A tabletop game by <strong>Moddable Games</strong> — digital edition</sub>
</p>
