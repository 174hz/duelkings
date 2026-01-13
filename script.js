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
   RENDER POOL + MATCHUPS
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

  /* STATUS BADGE */
  const badge = document.createElement("div");
  badge.className = "pool-status-badge";

  if (TEST_MODE) {
    badge.classList.add("badge-test");
    badge.textContent = "TEST MODE — OPEN";
  } else if (pool.status === "completed") {
    badge.classList.add("badge-completed");
    badge.textContent = "COMPLETED";
  } else if (pool.status === "closed") {
    badge.classList.add("badge-closed");
    badge.textContent = "CLOSED";
  } else {
    badge.classList.add("badge-open");
    badge.textContent = "OPEN";
  }

  gamesContainer.appendChild(badge);

  if (!isOpen && !TEST_MODE) {
    const lockedMsg = document.createElement("div");
    lockedMsg.className = "matchup-card";
    lockedMsg.textContent = `Pool is ${pool.status}. Picks are locked.`;
    gamesContainer.appendChild(lockedMsg);
  }

  const poolPicks = userPicks[pool.id] || {};

  pool.games.forEach(game => {
    const card = document.createElement("div");
    card.className = "matchup-card";
    card.dataset.gameId = game.id;

    const gamePicks = poolPicks[game.id] || {};

    card.innerHTML = `
      <div class="matchup-header">
        <span>${new Date(game.startTime).toLocaleString()}</span>
        <span>${pool.sport}</span>
      </div>
