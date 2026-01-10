const POOLS_URL = "./data/pools.json";
const RESULTS_URL = "./data/results.json";
const ENTRIES_URL = "./data/entries.json";
const STORAGE_KEY = "duelkings_picks";

let currentPool = null;
let userPicks = {};

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  loadLocalPicks();
  loadPools();
  setupSaveButton();
});

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
    });
  });
}

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

async function loadPools() {
  try {
    const res = await fetch(POOLS_URL);
    const data = await res.json();
    const pool = data.pools.find(p => p.id === data.currentPoolId);
    currentPool = pool;
    renderPool(pool);
  } catch (e) {
    console.error("Failed to load pools", e);
  }
}

function renderPool(pool) {
  const titleEl = document.getElementById("pool-title");
  const metaEl = document.getElementById("pool-meta");
  const gamesContainer = document.getElementById("games-container");

  titleEl.textContent = pool.label;
  metaEl.textContent = `${pool.sport} • Deadline: ${new Date(pool.deadline).toLocaleString()}`;

  gamesContainer.innerHTML = "";

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
    attachSelectionHandlers(card, pool.id, game.id);

    gamesContainer.appendChild(card);
  });
}

function applyExistingSelections(card, gamePicks) {
  Object.entries(gamePicks).forEach(([type, choice]) => {
    const btn = card.querySelector(`.odds-btn[data-type="${type}"][data-choice="${choice}"]`);
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

function setupSaveButton() {
  const btn = document.getElementById("save-picks-btn");
  const statusEl = document.getElementById("save-status");

  btn.addEventListener("click", () => {
    saveLocalPicks();
    statusEl.textContent = "Picks saved on this device.";
    setTimeout(() => (statusEl.textContent = ""), 2500);
  });
}
