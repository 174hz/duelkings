/* --------------------------------------------------
   GLOBAL STATE
-------------------------------------------------- */

let poolsData = null;
let currentPool = null;
let currentUser = null;
let userPicks = {};
let testMode = false;

/* --------------------------------------------------
   TEAM ABBREVIATIONS (NFL + fallback)
-------------------------------------------------- */

const TEAM_ABBREVIATIONS = {
  // AFC East
  "Buffalo Bills": "BUF",
  "Miami Dolphins": "MIA",
  "New England Patriots": "NE",
  "New York Jets": "NYJ",
  // AFC North
  "Baltimore Ravens": "BAL",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Pittsburgh Steelers": "PIT",
  // AFC South
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Tennessee Titans": "TEN",
  // AFC West
  "Denver Broncos": "DEN",
  "Kansas City Chiefs": "KC",
  "Las Vegas Raiders": "LV",
  "Los Angeles Chargers": "LAC",
  // NFC East
  "Dallas Cowboys": "DAL",
  "New York Giants": "NYG",
  "Philadelphia Eagles": "PHI",
  "Washington Commanders": "WAS",
  // NFC North
  "Chicago Bears": "CHI",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GB",
  "Minnesota Vikings": "MIN",
  // NFC South
  "Atlanta Falcons": "ATL",
  "Carolina Panthers": "CAR",
  "New Orleans Saints": "NO",
  "Tampa Bay Buccaneers": "TB",
  // NFC West
  "Arizona Cardinals": "ARI",
  "Los Angeles Rams": "LAR",
  "San Francisco 49ers": "SF",
  "Seattle Seahawks": "SEA"
  // You can extend this for NBA/NHL/MLB similarly
};

function getTeamAbbrev(name) {
  if (!name) return "";
  if (TEAM_ABBREVIATIONS[name]) return TEAM_ABBREVIATIONS[name];
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (TEAM_ABBREVIATIONS[cleaned]) return TEAM_ABBREVIATIONS[cleaned];
  return cleaned.substring(0, 3).toUpperCase();
}

/* --------------------------------------------------
   INIT
-------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initLogin();
  initTestModeToggle();
  loadPoolsJson();
  initNavTabs();
});

/* --------------------------------------------------
   LOAD POOLS.JSON
-------------------------------------------------- */

async function loadPoolsJson() {
  try {
    const res = await fetch("./data/pools.json?v=" + Date.now());
    poolsData = await res.json();

    const poolId = poolsData.currentPoolId;
    currentPool = poolsData.pools.find(p => p.id === poolId);

    if (!currentPool) {
      document.getElementById("pool-title").textContent = "Pool not found";
      return;
    }

    populatePoolSelectors();
    renderPool(currentPool);
    loadSavedPicks();
    renderLeaderboard();

  } catch (err) {
    console.error("Error loading pools.json:", err);
    document.getElementById("pool-title").textContent = "Error loading pool";
  }
}

/* --------------------------------------------------
   POOL SELECTORS
-------------------------------------------------- */

function populatePoolSelectors() {
  const sportSelect = document.getElementById("sport-filter");
  const poolSelect = document.getElementById("pool-select");

  const sports = [...new Set(poolsData.pools.map(p => p.sport))];

  sportSelect.innerHTML = "";
  sports.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sportSelect.appendChild(opt);
  });

  sportSelect.value = currentPool.sport;

  poolSelect.innerHTML = "";
  poolsData.pools
    .filter(p => p.sport === currentPool.sport)
    .forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label;
      poolSelect.appendChild(opt);
    });

  poolSelect.value = currentPool.id;

  sportSelect.addEventListener("change", () => {
    const sport = sportSelect.value;
    poolSelect.innerHTML = "";
    poolsData.pools
      .filter(p => p.sport === sport)
      .forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.label;
        poolSelect.appendChild(opt);
      });
  });

  poolSelect.addEventListener("change", () => {
    const id = poolSelect.value;
    currentPool = poolsData.pools.find(p => p.id === id);
    renderPool(currentPool);
    loadSavedPicks();
  });
}

/* --------------------------------------------------
   RENDER POOL
-------------------------------------------------- */

function renderPool(pool) {
  document.getElementById("pool-title").textContent = pool.label;

  const meta = document.getElementById("pool-meta");
  const deadline = new Date(pool.deadline);
  const now = new Date();

  const isOpen = testMode || now < deadline;

  meta.innerHTML = `
    <div><strong>Sport:</strong> ${pool.sport}</div>
    <div><strong>Deadline:</strong> ${deadline.toLocaleString()}</div>
    <div><strong>Status:</strong> ${isOpen ? "Open" : "Closed"}</div>
  `;

  const container = document.getElementById("games-container");
  container.innerHTML = "";

  pool.games.forEach(game => {
    const card = createCompactMatchupCard(game, isOpen);
    container.appendChild(card);
  });
}

/* --------------------------------------------------
   ULTRA-COMPACT MATCHUP CARD (FIXED COLUMNS)
-------------------------------------------------- */

function createCompactMatchupCard(game, isOpen) {
  const card = document.createElement("div");
  card.className = "matchup-card compact";
  card.dataset.gameId = game.id;

  const awayAbbr = getTeamAbbrev(game.awayTeam);
  const homeAbbr = getTeamAbbrev(game.homeTeam);

  card.innerHTML = `
    <div class="matchup-row">
      <div class="col-teams">${awayAbbr} @ ${homeAbbr}</div>

      <div class="col-spread">
        <button class="odds-btn" data-type="spread" data-side="away">${game.spread.away}</button>
        <button class="odds-btn" data-type="spread" data-side="home">${game.spread.home}</button>
      </div>

      <div class="col-ml">
        <button class="odds-btn" data-type="moneyline" data-side="away">${game.moneyline.away}</button>
        <button class="odds-btn" data-type="moneyline" data-side="home">${game.moneyline.home}</button>
      </div>

      <div class="col-total">
        <button class="odds-btn" data-type="total" data-side="over">${game.total} O</button>
        <button class="odds-btn" data-type="total" data-side="under">${game.total} U</button>
      </div>
    </div>
  """

  setTimeout(() => card.classList.add("loaded"), 10);

  card.querySelectorAll(".odds-btn").forEach(btn => {
    if (!isOpen) btn.classList.add("locked");

    btn.addEventListener("click", () => {
      if (!isOpen) return;

      const type = btn.dataset.type;
      const side = btn.dataset.side;

      if (!userPicks[game.id]) userPicks[game.id] = {};
      userPicks[game.id][type] = side;

      // Clear same-type selections
      card.querySelectorAll(`.odds-btn[data-type="${type}"]`)
        .forEach(b => b.classList.remove("selected"));

      btn.classList.add("selected");

      // AUTO-SELECT MONEYLINE WHEN SPREAD IS PICKED
      if (type === "spread") {
        const mlBtn = card.querySelector(`.odds-btn[data-type="moneyline"][data-side="${side}"]`);
        if (mlBtn) {
          card.querySelectorAll(`.odds-btn[data-type="moneyline"]`)
            .forEach(b => b.classList.remove("selected"));
          mlBtn.classList.add("selected");
          userPicks[game.id]["moneyline"] = side;
        }
      }
    });
  });

  return card;
}

/* --------------------------------------------------
   SAVE PICKS LOCALLY
-------------------------------------------------- */

function loadSavedPicks() {
  const key = `picks_${currentPool.id}`;
  const saved = localStorage.getItem(key);
  userPicks = saved ? JSON.parse(saved) : {};

  document.querySelectorAll(".matchup-card").forEach(card => {
    const gameId = card.dataset.gameId;
    const picks = userPicks[gameId] || {};

    card.querySelectorAll(".odds-btn").forEach(btn => {
      const type = btn.dataset.type;
      const side = btn.dataset.side;

      if (picks[type] === side) {
        btn.classList.add("selected");
      }
    });
  });
}

document.getElementById("save-picks-btn").addEventListener("click", () => {
  const key = `picks_${currentPool.id}`;
  localStorage.setItem(key, JSON.stringify(userPicks));

  const status = document.getElementById("save-status");
  status.textContent = "Saved!";
  status.classList.add("show");
  setTimeout(() => status.classList.remove("show"), 1500);
});

/* --------------------------------------------------
   SUBMIT PICKS
-------------------------------------------------- */

document.getElementById("submit-picks-btn").addEventListener("click", () => {
  if (!currentUser) {
    alert("Enter a username first.");
    return;
  }

  const output = document.getElementById("submit-output");
  output.textContent = JSON.stringify({
    user: currentUser,
    poolId: currentPool.id,
    picks: userPicks
  }, null, 2);

  output.classList.add("show");
});

/* --------------------------------------------------
   LEADERBOARD
-------------------------------------------------- */

function renderLeaderboard() {
  const container = document.getElementById("leaderboard-container");
  container.innerHTML = "";

  const row = document.createElement("div");
  row.className = "leaderboard-row";
  row.textContent = "Leaderboard coming soon…";
  container.appendChild(row);
}

/* --------------------------------------------------
   LOGIN
-------------------------------------------------- */

function initLogin() {
  const btn = document.getElementById("login-btn");
  const input = document.getElementById("login-username");
  const display = document.getElementById("current-user");

  btn.addEventListener("click", () => {
    const name = input.value.trim();
    if (!name) return;

    currentUser = name;
    display.textContent = `Hi, ${name}`;
    document.getElementById("login-inline").style.display = "none";
  });
}

/* --------------------------------------------------
   THEME
-------------------------------------------------- */

function initTheme() {
  const btn = document.getElementById("theme-toggle");

  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    btn.textContent = document.body.classList.contains("dark")
      ? "Light mode"
      : "Dark mode";
  });
}

/* --------------------------------------------------
   TEST MODE
-------------------------------------------------- */

function initTestModeToggle() {
  const toggle = document.getElementById("test-mode-toggle");

  toggle.addEventListener("change", () => {
    testMode = toggle.checked;
    renderPool(currentPool);
    loadSavedPicks();
  });
}

/* --------------------------------------------------
   NAV TABS
-------------------------------------------------- */

function initNavTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  const views = document.querySelectorAll(".view");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const view = tab.dataset.view;
      views.forEach(v => v.classList.remove("active"));
      document.getElementById(`${view}-view`).classList.add("active");
    });
  });
}

