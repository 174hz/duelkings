function getTeamAbbrev(name) {
  const map = {
    "Buffalo Bills": "BUF", "Miami Dolphins": "MIA", "New England Patriots": "NE", "New York Jets": "NYJ",
    "Baltimore Ravens": "BAL", "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Pittsburgh Steelers": "PIT",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX", "Tennessee Titans": "TEN",
    "Denver Broncos": "DEN", "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Los Angeles Chargers": "LAC",
    "Dallas Cowboys": "DAL", "New York Giants": "NYG", "Philadelphia Eagles": "PHI", "Washington Commanders": "WAS",
    "Chicago Bears": "CHI", "Detroit Lions": "DET", "Green Bay Packers": "GB", "Minnesota Vikings": "MIN",
    "Atlanta Falcons": "ATL", "Carolina Panthers": "CAR", "New Orleans Saints": "NO", "Tampa Bay Buccaneers": "TB",
    "Arizona Cardinals": "ARI", "Los Angeles Rams": "LAR", "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA"
  };
  return map[name] || name.substring(0, 3).toUpperCase();
}

function createCompactMatchupCard(game, isOpen) {
  const card = document.createElement("div");
  card.className = "matchup-card compact";
  card.dataset.gameId = game.id;

  const awayAbbr = getTeamAbbrev(game.awayTeam);
  const homeAbbr = getTeamAbbrev(game.homeTeam);

  const row = document.createElement("div");
  row.className = "matchup-row";

  row.innerHTML = `
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
  `;

  card.appendChild(row);
  setTimeout(() => card.classList.add("loaded"), 10);

  row.querySelectorAll(".odds-btn").forEach(btn => {
    if (!isOpen) btn.classList.add("locked");

    btn.addEventListener("click", () => {
      if (!isOpen) return;

      const type = btn.dataset.type;
      const side = btn.dataset.side;

      if (!userPicks[game.id]) userPicks[game.id] = {};
      userPicks[game.id][type] = side;

      row.querySelectorAll(`.odds-btn[data-type="${type}"]`)
        .forEach(b => b.classList.remove("selected"));

      btn.classList.add("selected");

      if (type === "spread") {
        const mlBtn = row.querySelector(`.odds-btn[data-type="moneyline"][data-side="${side}"]`);
        if (mlBtn) {
          row.querySelectorAll(`.odds-btn[data-type="moneyline"]`)
            .forEach(b => b.classList.remove("selected"));
          mlBtn.classList.add("selected");
          userPicks[game.id]["moneyline"] = side;
        }
      }
    });
  });

  return card;
}


