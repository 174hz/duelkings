// ===============================
// CONFIG & GLOBAL STATE
// ===============================

const DATA_BASE_PATH = "data";
const POOLS_FILE = `${DATA_BASE_PATH}/pools.json`;
const RESULTS_FILE = `${DATA_BASE_PATH}/results.json`;
const ENTRIES_FILE = `${DATA_BASE_PATH}/entries.json`; // used logically; actual write is backend-dependent

// Toggle this via UI (Test Mode checkbox)
let TEST_MODE = false;

// Global state
let pools = [];
let results = {};
let userPicks = {};          // { poolId: { gameId: { spread, moneyline, total } } }
let currentPool = null;
let currentPoolId = null;
let leaderboardData = [];    // computed from entries + results

// ===============================
// TEAM DATA: ABBREVIATIONS & LOGOS
// ===============================

const TEAM_ABBREVIATIONS = {
  "Buffalo Bills": "BUF", "Miami Dolphins": "MIA", "New England Patriots": "NE", "New York Jets": "NYJ",
  "Baltimore Ravens": "BAL", "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Pittsburgh Steelers": "PIT",
  "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX", "Tennessee Titans": "TEN",
  "Denver Broncos": "DEN", "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Los Angeles Chargers": "LAC",
  "Dallas Cowboys": "DAL", "New York Giants": "NYG", "Philadelphia Eagles": "PHI", "Washington Commanders": "WAS",
  "Chicago Bears": "CHI", "Detroit Lions": "DET", "Green Bay Packers": "GB", "Minnesota Vikings": "MIN",
  "Atlanta Falcons": "ATL", "Carolina Panthers": "CAR", "New Orleans Saints": "NO", "Tampa Bay Buccaneers": "TB",
  "Arizona Cardinals": "ARI", "Los Angeles Rams": "LAR", "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA"
};

const TEAM_LOGOS = {
  BUF: "assets/logos/BUF.png",
  MIA: "assets/logos/MIA.png",
  NE: "assets/logos/NE.png",
  NYJ: "assets/logos/NYJ.png",

  BAL: "assets/logos/BAL.png",
  CIN: "assets/logos/CIN.png",
  CLE: "assets/logos/CLE.png",
  PIT: "assets/logos/PIT.png",

  HOU: "assets/logos/HOU.png",
  IND: "assets/logos/IND.png",
  JAX: "assets/logos/JAX.png",
  TEN: "assets/logos/TEN.png",

  DEN: "assets/logos/DEN.png",
  KC: "assets/logos/KC.png",
  LV: "assets/logos/LV.png",
  LAC: "assets/logos/LAC.png",

  DAL: "assets/logos/DAL.png",
  NYG: "assets/logos/NYG.png",
  PHI: "assets/logos/PHI.png",
  WAS: "assets/logos/WAS.png",

  CHI: "assets/logos/CHI.png",
  DET: "assets/logos/DET.png",
  GB: "assets/logos/GB.png",
  MIN: "assets/logos/MIN.png",

  ATL: "assets/logos/ATL.png",
  CAR: "assets/logos/CAR.png",
  NO: "assets/logos/NO.png",
  TB: "assets/logos/TB.png",

  ARI: "assets/logos/ARI.png",
  LAR: "assets/logos/LAR.png",
  SF: "assets/logos/SF.png",
  SEA: "assets/logos/SEA.png"
};

function getTeamAbbrev(name) {
  const abbr = TEAM_ABBREVIATIONS[name];
  if (abbr) return abbr;
  return name ? name.substring(0, 3).toUpperCase() : "";
}

// ===============================
// UTILS
// ===============================

function $(selector, scope = document) {
  return scope.querySelector(selector);
}

function $all(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function isPoolOpen(pool) {
  if (TEST_MODE) return true;
  if (!pool || !pool.deadline) return true;
  const now = new Date();
  const lock = new Date(pool.deadline);
  return now < lock;
}

// ===============================
// LOCAL STORAGE (SAVE / LOAD PICKS)
// ===============================

const LOCAL_STORAGE_KEY = "duelkings_user_picks";

function loadLocalPicks() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveLocalPicks() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userPicks));
    const saveStatus = $("#save-status");
    if (saveStatus) {
      saveStatus.textContent = "Saved";
      saveStatus.classList.add("saved");
      setTimeout(() => {
        saveStatus.textContent = "";
        saveStatus.classList.remove("saved");
      }, 1500);
    }
  } catch {
    // ignore
  }
}

// ===============================
// DARK MODE (THEME TOGGLE BUTTON)
// ===============================

function initDarkMode() {
  const toggleBtn = $("#theme-toggle");
  if (!toggleBtn) return;

  const stored = localStorage.getItem("duelkings_dark_mode");
  if (stored === "true") {
    document.documentElement.classList.add("dark-mode");
  }

  toggleBtn.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark-mode");
    localStorage.setItem("duelkings_dark_mode", isDark ? "true" : "false");
  });
}

// ===============================
// TEST MODE TOGGLE
// ===============================

function initTestModeToggle() {
  const testToggle = $("#test-mode-toggle");
  if (!testToggle) return;

  testToggle.addEventListener("change", () => {
    TEST_MODE = testToggle.checked;
    // Re-render current pool so open/closed state reflects test mode
    if (currentPool) {
      renderCurrentPool(currentPool.id);
    }
  });
}

// ===============================
// COMPACT MATCHUP CARD (WITH LOGOS)
// ===============================

function createCompactMatchupCard(poolId, game, isOpen) {
  const card = document.createElement("div");
  card.className = "matchup-card compact";
  card.dataset.gameId = game.id;

  const awayAbbr = getTeamAbbrev(game.awayTeam);
  const homeAbbr = getTeamAbbrev(game.homeTeam);

  const awayLogo = TEAM_LOGOS[awayAbbr];
  const homeLogo = TEAM_LOGOS[homeAbbr];

  const existingPicksForPool = userPicks[poolId] || {};
  const existingGamePicks = existingPicksForPool[game.id] || {};

  card.innerHTML = `
    <div class="matchup-row">
      <div class="col-teams">
        ${awayLogo ? `<img class="team-logo" src="${awayLogo}" alt="${awayAbbr} logo">` : ""}
        ${awayAbbr} @ 
        ${homeLogo ? `<img class="team-logo" src="${homeLogo}" alt="${homeAbbr} logo">` : ""}
        ${homeAbbr}
      </div>

      <div class="col-spread">
        <button class="odds-btn" data-type="spread" data-side="away">${game.spread.away}</button>
        <button class="odds-btn" data-type="spread" data-side="home">${game.spread.home}</button>
      </div>

      <div class="col-ml">
        <span class="ml-label">ML</span>
        <button class="odds-btn" data-type="moneyline" data-side="away">${game.moneyline.away}</button>
        <button class="odds-btn" data-type="moneyline" data-side="home">${game.moneyline.home}</button>
      </div>

      <div class="col-total">
        <button class="odds-btn" data-type="total" data-side="over">${game.total} O</button>
        <button class="odds-btn" data-type="total" data-side="under">${game.total} U</button>
      </div>
    </div>
  `;

  setTimeout(() => card.classList.add("loaded"), 10);

  const oddsButtons = card.querySelectorAll(".odds-btn");

  // Restore existing selections
  oddsButtons.forEach(btn => {
    const type = btn.dataset.type;
    const side = btn.dataset.side;
    if (existingGamePicks[type] === side) {
      btn.classList.add("selected");
    }
    if (!isOpen) {
      btn.classList.add("locked");
    }
  });

  oddsButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!isOpen) return;

      const type = btn.dataset.type;
      const side = btn.dataset.side;

      if (!userPicks[poolId]) userPicks[poolId] = {};
      if (!userPicks[poolId][game.id]) userPicks[poolId][game.id] = {};
      userPicks[poolId][game.id][type] = side;

      card.querySelectorAll(`.odds-btn[data-type="${type}"]`)
        .forEach(b => b.classList.remove("selected"));

      btn.classList.add("selected");

      // Auto-select ML when spread is chosen
      if (type === "spread") {
        const mlBtn = card.querySelector(`.odds-btn[data-type="moneyline"][data-side="${side}"]`);
        if (mlBtn) {
          card.querySelectorAll(`.odds-btn[data-type="moneyline"]`)
            .forEach(b => b.classList.remove("selected"));
          mlBtn.classList.add("selected");
          userPicks[poolId][game.id]["moneyline"] = side;
        }
      }

      saveLocalPicks();
      updateMissingPicksHighlight(poolId);
    });
  });

  return card;
}

// ===============================
// POOL RENDERING (MATCHES YOUR HTML)
// ===============================

function renderCurrentPool(poolId) {
  const pool = pools.find(p => p.id === poolId);
  if (!pool) return;

  currentPool = pool;
  currentPoolId = pool.id;

  const poolTitleEl = $("#pool-title");
  const poolMetaEl = $("#pool-meta");
  const gamesContainer = $("#games-container");

  if (poolTitleEl) {
    poolTitleEl.textContent = pool.label || pool.id;
  }

  if (poolMetaEl) {
    const open = isPoolOpen(pool);
    poolMetaEl.innerHTML = `
      <span class="pool-lock">Locks: ${formatDateTime(pool.deadline)}</span>
      <span class="pool-status ${open ? "open" : "closed"}">${open ? "Open" : "Closed"}</span>
    `;
  }

  if (!gamesContainer) return;
  gamesContainer.innerHTML = "";

  const isOpen = isPoolOpen(pool);

  (pool.games || []).forEach(game => {
    const card = createCompactMatchupCard(pool.id, game, isOpen);
    gamesContainer.appendChild(card);
  });

  updateMissingPicksHighlight(pool.id);
}

function updateMissingPicksHighlight(poolId) {
  const pool = pools.find(p => p.id === poolId);
  if (!pool) return;

  const picksForPool = userPicks[poolId] || {};
  const gamesContainer = $("#games-container");
  if (!gamesContainer) return;

  $all(".matchup-card", gamesContainer).forEach(card => {
    const gameId = card.dataset.gameId;
    const picksForGame = picksForPool[gameId] || {};
    const hasAnyPick = picksForGame.spread || picksForGame.moneyline || picksForGame.total;
    card.classList.toggle("missing-pick", !hasAnyPick);
  });
}

// ===============================
// DROPDOWNS: SPORT FILTER + POOL SELECT
// ===============================

function initPoolSelectors() {
  const sportFilter = $("#sport-filter");
  const poolSelect = $("#pool-select");
  if (!sportFilter || !poolSelect) return;

  // Build sport options
  const sports = Array.from(new Set(pools.map(p => p.sport))).sort();
  sportFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All sports";
  sportFilter.appendChild(allOption);

  sports.forEach(sport => {
    const opt = document.createElement("option");
    opt.value = sport;
    opt.textContent = sport;
    sportFilter.appendChild(opt);
  });

  function refreshPoolSelect() {
    const selectedSport = sportFilter.value;
    const filteredPools = selectedSport
      ? pools.filter(p => p.sport === selectedSport)
      : pools.slice();

    poolSelect.innerHTML = "";
    filteredPools.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label || p.id;
      poolSelect.appendChild(opt);
    });

    // Choose current pool
    let targetId = currentPoolId;
    if (!targetId || !filteredPools.some(p => p.id === targetId)) {
      targetId = filteredPools.length ? filteredPools[0].id : null;
    }

    if (targetId) {
      poolSelect.value = targetId;
      renderCurrentPool(targetId);
    } else {
      const gamesContainer = $("#games-container");
      const poolTitleEl = $("#pool-title");
      const poolMetaEl = $("#pool-meta");
      if (gamesContainer) gamesContainer.innerHTML = "No pools available.";
      if (poolTitleEl) poolTitleEl.textContent = "No pool available";
      if (poolMetaEl) poolMetaEl.textContent = "";
    }
  }

  sportFilter.addEventListener("change", refreshPoolSelect);
  poolSelect.addEventListener("change", () => {
    const newId = poolSelect.value;
    if (newId) {
      renderCurrentPool(newId);
    }
  });

  // Initial population
  refreshPoolSelect();
}

// ===============================
// SUBMIT PICKS (FRONTEND PLACEHOLDER)
// ===============================

async function submitPicks() {
  if (!currentPool) return;

  const poolId = currentPool.id;
  const picksForPool = userPicks[poolId] || {};

  const requiredGames = (currentPool.games || []).length;
  const pickedGames = Object.keys(picksForPool).length;

  if (pickedGames < requiredGames) {
    alert("You still have missing picks. Please complete all games before submitting.");
    return;
  }

  const payload = {
    poolId,
    timestamp: new Date().toISOString(),
    picks: picksForPool
  };

  console.log("Submit payload (frontend placeholder):", payload);
  const submitOutput = $("#submit-output");
  if (submitOutput) {
    submitOutput.textContent = "Picks submitted (frontend placeholder).";
    setTimeout(() => (submitOutput.textContent = ""), 2000);
  }
}

// ===============================
// RESULTS & LEADERBOARD
// ===============================

function computeScoreForEntry(entry, poolResults) {
  if (!entry || !poolResults) return 0;
  let score = 0;

  Object.keys(entry.picks || {}).forEach(gameId => {
    const gamePicks = entry.picks[gameId];
    const gameResult = poolResults[gameId];
    if (!gameResult) return;

    // Example scoring: +1 for correct spread, +1 for correct ML, +1 for correct total
    if (gamePicks.spread && gameResult.spreadWinner && gamePicks.spread === gameResult.spreadWinner) {
      score += 1;
    }
    if (gamePicks.moneyline && gameResult.moneylineWinner && gamePicks.moneyline === gameResult.moneylineWinner) {
      score += 1;
    }
    if (gamePicks.total && gameResult.totalWinner && gamePicks.total === gameResult.totalWinner) {
      score += 1;
    }
  });

  return score;
}

function renderLeaderboard() {
  const leaderboardContainer = $("#leaderboard-container");
  if (!leaderboardContainer) return;

  leaderboardContainer.innerHTML = "";

  if (!leaderboardData.length) {
    leaderboardContainer.textContent = "No entries yet.";
    return;
  }

  const table = document.createElement("table");
  table.className = "leaderboard-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Rank</th>
      <th>Player</th>
      <th>Score</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  leaderboardData.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row.name || "Anonymous"}</td>
      <td>${row.score}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  leaderboardContainer.appendChild(table);
}

// ===============================
// DATA LOADING
// ===============================

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function loadPools() {
  try {
    const data = await loadJSON(POOLS_FILE);
    pools = data.pools || [];
    currentPoolId = data.currentPoolId || (pools[0] && pools[0].id) || null;
  } catch (e) {
    console.error("Error loading pools:", e);
    pools = [];
    currentPoolId = null;
  }
}

async function loadResults() {
  try {
    results = await loadJSON(RESULTS_FILE);
  } catch (e) {
    console.warn("No results yet or failed to load results.json:", e);
    results = {};
  }
}

async function loadEntriesAndComputeLeaderboard() {
  try {
    const entries = await loadJSON(ENTRIES_FILE);
    leaderboardData = [];

    if (Array.isArray(entries)) {
      entries.forEach(entry => {
        const poolId = entry.poolId;
        const poolResults = results[poolId];
        if (!poolResults) return;

        const score = computeScoreForEntry(entry, poolResults);
        leaderboardData.push({
          name: entry.name || "Anonymous",
          score
        });
      });

      leaderboardData.sort((a, b) => b.score - a.score);
    } else {
      console.warn("entries.json is not an array; skipping leaderboard computation.");
      leaderboardData = [];
    }

    renderLeaderboard();
  } catch (e) {
    console.warn("No entries yet or failed to load entries.json:", e);
    leaderboardData = [];
    renderLeaderboard();
  }
}

// ===============================
// NAV TABS (POOLS / LEADERBOARD)
// ===============================

function initNavTabs() {
  const tabs = $all(".nav-tab");
  const poolsView = $("#pools-view");
  const leaderboardView = $("#leaderboard-view");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      if (view === "pools") {
        if (poolsView) poolsView.classList.add("active");
        if (leaderboardView) leaderboardView.classList.remove("active");
      } else if (view === "leaderboard") {
        if (leaderboardView) leaderboardView.classList.add("active");
        if (poolsView) poolsView.classList.remove("active");
      }
    });
  });
}

// ===============================
// INIT
// ===============================

function initButtons() {
  const saveBtn = $("#save-picks-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveLocalPicks();
      alert("Picks saved locally on this device.");
    });
  }

  const submitBtn = $("#submit-picks-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitPicks);
  }
}

async function initApp() {
  userPicks = loadLocalPicks();
  initDarkMode();
  initTestModeToggle();
  initButtons();
  initNavTabs();

  await loadPools();
  await loadResults();
  await loadEntriesAndComputeLeaderboard();

  if (pools.length) {
    initPoolSelectors();
  } else {
    const gamesContainer = $("#games-container");
    const poolTitleEl = $("#pool-title");
    const poolMetaEl = $("#pool-meta");
    if (gamesContainer) gamesContainer.textContent = "No pools available.";
    if (poolTitleEl) poolTitleEl.textContent = "No pool available";
    if (poolMetaEl) poolMetaEl.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", initApp);
