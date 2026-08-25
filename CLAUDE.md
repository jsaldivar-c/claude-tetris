# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript with HTML5 Canvas. No dependencies, no build process, no package.json — just three files: `index.html`, `style.css`, `game.js`.

## Running the game

There is no build/lint/test tooling. To run:

```bash
start index.html        # Windows: open directly in browser
# or serve statically, e.g.:
npx serve .
python3 -m http.server 8000
```

Verify changes by opening the page in a browser and playing; there are no automated tests.

## Architecture

All game logic lives in the single file `game.js` (~300 lines), driven by a `requestAnimationFrame` loop. Key pieces:

- **Board model**: `board` is a `ROWS × COLS` (20×10) matrix of cells; each cell is `0` (empty) or a piece-color index `1–8`.
- **Pieces**: `PIECES` defines the 7 standard tetrominoes plus a challenge piece `N` ("tuerca") — a 3×3 ring with an empty center cell — as square matrices (color index per cell, `0` = empty within the shape). `randomPiece()` deep-copies a shape and spawns it centered at the top; the type range is derived from `PIECES.length` so adding pieces doesn't require touching this logic. Rotation (`rotateCW`) is a transpose + row-reverse; `tryRotate()` applies it with wall-kick offsets `[0, -1, 1, -2, 2]`, taking the first offset that doesn't collide. Since collision/merge/render code already treats `0` as an empty cell within a piece's bounding box (as with the corners of T/S/Z/J/L), the `N` piece's hole needs no special-case code — once locked, its center cell is permanently enclosed by its own blocks, so that board row can't be completed until surrounding rows clear and shift it.
- **Collision** (`collide`): checks board bounds and overlap with already-locked cells for a given shape/offset.
- **Game loop** (`loop`): accumulates elapsed time each frame; once `dropAccum >= dropInterval`, the piece drops one row (or locks if blocked), then `draw()` renders board + ghost piece + current piece.
- **Locking a piece** (`lockPiece`): `merge()` writes the piece into `board`, then `clearLines()` removes completed rows (scanning bottom-up, re-checking the same row index after a splice/unshift), then `spawn()` promotes `next` to `current` and generates a new `next`. If the newly spawned piece immediately collides, `endGame()` fires.
- **Scoring/leveling**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/row dropped, soft drop adds 1 pt/row. `level = startLevel + floor(lines/10)` (so `level` increments every 10 lines, offset by whatever starting level was chosen in the pause menu); `dropInterval = dropIntervalForLevel(level)`, i.e. `max(100, 1000 - (level-1)*90)` ms — the same helper is used both in `clearLines()` and `init()` so the two never drift apart.
- **Ghost piece** (`ghostY`): projects the current piece straight down until it would collide, drawn at `globalAlpha = 0.2`.
- **Bomb power-up**: `clearLines()` compares `floor(lines / BOMB_LINES_INTERVAL)` before/after incrementing `lines` and sets `bombPending` when it crosses a multiple (every 5 lines by default). `spawn()` consumes that flag via `randomPiece(bombPending)` to generate the *next* piece as a bomb — a single-cell shape `[[BOMB_COLOR]]` (`BOMB_COLOR` is the last `COLORS` index), rendered with a pulsing circle (`drawBombBlock`) instead of a normal block. `lockPiece()` routes a bomb (`current.isBomb`) to `explodeBomb()` instead of `merge()`: it zeroes out the 3×3 area centered on the bomb's landed `(x, y)` (clamped to board bounds), awards `BOMB_SCORE_PER_CELL` points per cleared cell, and records the affected cells in `explosion` so `draw()` renders a fading flash (`drawExplosion`, `EXPLOSION_DURATION` ms) before continuing to `clearLines()`/`spawn()` as usual. The bomb never gets merged into `board`, so it can't itself become a stuck/unclearable cell.
- **Global mutable state**: `board, current, next, score, lines, level, startLevel, paused, gameOver, lastTime, dropAccum, dropInterval, animId` are module-level `let` bindings reset by `init()` (also wired to the restart button).
- **Input**: a single `keydown` listener dispatches on `e.code` (arrows, `KeyX` rotate, `Space` hard drop, `KeyP`/`Escape` pause); ignored while paused or game over (except unpause).
- **Pause menu**: `KeyP` and `Escape` both call `togglePause()`, which shows/hides a dedicated `#pause-overlay` (separate element from the game-over `#overlay`) and cancels/restarts the `requestAnimationFrame` loop; `paused` stays `true` for the overlay's entire visible lifetime, so the existing `if (paused || gameOver) return;` guard in the keydown listener blocks all other game input while it's open. The menu offers Reanudar (same resume path as the keys), Reiniciar (`init()`), a "Ver controles" toggle that expands an inline copy of the keybinding list, and a starting-level `<select>` (1–9) whose value is persisted to `localStorage` under `tetris-start-level` and read back by `init()` via `getStartLevel()` to set `startLevel`/`level`/`dropInterval` for a fresh game.

`index.html` holds two canvases (`#board` 300×600, `#next-canvas` 120×120), the score/lines/level panel, a `#overlay` for **GAME OVER**, and a separate `#pause-overlay` for the pause menu. `style.css` provides the dark/retro styling.

### Tunable constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`, `BOMB_LINES_INTERVAL`, `BOMB_SCORE_PER_CELL`, `EXPLOSION_DURATION`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS×BLOCK` by `ROWS×BLOCK`).

The README (in Spanish) has additional detail and is kept in sync with this architecture description — update both if the game logic changes structurally.
