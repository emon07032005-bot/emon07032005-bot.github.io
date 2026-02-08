const LEVELS = [
  { id: 1, name: "Desert Dawn", rows: 5, colors: 3, thresholds: [5000, 8000, 12000] },
  { id: 2, name: "Oasis Dreams", rows: 6, colors: 3, thresholds: [6000, 10000, 15000] },
  { id: 3, name: "Magic Carpet", rows: 6, colors: 4, thresholds: [7000, 12000, 18000] },
  { id: 4, name: "Golden Palace", rows: 7, colors: 4, thresholds: [8000, 14000, 20000] },
  { id: 5, name: "Genie's Lamp", rows: 7, colors: 5, thresholds: [9000, 16000, 24000] },
  { id: 6, name: "Starry Night", rows: 8, colors: 5, thresholds: [10000, 18000, 28000] },
  { id: 7, name: "Sultan's Treasure", rows: 8, colors: 5, thresholds: [11000, 20000, 32000] },
  { id: 8, name: "Arabian Nights", rows: 9, colors: 6, thresholds: [12000, 22000, 36000] },
  { id: 9, name: "Mystic Mirage", rows: 9, colors: 6, thresholds: [13000, 24000, 40000] },
  { id: 10, name: "Genie Master", rows: 10, colors: 6, thresholds: [15000, 28000, 45000] }
];

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#eab308", "#a855f7", "#06b6d4"];
const STORAGE_KEY = "genieBubbleProgress";
const SOUND_KEY = "genieBubbleSound";

const elements = {
  homeScreen: document.getElementById("home-screen"),
  levelScreen: document.getElementById("level-screen"),
  gameScreen: document.getElementById("game-screen"),
  levelsGrid: document.getElementById("levels-grid"),
  playButton: document.getElementById("play-button"),
  levelsBack: document.getElementById("levels-back"),
  gameBack: document.getElementById("game-back"),
  levelName: document.getElementById("level-name"),
  scoreDisplay: document.getElementById("score-display"),
  starDisplay: document.getElementById("star-display"),
  nextBubble: document.getElementById("next-bubble"),
  canvas: document.getElementById("game-canvas"),
  soundToggle: document.getElementById("sound-toggle"),
  levelCompleteModal: document.getElementById("level-complete-modal"),
  completeSubtitle: document.getElementById("complete-subtitle"),
  completeStars: document.getElementById("complete-stars"),
  completeScore: document.getElementById("complete-score"),
  nextLevelButton: document.getElementById("next-level"),
  retryLevelButton: document.getElementById("retry-level"),
  levelsButton: document.getElementById("levels-button"),
  gameOverModal: document.getElementById("game-over-modal"),
  gameOverScore: document.getElementById("gameover-score"),
  gameOverRetry: document.getElementById("gameover-retry"),
  gameOverLevels: document.getElementById("gameover-levels")
};

const state = {
  progress: loadProgress(),
  currentLevel: LEVELS[0],
  score: 0,
  stars: 0,
  gameActive: false,
  grid: [],
  currentBubble: null,
  nextBubble: null,
  projectile: null,
  aimAngle: -Math.PI / 2,
  aiming: false,
  shooter: { x: 0, y: 0 },
  bubbleRadius: 20,
  gridOffsetX: 12,
  gridOffsetY: 32,
  canvasWidth: 0,
  canvasHeight: 0,
  animationId: null
};

function loadProgress() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return {
    unlocked: [1],
    stars: {},
    highScores: {}
  };
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function showScreen(screen) {
  [elements.homeScreen, elements.levelScreen, elements.gameScreen].forEach((node) => {
    node.classList.remove("screen--active");
  });
  screen.classList.add("screen--active");
}

function renderLevels() {
  elements.levelsGrid.innerHTML = "";
  LEVELS.forEach((level) => {
    const card = document.createElement("button");
    card.className = "level-card";
    card.dataset.testid = `level-${level.id}`;
    const unlocked = state.progress.unlocked.includes(level.id);
    if (!unlocked) {
      card.classList.add("locked");
    }

    const starsEarned = state.progress.stars[level.id] || 0;
    card.innerHTML = `
      <div class="level-number">${level.id}</div>
      <div class="level-name">${level.name}</div>
      <div class="level-stars">
        ${[1, 2, 3]
          .map(
            (star) =>
              `<span class="${star <= starsEarned ? "active" : ""}">★</span>`
          )
          .join("")}
      </div>
    `;

    card.addEventListener("click", () => {
      if (!unlocked) return;
      startLevel(level.id);
    });

    elements.levelsGrid.appendChild(card);
  });
}

function updateScore(value) {
  state.score = value;
  elements.scoreDisplay.textContent = value.toLocaleString();
}

function updateStarsDisplay(stars) {
  elements.starDisplay.innerHTML = [1, 2, 3]
    .map((star) => `<span class="${star <= stars ? "active" : ""}">★</span>`)
    .join("");
}

function updateNextBubble() {
  if (!state.nextBubble) return;
  elements.nextBubble.style.background = state.nextBubble.color;
}

function startLevel(levelId) {
  const level = LEVELS.find((entry) => entry.id === levelId);
  if (!level) return;
  state.currentLevel = level;
  state.score = 0;
  state.stars = state.progress.stars[levelId] || 0;
  updateScore(0);
  updateStarsDisplay(state.stars);
  elements.levelName.textContent = `${level.id}. ${level.name}`;
  showScreen(elements.gameScreen);
  initCanvas();
  initGame();
}

function initCanvas() {
  const rect = elements.canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  elements.canvas.width = rect.width * ratio;
  elements.canvas.height = rect.height * ratio;
  const ctx = elements.canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  state.canvasWidth = rect.width;
  state.canvasHeight = rect.height;
  state.bubbleRadius = Math.max(16, Math.min(22, rect.width / 16));
  state.gridOffsetX = 12;
  state.gridOffsetY = 16;
  state.shooter = { x: rect.width / 2, y: rect.height - 80 };
}

function initGame() {
  state.grid = generateGrid();
  state.currentBubble = createBubble();
  state.nextBubble = createBubble();
  state.projectile = null;
  state.gameActive = true;
  updateNextBubble();
  startLoop();
}

function generateGrid() {
  const grid = [];
  const maxCols = Math.floor(
    (state.canvasWidth - state.gridOffsetX * 2) / (state.bubbleRadius * 2)
  );
  const colorSet = COLORS.slice(0, state.currentLevel.colors);
  for (let row = 0; row < state.currentLevel.rows; row += 1) {
    const rowCols = row % 2 === 0 ? maxCols : maxCols - 1;
    grid[row] = [];
    for (let col = 0; col < rowCols; col += 1) {
      grid[row][col] = {
        row,
        col,
        color: colorSet[Math.floor(Math.random() * colorSet.length)]
      };
    }
  }
  return grid;
}

function createBubble() {
  const colorSet = COLORS.slice(0, state.currentLevel.colors);
  return {
    color: colorSet[Math.floor(Math.random() * colorSet.length)]
  };
}

function startLoop() {
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
  }
  const ctx = elements.canvas.getContext("2d");
  const loop = () => {
    updateGame();
    drawGame(ctx);
    state.animationId = requestAnimationFrame(loop);
  };
  loop();
}

function updateGame() {
  if (!state.gameActive) return;
  if (state.projectile) {
    state.projectile.x += state.projectile.vx;
    state.projectile.y += state.projectile.vy;
    if (
      state.projectile.x - state.bubbleRadius <= 0 ||
      state.projectile.x + state.bubbleRadius >= state.canvasWidth
    ) {
      state.projectile.vx *= -1;
    }
    const hit = checkCollision(state.projectile);
    if (hit) {
      attachBubble(state.projectile);
      state.projectile = null;
      state.currentBubble = state.nextBubble;
      state.nextBubble = createBubble();
      updateNextBubble();
    }
  }
}

function checkCollision(projectile) {
  if (projectile.y - state.bubbleRadius <= state.gridOffsetY) {
    return true;
  }
  for (let row = 0; row < state.grid.length; row += 1) {
    for (let col = 0; col < state.grid[row].length; col += 1) {
      const bubble = state.grid[row][col];
      if (!bubble) continue;
      const { x, y } = getBubblePosition(row, col);
      const distance = Math.hypot(projectile.x - x, projectile.y - y);
      if (distance < state.bubbleRadius * 2 - 2) {
        return true;
      }
    }
  }
  return false;
}

function attachBubble(projectile) {
  const { row, col } = findNearestSlot(projectile.x, projectile.y);
  if (!state.grid[row]) {
    state.grid[row] = [];
  }
  if (state.grid[row][col]) {
    const fallback = findNearestFreeSlot(row, col);
    state.grid[fallback.row][fallback.col] = {
      row: fallback.row,
      col: fallback.col,
      color: projectile.color
    };
  } else {
    state.grid[row][col] = { row, col, color: projectile.color };
  }

  const matches = findMatches(row, col, projectile.color);
  if (matches.length >= 3) {
    matches.forEach((match) => {
      state.grid[match.row][match.col] = null;
    });
    const points = matches.length * 120;
    updateScore(state.score + points);
    removeFloating();
  }
  checkGameState();
}

function findNearestSlot(x, y) {
  const rowHeight = state.bubbleRadius * 1.7;
  let row = Math.round((y - state.gridOffsetY) / rowHeight);
  row = Math.max(0, row);
  const isOdd = row % 2 === 1;
  const offset = isOdd ? state.bubbleRadius : 0;
  let col = Math.round((x - state.gridOffsetX - offset) / (state.bubbleRadius * 2));
  col = Math.max(0, col);
  return { row, col };
}

function findNearestFreeSlot(row, col) {
  const directions = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]
  ];
  for (const [dr, dc] of directions) {
    const newRow = Math.max(0, row + dr);
    const newCol = Math.max(0, col + dc);
    if (!state.grid[newRow]) {
      state.grid[newRow] = [];
    }
    if (!state.grid[newRow][newCol]) {
      return { row: newRow, col: newCol };
    }
  }
  return { row, col };
}

function findMatches(startRow, startCol, color) {
  const queue = [{ row: startRow, col: startCol }];
  const visited = new Set();
  const matches = [];
  while (queue.length) {
    const { row, col } = queue.shift();
    const key = `${row}-${col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const bubble = state.grid[row]?.[col];
    if (!bubble || bubble.color !== color) continue;
    matches.push({ row, col });
    getNeighbors(row, col).forEach((neighbor) => {
      if (!visited.has(`${neighbor.row}-${neighbor.col}`)) {
        queue.push(neighbor);
      }
    });
  }
  return matches;
}

function getNeighbors(row, col) {
  const odd = row % 2 === 1;
  const deltas = [
    { r: -1, c: odd ? 0 : -1 },
    { r: -1, c: odd ? 1 : 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
    { r: 1, c: odd ? 0 : -1 },
    { r: 1, c: odd ? 1 : 0 }
  ];
  return deltas
    .map(({ r, c }) => ({ row: row + r, col: col + c }))
    .filter((pos) => pos.row >= 0 && pos.col >= 0 && state.grid[pos.row]);
}

function removeFloating() {
  const connected = new Set();
  const queue = [];
  if (state.grid[0]) {
    state.grid[0].forEach((bubble, col) => {
      if (bubble) queue.push({ row: 0, col });
    });
  }

  while (queue.length) {
    const { row, col } = queue.shift();
    const key = `${row}-${col}`;
    if (connected.has(key)) continue;
    connected.add(key);
    getNeighbors(row, col).forEach((neighbor) => {
      if (state.grid[neighbor.row]?.[neighbor.col] && !connected.has(`${neighbor.row}-${neighbor.col}`)) {
        queue.push(neighbor);
      }
    });
  }

  let cleared = 0;
  state.grid.forEach((row, rowIndex) => {
    row.forEach((bubble, colIndex) => {
      if (bubble && !connected.has(`${rowIndex}-${colIndex}`)) {
        state.grid[rowIndex][colIndex] = null;
        cleared += 1;
      }
    });
  });

  if (cleared > 0) {
    updateScore(state.score + cleared * 60);
  }
}

function checkGameState() {
  let bubblesLeft = 0;
  let danger = false;
  for (let row = 0; row < state.grid.length; row += 1) {
    for (let col = 0; col < state.grid[row].length; col += 1) {
      const bubble = state.grid[row][col];
      if (bubble) {
        bubblesLeft += 1;
        const { y } = getBubblePosition(row, col);
        if (y + state.bubbleRadius >= state.shooter.y - 10) {
          danger = true;
        }
      }
    }
  }

  if (bubblesLeft === 0) {
    completeLevel();
  } else if (danger) {
    endGame();
  }
}

function drawGame(ctx) {
  ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
  drawGrid(ctx);
  drawShooter(ctx);
  if (state.projectile) {
    drawBubble(ctx, state.projectile.x, state.projectile.y, state.projectile.color);
  }
  if (state.aiming) {
    drawAimLine(ctx);
  }
}

function drawGrid(ctx) {
  for (let row = 0; row < state.grid.length; row += 1) {
    for (let col = 0; col < state.grid[row].length; col += 1) {
      const bubble = state.grid[row][col];
      if (!bubble) continue;
      const { x, y } = getBubblePosition(row, col);
      drawBubble(ctx, x, y, bubble.color);
    }
  }
}

function drawShooter(ctx) {
  if (!state.currentBubble || state.projectile) return;
  drawBubble(ctx, state.shooter.x, state.shooter.y, state.currentBubble.color);
}

function drawBubble(ctx, x, y, color) {
  const radius = state.bubbleRadius;
  const gradient = ctx.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.3,
    radius * 0.2,
    x,
    y,
    radius
  );
  gradient.addColorStop(0, lighten(color, 35));
  gradient.addColorStop(0.7, color);
  gradient.addColorStop(1, darken(color, 20));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fill();
}

function drawAimLine(ctx) {
  const length = 140;
  const endX = state.shooter.x + Math.cos(state.aimAngle) * length;
  const endY = state.shooter.y + Math.sin(state.aimAngle) * length;
  ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(state.shooter.x, state.shooter.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);
}

function getBubblePosition(row, col) {
  const rowHeight = state.bubbleRadius * 1.7;
  const offset = row % 2 === 1 ? state.bubbleRadius : 0;
  return {
    x: state.gridOffsetX + col * state.bubbleRadius * 2 + offset,
    y: state.gridOffsetY + row * rowHeight
  };
}

function lighten(color, percent) {
  const num = parseInt(color.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, (num >> 16) + amt);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const b = Math.min(255, (num & 0x0000ff) + amt);
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function darken(color, percent) {
  const num = parseInt(color.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, (num >> 16) - amt);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const b = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function handlePointerDown(event) {
  if (!state.gameActive || state.projectile) return;
  state.aiming = true;
  updateAim(event);
}

function handlePointerMove(event) {
  if (!state.aiming) return;
  updateAim(event);
}

function handlePointerUp() {
  if (!state.aiming || !state.gameActive || state.projectile) return;
  state.aiming = false;
  shoot();
}

function updateAim(event) {
  const rect = elements.canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let angle = Math.atan2(y - state.shooter.y, x - state.shooter.x);
  const min = -Math.PI + Math.PI / 8;
  const max = -Math.PI / 8;
  angle = Math.max(min, Math.min(max, angle));
  state.aimAngle = angle;
}

function shoot() {
  const speed = 10;
  state.projectile = {
    x: state.shooter.x,
    y: state.shooter.y,
    vx: Math.cos(state.aimAngle) * speed,
    vy: Math.sin(state.aimAngle) * speed,
    color: state.currentBubble.color
  };
}

function completeLevel() {
  state.gameActive = false;
  const starsEarned = calculateStars(state.score, state.currentLevel.thresholds);
  state.stars = starsEarned;
  state.progress.stars[state.currentLevel.id] = Math.max(
    state.progress.stars[state.currentLevel.id] || 0,
    starsEarned
  );
  state.progress.highScores[state.currentLevel.id] = Math.max(
    state.progress.highScores[state.currentLevel.id] || 0,
    state.score
  );

  const nextLevelId = state.currentLevel.id + 1;
  if (!state.progress.unlocked.includes(nextLevelId) && nextLevelId <= LEVELS.length) {
    state.progress.unlocked.push(nextLevelId);
  }
  saveProgress();

  updateStarsDisplay(starsEarned);
  elements.completeSubtitle.textContent = `Level ${state.currentLevel.id} - ${state.currentLevel.name}`;
  elements.completeScore.textContent = state.score.toLocaleString();
  elements.completeStars.innerHTML = [1, 2, 3]
    .map((star) => `<span class="${star <= starsEarned ? "active" : ""}">★</span>`)
    .join("");
  elements.nextLevelButton.style.display = nextLevelId <= LEVELS.length ? "inline-flex" : "none";
  elements.levelCompleteModal.classList.add("show");
}

function endGame() {
  state.gameActive = false;
  elements.gameOverScore.textContent = state.score.toLocaleString();
  elements.gameOverModal.classList.add("show");
}

function calculateStars(score, thresholds) {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

function closeModals() {
  elements.levelCompleteModal.classList.remove("show");
  elements.gameOverModal.classList.remove("show");
}

function resetLevel() {
  closeModals();
  startLevel(state.currentLevel.id);
}

function handleNextLevel() {
  closeModals();
  const nextId = state.currentLevel.id + 1;
  if (nextId <= LEVELS.length) {
    startLevel(nextId);
  } else {
    showScreen(elements.levelScreen);
  }
}

function toggleSound() {
  const current = localStorage.getItem(SOUND_KEY) || "on";
  const next = current === "on" ? "off" : "on";
  localStorage.setItem(SOUND_KEY, next);
  elements.soundToggle.textContent = next === "on" ? "🔊" : "🔇";
}

function applySoundPreference() {
  const current = localStorage.getItem(SOUND_KEY) || "on";
  elements.soundToggle.textContent = current === "on" ? "🔊" : "🔇";
}

function attachEventListeners() {
  elements.playButton.addEventListener("click", () => {
    renderLevels();
    showScreen(elements.levelScreen);
  });
  elements.levelsBack.addEventListener("click", () => showScreen(elements.homeScreen));
  elements.gameBack.addEventListener("click", () => {
    closeModals();
    showScreen(elements.levelScreen);
  });
  elements.nextLevelButton.addEventListener("click", handleNextLevel);
  elements.retryLevelButton.addEventListener("click", resetLevel);
  elements.levelsButton.addEventListener("click", () => {
    closeModals();
    showScreen(elements.levelScreen);
  });
  elements.gameOverRetry.addEventListener("click", resetLevel);
  elements.gameOverLevels.addEventListener("click", () => {
    closeModals();
    showScreen(elements.levelScreen);
  });
  elements.soundToggle.addEventListener("click", toggleSound);

  elements.canvas.addEventListener("mousedown", handlePointerDown);
  elements.canvas.addEventListener("mousemove", handlePointerMove);
  elements.canvas.addEventListener("mouseup", handlePointerUp);
  elements.canvas.addEventListener("mouseleave", handlePointerUp);
  elements.canvas.addEventListener("touchstart", handlePointerDown);
  elements.canvas.addEventListener("touchmove", handlePointerMove);
  elements.canvas.addEventListener("touchend", handlePointerUp);

  window.addEventListener("resize", () => {
    if (!state.gameActive) return;
    initCanvas();
  });
}

function init() {
  applySoundPreference();
  attachEventListeners();
  renderLevels();
  showScreen(elements.homeScreen);
}

init();
