/* --------------------------------------------------
   ADMIN PANEL CORE
-------------------------------------------------- */

console.log("Admin tools loaded");

/* --------------------------------------------------
   LOAD POOLS.JSON
-------------------------------------------------- */

async function loadPoolsJson() {
  const res = await fetch("../data/pools.json?v=" + Date.now());
  return await res.json();
}

/* --------------------------------------------------
   SAVE POOLS.JSON (MANUAL COPY/PASTE)
-------------------------------------------------- */

function outputPoolsJson(updated) {
  const out = document.getElementById("admin-output");
  if (!out) return;

  out.textContent =
    "Copy this into data/pools.json:\n\n" +
    JSON.stringify(updated, null, 2);

  out.classList.add("show");
  setTimeout(() => out.classList.remove("show"), 6000);
}

/* --------------------------------------------------
   POOL VALIDATOR
-------------------------------------------------- */

function validatePool(pool) {
  const errors = [];

  if (!pool.id) errors.push("Missing pool.id");
  if (!pool.sport) errors.push("Missing pool.sport");
  if (!pool.label) errors.push("Missing pool.label");
  if (!pool.deadline) errors.push("Missing pool.deadline");
  if (!Array.isArray(pool.games) || pool.games.length === 0) {
    errors.push("Pool must contain at least one game");
  }

  const ids = new Set();

  pool.games.forEach((g, i) => {
    const prefix = `Game[${i}]`;

    if (!g.id) errors.push(`${prefix}: missing id`);
    if (g.id && ids.has(g.id)) errors.push(`${prefix}: duplicate id ${g.id}`);
    if (g.id) ids.add(g.id);

    if (!g.awayTeam) errors.push(`${prefix}: missing awayTeam`);
    if (!g.homeTeam) errors.push(`${prefix}: missing homeTeam`);
    if (!g.startTime) errors.push(`${prefix}: missing startTime`);

    if (!g.spread || g.spread.away === undefined || g.spread.home === undefined) {
      errors.push(`${prefix}: invalid spread`);
    }
    if (!g.moneyline || g.moneyline.away === undefined || g.moneyline.home === undefined) {
      errors.push(`${prefix}: invalid moneyline`);
    }
    if (g.total === undefined) {
      errors.push(`${prefix}: missing total`);
    }
  });

  return errors;
}

function validatePoolsJson(poolsJson) {
  const errors = [];

  if (!poolsJson.currentPoolId) {
    errors.push("Missing currentPoolId");
  }

  const ids = new Set();

  poolsJson.pools.forEach((pool, i) => {
    if (!pool.id) {
      errors.push(`Pool[${i}]: missing id`);
    } else if (ids.has(pool.id)) {
      errors.push(`Pool[${i}]: duplicate id ${pool.id}`);
    } else {
      ids.add(pool.id);
    }

    const poolErrors = validatePool(pool);
    poolErrors.forEach(e => errors.push(`Pool[${pool.id}]: ${e}`));
  });

  return errors;
}

/* --------------------------------------------------
   POOL GENERATOR (FACTORY)
-------------------------------------------------- */

function createPool({ id, sport, label, deadline, games }) {
  return {
    id,
    sport,
    label,
    deadline,
    status: "open",
    games: games.map((g, index) => ({
      id: g.id || `${id}-game-${index + 1}`,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      startTime: g.startTime,
      spread: { away: g.spread.away, home: g.spread.home },
      moneyline: { away: g.moneyline.away, home: g.moneyline.home },
      total: g.total
    }))
  };
}

/* --------------------------------------------------
   MULTI-SPORT ROTATION ENGINE
-------------------------------------------------- */

function getPoolsBySport(poolsJson) {
  const map = {};
  poolsJson.pools.forEach(pool => {
    if (!map[pool.sport]) map[pool.sport] = [];
    map[pool.sport].push(pool);
  });

  Object.values(map).forEach(list => {
    list.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  });

  return map;
}

function getNextPoolId(poolsJson, sport, currentPoolId) {
  const bySport = getPoolsBySport(poolsJson);
  const list = bySport[sport] || [];
  if (!list.length) return null;

  const idx = list.findIndex(p => p.id === currentPoolId);
  if (idx === -1 || idx === list.length - 1) {
    return list[0].id; // wrap
  }
  return list[idx + 1].id;
}

function rotateCurrentPool(poolsJson, sport) {
  const nextId = getNextPoolId(poolsJson, sport, poolsJson.currentPoolId);
  if (nextId) poolsJson.currentPoolId = nextId;
  return poolsJson;
}

/* --------------------------------------------------
   WEEK SELECTOR UI (ADMIN PANEL)
-------------------------------------------------- */

async function initWeekSelector() {
  const select = document.getElementById("pool-week-select");
  const btn = document.getElementById("set-current-pool-btn");
  const status = document.getElementById("pool-week-status");

  if (!select || !btn) return;

  const poolsJson = await loadPoolsJson();

  poolsJson.pools.forEach(pool => {
    const opt = document.createElement("option");
    opt.value = pool.id;
    opt.textContent = `${pool.sport} • ${pool.label}`;
    if (pool.id === poolsJson.currentPoolId) opt.selected = true;
    select.appendChild(opt);
  });

  btn.addEventListener("click", () => {
    const newId = select.value;
    poolsJson.currentPoolId = newId;

    status.textContent = `Current pool set to: ${newId}`;
    status.classList.add("show");
    setTimeout(() => status.classList.remove("show"), 2500);

    outputPoolsJson(poolsJson);
  });
}

/* --------------------------------------------------
   RESULTS ENTRY HELPER
-------------------------------------------------- */

async function initResultsEntry() {
  const container = document.getElementById("results-entry-container");
  if (!container) return;

  const poolsJson = await loadPoolsJson();
  const resultsRes = await fetch("../data/results.json?v=" + Date.now());
  const resultsJson = await resultsRes.json();

  const poolId = poolsJson.currentPoolId;
  const pool = poolsJson.pools.find(p => p.id === poolId);
  const poolResults = resultsJson[poolId];

  container.innerHTML = "";

  pool.games.forEach(game => {
    const row = document.createElement("div");
    row.className = "result-row";

    row.innerHTML = `
      <strong>${game.awayTeam}</strong>
      <input type="number" class="score-input" data-game="${game.id}" data-team="away" value="${poolResults[game.id].awayScore ?? ""}">
      <strong>${game.homeTeam}</strong>
      <input type="number" class="score-input" data-game="${game.id}" data-team="home" value="${poolResults[game.id].homeScore ?? ""}">
    `;

    container.appendChild(row);
  });

  document.getElementById("save-results-btn")?.addEventListener("click", () => {
    const inputs = container.querySelectorAll(".score-input");

    inputs.forEach(inp => {
      const gameId = inp.dataset.game;
      const team = inp.dataset.team;
      const val = inp.value ? Number(inp.value) : null;
      poolResults[gameId][team + "Score"] = val;
    });

    outputResultsJson(resultsJson);
  });
}

function outputResultsJson(updated) {
  const out = document.getElementById("admin-output");
  out.textContent =
    "Copy this into data/results.json:\n\n" +
    JSON.stringify(updated, null, 2);
  out.classList.add("show");
  setTimeout(() => out.classList.remove("show"), 6000);
}

/* --------------------------------------------------
   ENTRIES VIEWER HELPER
-------------------------------------------------- */

async function initEntriesViewer() {
  const container = document.getElementById("entries-viewer-container");
  if (!container) return;

  const poolsJson = await loadPoolsJson();
  const entriesRes = await fetch("../data/entries.json?v=" + Date.now());
  const entriesJson = await entriesRes.json();

  const poolId = poolsJson.currentPoolId;
  const entries = entriesJson[poolId] || [];

  container.innerHTML = "";

  entries.forEach(entry => {
    const div = document.createElement("div");
    div.className = "entry-block";

    div.innerHTML = `
      <h3>${entry.user}</h3>
      <pre>${JSON.stringify(entry.picks, null, 2)}</pre>
    `;

    container.appendChild(div);
  });
}

/* --------------------------------------------------
   AUTO-INIT
-------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initWeekSelector();
  initResultsEntry();
  initEntriesViewer();
});
