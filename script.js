/* --------------------------------------------------
   GLOBAL FLAGS
-------------------------------------------------- */
let TEST_MODE = false;

/* --------------------------------------------------
   DYNAMIC PATH RESOLUTION
-------------------------------------------------- */

const BASE_PATH = window.location.pathname.includes("/admin/")
  ? "../data/"
  : "./data/";

const POOLS_URL = BASE_PATH + "pools.json";
const RESULTS_URL = BASE_PATH + "results.json";
const ENTRIES_URL = BASE_PATH + "entries.json";

const STORAGE_KEY = "duelkings_picks";
const USER_KEY = "duelkings_user";
const THEME_KEY = "duelkings_theme";

let currentPool = null;
let allPools = [];
let allResults = {};
let userPicks = {};

/* --------------------------------------------------
   INITIALIZATION
-------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initLogin();
  setupNav();
  setupTestModeToggle();
  loadLocalPicks();
  loadPools();
  setupSaveButton();
  setupSubmitButton();

  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
});

/* --------------------------------------------------
   TEST MODE TOGGLE + DEBUG PANEL
-------------------------------------------------- */

function setupTestModeToggle() {
  const toggle = document.getElementById("test-mode-toggle");
  const debugPanel = document.getElementById("debug-panel");

  toggle.addEventListener("change", () => {
    TEST_MODE = toggle.checked;

    if (TEST_MODE) {
      debugPanel.classList.add("debug-open");
      debugPanel.classList.remove("debug-closed");
    } else {
      debugPanel.classList.add("debug-closed");
      debugPanel.classList.remove("debug-open");
    }

    loadPools();
  });
}

function updateDebugPanel() {
  const panel = document.getElementById("debug-panel");
  if (!TEST_MODE) return;

  const now = new Date().toLocaleString();

  const lines = allPools.map(pool => {
    return `${pool.id}
  status: ${pool.status}
  deadline: ${pool.deadline}
  now: ${now}
  `;
  });

  panel.textContent = "DEBUG MODE ACTIVE\n\n" + lines.join("\n");
}

/* --------------------------------------------------
   LOGIN SYSTEM (INLINE)
-------------------------------------------------- */

function initLogin() {
  const savedUser = localStorage.getItem(USER_KEY);
  const loginInline = document.getElementById("login-inline");
  const userLabel = document.getElementById("current-user");

  if (savedUser) {
    loginInline.style.display = "none";
    userLabel.textContent = savedUser;
    return;
  }

  document.getElementById("login-btn").addEventListener("click", () => {
    const username = document.getElementById("login-username").value.trim();
    if (!username) return;

    localStorage.setItem(USER_KEY, username);
    userLabel.textContent = username;
    loginInline.style.display = "none";
  });
}

/* --------------------------------------------------
   THEME SWITCHER
-------------------------------------------------- */

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const root = document.documentElement;

  if (saved === "dark" || saved === "light") {
    root.setAttribute("data-theme", saved);
  }

  updateThemeToggleLabel();
}

function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  root.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeToggleLabel();
}

function updateThemeToggleLabel() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const current = document.documentElement.getAttribute("data-theme") || "light";
  btn.textContent = current === "light" ? "Dark mode" : "Light mode";
}

/* --------------------------------------------------
   NAVIGATION
-------------------------------------------------- */

function setupNav() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const view = tab.dataset.view;
      document.querySelectorAll(".view").forEach(v => {
        v.classList.toggle("active", v.id === `${view}-view`);
      });

      if (view === "leaderboard") {
        loadLeaderboard();
      }
    });
  });
}

/* --------------------------------------------------
   LOCAL STORAGE
-------------------------------------------------- */

function loadLocalPicks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) userPicks = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load picks", e);
  }
}

function saveLocalPicks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPicks));
  } catch (e) {
    console.error("Failed to save picks", e);
  }
}

/* --------------------------------------------------
   LOAD POOLS (REAL MODE + TEST MODE)
-------------------------------------------------- */

async function loadPools() {
  try {
    const [poolsRes, resultsRes] = await Promise.all([
      fetch(POOLS_URL + "?v=" + Date.now()),
      fetch(RESULTS_URL + "?v=" + Date.now())
    ]);

    const poolsData = await poolsRes.json();
    const resultsData = await resultsRes.json();

    allPools = poolsData.pools;
    allResults = resultsData;

    const now = Date.now();

    allPools.forEach(pool => {
      if (TEST_MODE) {
        pool.status = "open";
      } else {
        const deadlineTime = new Date(pool.deadline).getTime();
        if (deadlineTime < now && pool.status === "open") {
          pool.status = "closed";
        }
      }

      const poolResults = resultsData[pool.id];
      if (poolResults) {
        const allGamesScored = pool.games.every(g => !!poolResults[g.id]);
        if (allGamesScored) {
          pool.status = "completed";
        }
      }
    });

    updateDebugPanel();

    const defaultPool =
      allPools.find(p => p.id === poolsData.currentPoolId) || allPools[0];

    setupPoolSelectors(defaultPool);
    setCurrentPool(defaultPool);
  } catch (e) {
    console.error("Failed to load pools", e);
  }
}

/* --------------------------------------------------
   CURRENT POOL + TRANSITION
-------------------------------------------------- */

function setCurrentPool(pool) {
  const container = document.getElementById("games-container");
  if (!container) {
    currentPool = pool;
    renderPool(pool);
    return;
  }

  container.style.opacity = 0;

  setTimeout(() => {
    currentPool = pool;
    renderPool(pool);
    container.style.opacity = 1;
  }, 150);
}

/* --------------------------------------------------
   POOL SELECTORS
-------------------------------------------------- */

function setupPoolSelectors(selectedPool) {
  const sportSelect = document.getElementById("sport-filter");
  const poolSelect = document.getElementById("pool-select");

  const sports = [...new Set(allPools.map(p => p.sport))];
  sportSelect.innerHTML = "";
  sports.forEach(sport => {
    const opt = document.createElement("option");
    opt.value = sport;
    opt.textContent = sport;
    sportSelect.appendChild(opt);
  });

  sportSelect.value = selectedPool.sport;

  function renderPoolOptions() {
    const currentSport = sportSelect.value;
    const sportPools = allPools.filter(p => p.sport === currentSport);
    poolSelect.innerHTML = "";
    sportPools.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label;
      poolSelect.appendChild(opt);
    });

    if (!sportPools.find(p => p.id === poolSelect.value)) {
      poolSelect.value = sportPools[0]?.id;
    }

    const chosen = allPools.find(p => p.id === poolSelect.value);
    setCurrentPool(chosen);
  }

  sportSelect.addEventListener("change", renderPoolOptions);
  poolSelect.addEventListener("change", () => {
    const chosen = allPools.find(p => p.id === poolSelect.value);
    setCurrentPool(chosen);
  });

  renderPoolOptions();
}

/* --------------------------------------------------
   RENDER POOL — ULTRA‑COMPACT ESPN GEOMETRY
-------------------------------------------------- */

function renderPool(pool) {
  const titleEl = document.getElementById("pool-title");
  const metaEl = document.getElementById("pool-meta");
  const gamesContainer = document.getElementById("games-container");

  titleEl.textContent = pool.label;
  metaEl.textContent = `${pool.sport} • Deadline: ${new Date(
    pool.deadline
  ).toLocaleString()}`;

  gamesContainer.innerHTML = "";

  const isOpen = pool.status === "open";
  const poolResults = allResults[pool.id] || {};

  const poolPicks = userPicks[pool.id] || {};

  pool.games.forEach(game => {
    const row = document.createElement("div");
    row.className = "game-row";
    row.dataset.gameId = game.id;

    const gamePicks = poolPicks[game.id] || {};
    const result = poolResults[game.id];

    const finalScore = result
      ? `${result.awayScore}–${result.homeScore}`
      : "";

    row.innerHTML = `
      <div class="team away">${game.awayTeam}</div>
      <button class="pill spread" data-type="spread" data-choice="away">${game.spread.away}</button>

      <div class="team home">${game.homeTeam}</div>
      <button class="pill spread" data-type="spread" data-choice="home">${game.spread.home}</button>

      <button class="pill moneyline" data-type="moneyline" data-choice="away">${game.moneyline.away}</button>
      <button class="pill moneyline" data-type="moneyline" data-choice="home">${game.moneyline.home}</button>

      <button class="pill total" data-type="total" data-choice="over">O${game.total}</button>
      <button class="pill total" data-type="total" data-choice="under">U${game.total}</button>

      <div class="final-score">${finalScore}</div>
    `;

    applyExistingSelections(row, gamePicks);

    if (isOpen || TEST_MODE) {
      attachSelectionHandlers(row, pool.id, game.id);
    } else {
      row.querySelectorAll(".pill").forEach(b => {
        b.classList.add("locked");
        b.disabled = true;
      });
    }

    gamesContainer.appendChild(row);
  });
}

function applyExistingSelections(row, gamePicks) {
  Object.entries(gamePicks).forEach(([type, choice]) => {
    const btn = row.querySelector(
      `.pill[data-type="${type}"][data-choice="${choice}"]`
    );
    if (btn) btn.classList.add("selected");
  });
}

function attachSelectionHandlers(row, poolId, gameId) {
  const buttons = row.querySelectorAll(".pill");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const choice = btn.dataset.choice;

      buttons.forEach(b => {
        if (b.dataset.type === type) b.classList.remove("selected", "missing");
      });

      btn.classList.add("selected");
      btn.classList.remove("missing");

      if (!userPicks[poolId]) userPicks[poolId] = {};
      if (!userPicks[poolId][gameId]) userPicks[poolId][gameId] = {};
      userPicks[poolId][gameId][type] = choice;
    });
  });
}

/* --------------------------------------------------
   SAVE PICKS
-------------------------------------------------- */

function setupSaveButton() {
  const btn = document.getElementById("save-picks-btn");
  const statusEl = document.getElementById("save-status");

  btn.addEventListener("click", () => {
    saveLocalPicks();
    statusEl.textContent = "Picks saved on this device.";
    statusEl.classList.add("show");
    setTimeout(() => {
      statusEl.classList.remove("show");
    }, 2500);
  });
}

/* --------------------------------------------------
   SUBMIT PICKS — VALIDATION + JSON OUTPUT
-------------------------------------------------- */

function setupSubmitButton() {
  const btn = document.getElementById("submit-picks-btn");
  const out = document.getElementById("submit-output");

  btn.addEventListener("click", () => {
    const user = localStorage.getItem(USER_KEY);
    if (!user) {
      out.textContent = "You must log in first.";
      out.classList.add("show");
      return;
    }

    const poolId = currentPool.id;
    const picks = userPicks[poolId];
    const pool = currentPool;

    if (!picks) {
      out.textContent = "No picks made.";
      out.classList.add("show");
      return;
    }

    let incompleteGames = [];

    pool.games.forEach(game => {
      const gameId = game.id;
      const gamePicks = picks[gameId] || {};
      const missing = [];

      if (!gamePicks.spread) missing.push("spread");
      if (!gamePicks.moneyline) missing.push("moneyline");
      if (!gamePicks.total) missing.push("total");

      if (missing.length > 0) {
        incompleteGames.push(gameId);

        const row = document.querySelector(`.game-row[data-game-id="${gameId}"]`);
        if (row) {
          missing.forEach(type => {
            const btns = row.querySelectorAll(`.pill[data-type="${type}"]`);
            btns.forEach(b => b.classList.add("missing"));
          });
        }
      }
    });

    if (incompleteGames.length > 0) {
      out.textContent = "Please complete all picks before submitting.";
      out.classList.add("show");
      return;
    }

    const entry = { user, picks };

    out.textContent =
      "Copy this into data/entries.json:\n\n" +
      JSON.stringify(entry, null, 2);
    out.classList.add("show");
  });
}

/* --------------------------------------------------
   SCORING LOGIC
-------------------------------------------------- */

function evaluateGameResult(game, result) {
  const { homeScore, awayScore } = result;

  const homeWin = homeScore > awayScore;
  const totalPoints = homeScore + awayScore;

  return {
    moneylineWinner: homeWin ? "home" : "away",
    spreadWinner:
      homeScore + game.spread.home > awayScore + game.spread.away
        ? "home"
        : "away",
    totalWinner:
      totalPoints > game.total
        ? "over"
        : totalPoints < game.total
        ? "under"
        : "push"
  };
}

function scoreUserPicks(pool, userEntry, results) {
  let score = 0;

  for (const game of pool.games) {
    const gameId = game.id;
    const picks = userEntry.picks[gameId];
    const result = results[gameId];

    if (!picks || !result) continue;

    const evalResult = evaluateGameResult(game, result);

    if (picks.moneyline === evalResult.moneylineWinner) score++;
    if (picks.spread === evalResult.spreadWinner) score++;
    if (picks.total === evalResult.totalWinner) score++;
  }

  return score;
}

/* --------------------------------------------------
   LEADERBOARD
-------------------------------------------------- */

async function loadLeaderboard() {
  try {
    const poolsRes = await fetch(POOLS_URL + "?v=" + Date.now());
    const poolsData = await poolsRes.json();
    const pool = poolsData.pools.find(p => p.id === poolsData.currentPoolId);

    const resultsRes = await fetch(RESULTS_URL + "?v=" + Date.now());
    const resultsData = await resultsRes.json();
    const poolResults = resultsData[pool.id];

    const entriesRes = await fetch(ENTRIES_URL + "?v=" + Date.now());
    const entriesData = await entriesRes.json();
    const entries = entriesData[pool.id];

    const leaderboard = entries
      .map(entry => ({
        user: entry.user,
        score: scoreUserPicks(pool, entry, poolResults)
      }))
      .sort((a, b) => b.score - a.score);

    renderLeaderboard(leaderboard);
  } catch (e) {
    console.error("Leaderboard error", e);
  }
}

function renderLeaderboard(rows) {
  const container = document.getElementById("leaderboard-container");
  container.innerHTML = "";

  rows.forEach(row => {
    const div = document.createElement("div");
    div.className = "leaderboard-row";
    div.innerHTML = `
      <span>${row.user}</span>
      <span>${row.score}</span>
    `;
    container.appendChild(div);
  });
}
