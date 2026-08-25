'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// SKINS: registry of visual palettes. Each palette has the same length/index
// scheme as the original flat COLORS array (0 = empty, 1-8 = piece colors,
// 9 = bomb color), so BOMB_COLOR stays valid across every skin. `drawBlock`
// looks up colors via currentColors() instead of a fixed COLORS binding, and
// branches on `activeSkin` to pick a rendering style per skin. drawBombBlock,
// drawExplosion and drawGrid are intentionally shared/unchanged across skins.
const RETRO_COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
  '#ff6e40', // bomb ring color
];

const SKINS = {
  retro: {
    colors: RETRO_COLORS,
  },
  neon: {
    colors: [
      null,
      '#00f0ff', // I - electric cyan
      '#faff00', // O - electric yellow
      '#e000ff', // T - electric magenta
      '#00ff85', // S - electric green
      '#ff0044', // Z - electric red
      '#2979ff', // J - electric blue
      '#ff8800', // L - electric orange
      '#e0e0e0', // N - bright silver
      '#ff3d00', // bomb ring color
    ],
  },
  pastel: {
    colors: [
      null,
      '#b2ebf2', // I - soft cyan
      '#fff9c4', // O - soft yellow
      '#e1bee7', // T - soft purple
      '#c8e6c9', // S - soft green
      '#ffcdd2', // Z - soft red
      '#bbdefb', // J - soft blue
      '#ffe0b2', // L - soft orange
      '#eceff1', // N - soft gray
      '#ffab91', // bomb ring color
    ],
  },
  pixel: {
    // Same palette as retro — the pixel-art look comes from the texture
    // pattern drawn on top of the block, not from a different palette.
    colors: RETRO_COLORS,
  },
};

let activeSkin = 'retro';

function currentColors() {
  return SKINS[activeSkin].colors;
}

const BOMB_COLOR = RETRO_COLORS.length - 1;
const BOMB_LINES_INTERVAL = 5; // every N lines cleared, next spawn is a bomb
const BOMB_SCORE_PER_CELL = 20;
const EXPLOSION_DURATION = 300; // ms, fade-out of the blast flash

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, bombPending, explosion;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(forceBomb) {
  if (forceBomb) {
    return { type: 'bomb', isBomb: true, shape: [[BOMB_COLOR]], x: Math.floor(COLS / 2), y: 0 };
  }
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    const prevLines = lines;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (Math.floor(lines / BOMB_LINES_INTERVAL) > Math.floor(prevLines / BOMB_LINES_INTERVAL)) {
      bombPending = true;
    }
    updateHUD();
  }
}

function explodeBomb() {
  const cells = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
        board[ny][nx] = 0;
        cells.push({ x: nx, y: ny });
      }
    }
  }
  explosion = { cells, startTime: performance.now() };
  score += cells.length * BOMB_SCORE_PER_CELL;
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.isBomb) {
    explodeBomb();
  } else {
    merge();
  }
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece(bombPending);
  bombPending = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawRetroBlock(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawNeonBlock(context, x, y, color, size) {
  context.shadowBlur = 14;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.shadowBlur = 0; // must reset: shadow state persists across draw calls otherwise
  context.strokeStyle = '#ffffff';
  context.lineWidth = 1;
  context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
}

function drawPastelBlock(context, x, y, color, size) {
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;
  const radius = size * 0.2;
  context.fillStyle = color;
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(px, py, w, h, radius);
    context.fill();
  } else {
    context.fillRect(px, py, w, h);
  }
}

function drawPixelBlock(context, x, y, color, size) {
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;
  context.fillStyle = color;
  context.fillRect(px, py, w, h);
  // deterministic pixel-art texture: 3x3 sub-grid, alternating shade
  const sub = 3;
  const subW = w / sub;
  const subH = h / sub;
  for (let sr = 0; sr < sub; sr++) {
    for (let sc = 0; sc < sub; sc++) {
      context.fillStyle = (x + y + sr + sc) % 2 === 0
        ? 'rgba(255,255,255,0.10)'
        : 'rgba(0,0,0,0.10)';
      context.fillRect(px + sc * subW, py + sr * subH, subW, subH);
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  if (colorIndex === BOMB_COLOR) {
    drawBombBlock(context, x, y, size, alpha);
    return;
  }
  const color = currentColors()[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.shadowBlur = 0;
  switch (activeSkin) {
    case 'neon':
      drawNeonBlock(context, x, y, color, size);
      break;
    case 'pastel':
      drawPastelBlock(context, x, y, color, size);
      break;
    case 'pixel':
      drawPixelBlock(context, x, y, color, size);
      break;
    case 'retro':
    default:
      drawRetroBlock(context, x, y, color, size);
      break;
  }
  context.globalAlpha = 1;
}

function drawBombBlock(context, x, y, size, alpha) {
  context.shadowBlur = 0; // guard against a neon block leaving shadow state set
  const cx = x * size + size / 2;
  const cy = y * size + size / 2;
  const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 120);
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = '#2b2b2b';
  context.beginPath();
  context.arc(cx, cy, (size / 2 - 3) * pulse, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = currentColors()[BOMB_COLOR];
  context.stroke();
  context.strokeStyle = '#ffd54f';
  context.beginPath();
  context.moveTo(cx + size * 0.1, y * size + size * 0.18);
  context.lineTo(cx + size * 0.28, y * size + 2);
  context.stroke();
  context.globalAlpha = 1;
}

function drawExplosion() {
  if (!explosion) return;
  const elapsed = performance.now() - explosion.startTime;
  if (elapsed > EXPLOSION_DURATION) {
    explosion = null;
    return;
  }
  const t = elapsed / EXPLOSION_DURATION;
  ctx.globalAlpha = 1 - t;
  ctx.fillStyle = '#ffab40';
  for (const cell of explosion.cells) {
    const pad = t * (BLOCK / 2);
    ctx.fillRect(cell.x * BLOCK + pad, cell.y * BLOCK + pad, BLOCK - pad * 2, BLOCK - pad * 2);
  }
  ctx.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-line-color').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  drawExplosion();

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      if (gameOver) return;
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  bombPending = false;
  explosion = null;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  themeToggle.checked = theme === 'light';
  if (current) draw();
}

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem('theme', theme);
  applyTheme(theme);
});

function applySkin(skin) {
  activeSkin = SKINS[skin] ? skin : 'retro';
  skinSelect.value = activeSkin;
  if (current) {
    draw();
    drawNext();
  }
}

skinSelect.addEventListener('change', () => {
  const skin = skinSelect.value;
  localStorage.setItem('tetris-skin', skin);
  applySkin(skin);
});

// While the select is focused, its own arrow-key handling (cycling options)
// would otherwise also bubble up to the document keydown listener and drive
// gameplay (move/rotate/soft-drop) at the same time. Stop it at the source
// instead of touching the shared document listener.
skinSelect.addEventListener('keydown', e => e.stopPropagation());

applyTheme(localStorage.getItem('theme') || 'dark');
applySkin(localStorage.getItem('tetris-skin') || 'retro');

init();
