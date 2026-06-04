const STORAGE_KEY = "loto-online-premium-state-v1";
const MAX_NUMBER = 90;
const SPEEDS = {
  slow: 4.2,
  normal: 2.6,
  fast: 1.2
};

const state = {
  screen: "home",
  host: {
    pool: [],
    called: [],
    current: null,
    speed: "normal",
    intervalSeconds: SPEEDS.normal,
    running: false,
    timer: null,
    cardCount: 4,
    cards: []
  },
  player: {
    cardCount: 4,
    cards: [],
    markedNumbers: []
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  restoreState();
  render();
  showScreen(state.screen);
  registerServiceWorker();
});

function bindEvents() {
  $$("[data-screen-link]").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screenLink));
  });
  $$("[data-action='home']").forEach((button) => {
    button.addEventListener("click", () => showScreen("home"));
  });

  $("#start-draw").addEventListener("click", startDraw);
  $("#pause-draw").addEventListener("click", pauseDraw);
  $("#resume-draw").addEventListener("click", resumeDraw);
  $("#reset-draw").addEventListener("click", resetHostGame);
  $("#clear-called").addEventListener("click", clearCalledNumbers);
  $("#generate-host-cards").addEventListener("click", generateHostCards);
  $("#check-host-win").addEventListener("click", checkHostWin);
  $("#speed-select").addEventListener("change", updateHostSettings);
  $("#speed-range").addEventListener("input", updateCustomSpeed);
  $("#host-card-count").addEventListener("change", updateHostSettings);

  $("#generate-player-cards").addEventListener("click", generatePlayerCards);
  $("#find-number").addEventListener("click", findPlayerNumber);
  $("#clear-player-marks").addEventListener("click", clearPlayerMarks);
  $("#player-card-count").addEventListener("change", updatePlayerSettings);
  $("#manual-number").addEventListener("keydown", (event) => {
    if (event.key === "Enter") findPlayerNumber();
  });
}

function showScreen(screen) {
  state.screen = screen;
  if (screen === "host" && state.host.cards.length === 0) {
    generateCardsFor("host", state.host.cardCount, false);
  }
  if (screen === "cards" && state.player.cards.length === 0) {
    generateCardsFor("player", state.player.cardCount, false);
  }

  $$(".screen").forEach((section) => {
    section.classList.toggle("hidden", section.dataset.screen !== screen);
  });

  if (screen !== "host") pauseDraw();
  render();
  saveState();
}

function createNumberPool() {
  return Array.from({ length: MAX_NUMBER }, (_, index) => index + 1);
}

function ensureHostPool() {
  if (state.host.pool.length === 0 && state.host.called.length === 0) {
    state.host.pool = createNumberPool();
  }
}

function startDraw() {
  ensureHostPool();
  if (state.host.running) return;
  drawNextNumber();
  scheduleNextDraw();
}

function pauseDraw() {
  if (state.host.timer) {
    clearInterval(state.host.timer);
    state.host.timer = null;
  }
  state.host.running = false;
  saveState();
}

function resumeDraw() {
  ensureHostPool();
  if (state.host.pool.length === 0 || state.host.running) return;
  scheduleNextDraw();
}

function scheduleNextDraw() {
  pauseDraw();
  state.host.running = true;
  state.host.timer = setInterval(drawNextNumber, getHostIntervalMs());
  saveState();
}

function drawNextNumber() {
  ensureHostPool();
  if (state.host.pool.length === 0) {
    pauseDraw();
    return;
  }

  const index = Math.floor(Math.random() * state.host.pool.length);
  const number = state.host.pool.splice(index, 1)[0];
  state.host.current = number;
  state.host.called.push(number);
  speakNumber(number);
  renderHost();
  saveState();
}

function resetHostGame() {
  pauseDraw();
  state.host.pool = createNumberPool();
  state.host.called = [];
  state.host.current = null;
  state.host.cards.forEach((card) => {
    card.manualMarks = [];
  });
  $("#host-win-result").textContent = "";
  renderHost();
  saveState();
}

function clearCalledNumbers() {
  resetHostGame();
}

function updateHostSettings() {
  state.host.speed = $("#speed-select").value;
  if (state.host.speed !== "custom") {
    state.host.intervalSeconds = SPEEDS[state.host.speed];
  }
  state.host.cardCount = Number.parseInt($("#host-card-count").value, 10);
  syncSpeedControls();
  if (state.host.running) scheduleNextDraw();
  saveState();
}

function updateCustomSpeed() {
  state.host.speed = "custom";
  state.host.intervalSeconds = sanitizeInterval($("#speed-range").value);
  syncSpeedControls();
  if (state.host.running) scheduleNextDraw();
  saveState();
}

function updatePlayerSettings() {
  state.player.cardCount = Number.parseInt($("#player-card-count").value, 10);
  saveState();
}

function generateHostCards() {
  updateHostSettings();
  generateCardsFor("host", state.host.cardCount, true);
}

function generatePlayerCards() {
  updatePlayerSettings();
  state.player.markedNumbers = [];
  generateCardsFor("player", state.player.cardCount, true);
}

function generateCardsFor(mode, count, shouldRender = true) {
  const cards = Array.from({ length: clampCount(count) }, (_, index) => createLotoCard(index + 1));
  if (mode === "host") {
    state.host.cards = cards;
  } else {
    state.player.cards = cards;
  }
  if (shouldRender) {
    render();
    saveState();
  }
}

function createLotoCard(number) {
  const mask = createMask();
  const values = Array.from({ length: 3 }, () => Array(9).fill(null));
  const ranges = [
    [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
    [50, 59], [60, 69], [70, 79], [80, 90]
  ];

  for (let col = 0; col < 9; col += 1) {
    const rows = [0, 1, 2].filter((row) => mask[row][col]);
    const columnNumbers = shuffle(range(ranges[col][0], ranges[col][1]))
      .slice(0, rows.length)
      .sort((a, b) => a - b);

    rows.sort((a, b) => a - b).forEach((row, index) => {
      values[row][col] = columnNumbers[index];
    });
  }

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: `Карточка ${number}`,
    numbers: values,
    manualMarks: []
  };
}

function createMask() {
  const mask = Array.from({ length: 3 }, () => Array(9).fill(false));
  for (let row = 0; row < 3; row += 1) {
    shuffle(range(0, 8)).slice(0, 5).forEach((col) => {
      mask[row][col] = true;
    });
  }
  return mask;
}

function findPlayerNumber() {
  const input = $("#manual-number");
  const number = Number.parseInt(input.value, 10);
  if (!Number.isInteger(number) || number < 1 || number > MAX_NUMBER) {
    input.value = "";
    return;
  }
  if (!state.player.markedNumbers.includes(number)) {
    state.player.markedNumbers.push(number);
  }
  input.value = "";
  renderPlayerCards();
  saveState();
}

function clearPlayerMarks() {
  state.player.markedNumbers = [];
  state.player.cards.forEach((card) => {
    card.manualMarks = [];
  });
  renderPlayerCards();
  saveState();
}

function toggleCardCell(mode, cardId, value) {
  const cards = mode === "host" ? state.host.cards : state.player.cards;
  const card = cards.find((item) => item.id === cardId);
  if (!card) return;

  card.manualMarks = sanitizeNumberList(card.manualMarks);
  if (card.manualMarks.includes(value)) {
    card.manualMarks = card.manualMarks.filter((number) => number !== value);
  } else {
    card.manualMarks.push(value);
  }

  $("#host-win-result").textContent = "";
  render();
  saveState();
}

function checkHostWin() {
  const winners = [];
  state.host.cards.forEach((card) => {
    card.numbers.forEach((row, rowIndex) => {
      const rowNumbers = row.filter((value) => value !== null);
      if (rowNumbers.length === 5 && rowNumbers.every((value) => state.host.called.includes(value))) {
        winners.push(`${card.title}, строка ${rowIndex + 1}`);
      }
    });
  });

  const result = $("#host-win-result");
  if (winners.length === 0) {
    result.textContent = "Пока нет закрытой строки.";
    result.classList.remove("success");
    return;
  }

  result.textContent = `Выигрыш: ${winners.join("; ")}.`;
  result.classList.add("success");
}

function render() {
  renderHost();
  renderPlayer();
}

function renderHost() {
  $("#current-number").textContent = state.host.current ?? "--";
  $("#numbers-left").textContent = String(state.host.pool.length || (state.host.called.length ? 0 : MAX_NUMBER));
  $("#called-count").textContent = String(state.host.called.length);
  $("#speed-select").value = state.host.speed;
  $("#host-card-count").value = String(state.host.cardCount);
  syncSpeedControls();
  renderCalledNumbers();
  renderCards("#host-cards", state.host.cards, state.host.called, "host");
  flashCurrentNumber();
}

function renderPlayer() {
  $("#player-card-count").value = String(state.player.cardCount);
  renderPlayerCards();
}

function renderPlayerCards() {
  renderCards("#player-cards", state.player.cards, state.player.markedNumbers, "player");
}

function renderCalledNumbers() {
  const list = $("#called-list");
  list.innerHTML = "";
  state.host.called.forEach((number, index) => {
    const chip = document.createElement("span");
    chip.className = "number-chip";
    chip.textContent = String(number);
    if (index >= state.host.called.length - 3) chip.classList.add("marked");
    list.appendChild(chip);
  });
}

function renderCards(selector, cards, markedNumbers, mode) {
  const container = $(selector);
  container.innerHTML = "";
  cards.forEach((card) => {
    card.manualMarks = sanitizeNumberList(card.manualMarks);
    const cardMarks = getCardMarks(card, markedNumbers);
    const article = document.createElement("article");
    article.className = "loto-card";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = card.title;

    const grid = document.createElement("div");
    grid.className = "ticket-grid";
    card.numbers.flat().forEach((value) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "ticket-cell";
      if (value === null) {
        cell.classList.add("empty");
        cell.disabled = true;
      } else {
        cell.textContent = String(value);
        if (cardMarks.includes(value)) cell.classList.add("marked");
        cell.addEventListener("click", () => toggleCardCell(mode, card.id, value));
      }
      grid.appendChild(cell);
    });

    article.append(title, grid);
    container.appendChild(article);
  });
}

function getCardMarks(card, markedNumbers) {
  return [...new Set([...markedNumbers, ...sanitizeNumberList(card.manualMarks)])];
}

function flashCurrentNumber() {
  const current = $("#current-number");
  current.classList.remove("pop");
  void current.offsetWidth;
  current.classList.add("pop");
}

function speakNumber(number) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const isFastSpeech = sanitizeInterval(state.host.intervalSeconds) < 2;
  const utterance = new SpeechSynthesisUtterance(isFastSpeech ? String(number) : `Число ${number}`);
  utterance.lang = "ru-RU";
  utterance.rate = isFastSpeech ? 1.08 : 0.9;
  window.speechSynthesis.speak(utterance);
}

function saveState() {
  const data = {
    screen: state.screen,
    host: {
      pool: state.host.pool,
      called: state.host.called,
      current: state.host.current,
      speed: state.host.speed,
      intervalSeconds: state.host.intervalSeconds,
      cardCount: state.host.cardCount,
      cards: state.host.cards
    },
    player: state.player
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.host.pool = createNumberPool();
    return;
  }

  try {
    const saved = JSON.parse(raw);
    state.screen = ["home", "host", "cards"].includes(saved.screen) ? saved.screen : "home";
    state.host.pool = sanitizeNumberList(saved.host?.pool);
    state.host.called = sanitizeNumberList(saved.host?.called, false);
    state.host.current = Number.isInteger(saved.host?.current) ? saved.host.current : null;
    state.host.speed = ["slow", "normal", "fast", "custom"].includes(saved.host?.speed) ? saved.host.speed : "normal";
    state.host.intervalSeconds = sanitizeInterval(saved.host?.intervalSeconds || SPEEDS[state.host.speed] || SPEEDS.normal);
    state.host.cardCount = clampCount(saved.host?.cardCount || 4);
    state.host.cards = sanitizeCards(saved.host?.cards);
    state.player.cardCount = clampCount(saved.player?.cardCount || 4);
    state.player.cards = sanitizeCards(saved.player?.cards);
    state.player.markedNumbers = sanitizeNumberList(saved.player?.markedNumbers);

    if (state.host.pool.length === 0 && state.host.called.length === 0) {
      state.host.pool = createNumberPool();
    }
  } catch (error) {
    console.error("Не удалось восстановить состояние игры", error);
    state.host.pool = createNumberPool();
  }
}

function sanitizeCards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards
    .filter((card) => Array.isArray(card.numbers) && card.numbers.length === 3)
    .map((card, index) => ({
      id: card.id || `${Date.now()}-${index}`,
      title: card.title || `Карточка ${index + 1}`,
      manualMarks: sanitizeNumberList(card.manualMarks),
      numbers: card.numbers.map((row) => row.map((value) => {
        const number = Number.parseInt(value, 10);
        return Number.isInteger(number) && number >= 1 && number <= MAX_NUMBER ? number : null;
      }))
    }));
}

function sanitizeNumberList(list, unique = true) {
  if (!Array.isArray(list)) return [];
  const numbers = list
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= MAX_NUMBER);
  return unique ? [...new Set(numbers)] : numbers;
}

function syncSpeedControls() {
  const seconds = sanitizeInterval(state.host.intervalSeconds);
  $("#speed-range").value = String(seconds);
  $("#speed-value").textContent = `${formatSeconds(seconds)} сек`;
  $("#speed-select").value = state.host.speed;
}

function getHostIntervalMs() {
  return sanitizeInterval(state.host.intervalSeconds) * 1000;
}

function sanitizeInterval(value) {
  const seconds = Number.parseFloat(value);
  if (!Number.isFinite(seconds)) return SPEEDS.normal;
  return Math.min(8, Math.max(0.8, seconds));
}

function formatSeconds(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clampCount(value) {
  const count = Number.parseInt(value, 10);
  return Math.min(5, Math.max(1, Number.isInteger(count) ? count : 4));
}

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(console.error);
  }
}
