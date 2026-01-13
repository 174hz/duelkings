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
  loadLocalPicks();
  loadPools();
  setupSaveButton();
  setupSubmitButton();

  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
});

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
   LOAD POOLS + MULTI-SPORT SELECTORS
   + AUTO-CLOSE / AUTO-COMPLETE
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

    /* --------------------------------------------------
       PATCHED BLOCK — OPTION B (deadline = first game start)
    -------------------------------------------------- */
    allPools.forEach(pool => {
      // NEW: deadline is the earliest game start time
      const earliestGameStart = Math.min(
        ...pool.games.map(g => new Date(g.startTime).getTime())
      );

      // Close pool only when the first game begins
      if (earliestGameStart < now && pool.status === "open") {
        pool.status = "closed";
      }

      // Mark completed only if all games scored
      const poolResults = resultsData[pool.id];
      if (poolResults) {
        const allGamesScored = pool.games.every(g => !!poolResults[g.id]);
        if (allGamesScored) {
          pool.status = "completed";
        }
      }
    });

    const defaultPool =
      allPools.find(p => p.id === poolsData.currentPoolId) || allPools[0];

    setupPoolSelectors(defaultPool);
    setCurrentPool(defaultPool);
  } catch (e) {
    console.error("Failed to load pools", e);
  }
}

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

function setCurrentPool(pool) {
  if (!pool) return;
  currentPool = pool;
  renderPool(pool);
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

  if (!isOpen) {
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

      <div class="teams">
        <div class="team">
          <span class="team-name">${game.awayTeam}</span>
          <span class="team-tag">Away</span>
        </div>
        <div class="team">
          <span class="team-name">${game.homeTeam}</span>
          <span class="team-tag">Home</span>
        </div>
      </div>

      <div class="odds-row">
        <button class="odds-btn" data-type="spread" data-choice="away">
          <span class="odds-btn-label">${game.awayTeam} spread</span>
          <span class="odds-btn-value">${game.spread.away}</span>
        </button>
        <button class="odds-btn" data-type="moneyline" data-choice="away">
          <span class="odds-btn-label">${game.awayTeam} ML</span>
          <span class="odds-btn-value">${game.moneyline.away}</span>
        </button>
        <button class="odds-btn" data-type="total" data-choice="over">
          <span class="odds-btn-label">Over</span>
          <span class="odds-btn-value">${game.total}</span>
        </button>
      </div>

      <div class="odds-row" style="margin-top:6px;">
        <button class="odds-btn" data-type="spread" data-choice="home">
          <span class="odds-btn-label">${game.homeTeam} spread</span>
          <span class="odds-btn-value">${game.spread.home}</span>
        </button>
        <button class="odds-btn" data-type="moneyline" data-choice="home">
          <span class="odds-btn-label">${game.homeTeam} ML</span>
          <span class="odds-btn-value">${game.moneyline.home}</span>
        </button>
        <button class="odds-btn" data-type="total" data-choice="under">
          <span class="odds-btn-label">Under</span>
          <span class="odds-btn-value">${game.total}</span>
        </button>
      </div>
    `;

    applyExistingSelections(card, gamePicks);

    if (isOpen) {
      attachSelectionHandlers(card, pool.id, game.id);
    } else {
      const buttons = card.querySelectorAll(".odds-btn");
      buttons.forEach(b => {
        b.classList.add("locked");
        b.disabled = true;
      });
    }

    gamesContainer.appendChild(card);
  });
}

function applyExistingSelections(card, gamePicks) {
  Object.entries(gamePicks).forEach(([type, choice]) => {
    const btn = card.querySelector(
      `.odds-btn[data-type="${type}"][data-choice="${choice}"]`
    );
    if (btn) btn.classList.add("selected");
  });
}

function attachSelectionHandlers(card, poolId, gameId) {
  const buttons = card.querySelectorAll(".odds-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const choice = btn.dataset.choice;

      buttons.forEach(b => {
        if (b.dataset.type === type) b.classList.remove("selected");
      });
      btn.classList.add("selected");

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
    setTimeout(() => (statusEl.textContent = ""), 2500);
  });
}

/* --------------------------------------------------
   SUBMIT PICKS → JSON ENTRY GENERATOR
-------------------------------------------------- */

function setupSubmitButton() {
  const btn = document.getElementById("submit-picks-btn");
  const out = document.getElementById("submit-output");

  btn.addEventListener("click", () => {
    const user = localStorage.getItem(USER_KEY);
    if (!user) {
      out.textContent = "You must log in first.";
      return;
    }

    const poolId = currentPool.id;
    const picks = userPicks[poolId];

    if (!picks) {
      out.textContent = "No picks made.";
      return;
    }

    const entry = {
      user,
      picks
    };

    out.textContent =
      "Copy this into data/entries.json:\n\n" +
      JSON.stringify(entry, null, 2);
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
