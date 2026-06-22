const fs = require("fs");
const path = require("path");

const dataDir = path.join(process.cwd(), "data");
const battleFile = path.join(dataDir, "battles.json");
const shipFile = path.join(dataDir, "ships.json");

const DEFAULT_SHIP_TREES = {
  fast: [
    { id: "pickle", name: "Pickle", shipClass: "fast", level: 7, notes: "", tree: "fast" },
    { id: "le_cerf", name: "Le Cerf", shipClass: "fast", level: 6, notes: "", tree: "fast" },
    { id: "la_creole", name: "La Creole", shipClass: "fast", level: 5, notes: "", tree: "fast" },
    { id: "surprise", name: "Surprise", shipClass: "fast", level: 4, notes: "", tree: "fast" },
    { id: "poltava", name: "Poltava", shipClass: "fast", level: 3, notes: "", tree: "fast" },
    { id: "ingermanland", name: "Ingermanland", shipClass: "fast", level: 2, notes: "", tree: "fast" }
  ],
  combat: [
    { id: "horizont", name: "Horizont", shipClass: "combat", level: 7, notes: "", tree: "combat" },
    { id: "la_salamandre", name: "La Salamandre", shipClass: "combat", level: 6, notes: "", tree: "combat" },
    { id: "black_wind", name: "Black Wind", shipClass: "combat", level: 5, notes: "", tree: "combat" },
    { id: "essex", name: "Essex", shipClass: "combat", level: 4, notes: "", tree: "combat" },
    { id: "devourer", name: "Devourer", shipClass: "combat", level: 4, notes: "", tree: "combat" },
    { id: "anson", name: "Anson", shipClass: "combat", level: 3, notes: "", tree: "combat" },
    { id: "sans_pareil", name: "Sans Pareil", shipClass: "combat", level: 2, notes: "", tree: "combat" },
    { id: "victory", name: "Victory", shipClass: "combat", level: 1, notes: "", tree: "combat" }
  ],
  transport: [
    { id: "friede", name: "Friede", shipClass: "transport", level: 7, notes: "", tree: "transport" },
    { id: "mercury", name: "Mercury", shipClass: "transport", level: 6, notes: "", tree: "transport" },
    { id: "russia", name: "Russia", shipClass: "transport", level: 5, notes: "", tree: "transport" },
    { id: "falmouth", name: "Falmouth", shipClass: "transport", level: 4, notes: "", tree: "transport" },
    { id: "mordaunt", name: "Mordaunt", shipClass: "transport", level: 3, notes: "", tree: "transport" },
    { id: "la_sirene", name: "La Sirene", shipClass: "transport", level: 2, notes: "", tree: "transport" },
    { id: "la_couronne", name: "La Couronne", shipClass: "transport", level: 1, notes: "", tree: "transport" },
  ],
  heavy: [
    { id: "phoenix", name: "Phoenix", shipClass: "heavy", level: 6, notes: "", tree: "heavy" },
    { id: "san_martin", name: "San Martin", shipClass: "heavy", level: 5, notes: "", tree: "heavy" },
    { id: "constitution", name: "Constitution", shipClass: "heavy", level: 4, notes: "", tree: "heavy" },
    { id: "bellona", name: "Bellona", shipClass: "heavy", level: 3, notes: "", tree: "heavy" },
    { id: "redoutable", name: "Redoutable", shipClass: "heavy", level: 2, notes: "", tree: "heavy" },
    { id: "apostolov", name: "Apostolov", shipClass: "heavy", level: 1, notes: "", tree: "heavy" }
  ],
  siege: [
    { id: "polacca", name: "Polacca", shipClass: "siege", level: 6, notes: "", tree: "siege" },
    { id: "le_requin", name: "Le Requin", shipClass: "siege", level: 5, notes: "", tree: "siege" },
    { id: "kobukson", name: "Kobukson", shipClass: "siege", level: 3, notes: "", tree: "siege" },
    { id: "adventure", name: "Adventure", shipClass: "siege", level: 2, notes: "", tree: "siege" },
    { id: "la_royale", name: "La Royale", shipClass: "siege", level: 1, notes: "", tree: "siege" }
  ],
  imperial: [
    { id: "balloon", name: "Balloon", shipClass: "fast", level: 6, notes: "", tree: "imperial" },
    { id: "black_prince", name: "Black Prince", shipClass: "combat", level: 5, notes: "", tree: "imperial" },
    { id: "deadfish", name: "Deadfish", shipClass: "combat", level: 3, notes: "", tree: "imperial" },
    { id: "octopus", name: "Octopus", shipClass: "combat", level: 2, notes: "", tree: "imperial" },
    { id: "huracan", name: "Huracan", shipClass: "heavy", level: 1, notes: "", tree: "imperial" }
  ],
  premium: [
    { id: "savannah", name: "Savannah", shipClass: "fast", level: 6, notes: "", tree: "premium" },
    { id: "golden_apostle", name: "Golden Apostle", shipClass: "siege", level: 6, notes: "", tree: "premium" },
    { id: "shunsen", name: "Shunsen", shipClass: "combat", level: 6, notes: "", tree: "premium" },
    { id: "eagle", name: "Eagle", shipClass: "siege", level: 5, notes: "", tree: "premium" },
    { id: "axel_thorsen", name: "Axel Thorsen", shipClass: "fast", level: 5, notes: "", tree: "premium" },
    { id: "kwee_song", name: "Kwee Song", shipClass: "combat", level: 5, notes: "", tree: "premium" },
    { id: "southampton", name: "Southampton", shipClass: "transport", level: 5, notes: "", tree: "premium" },
    { id: "red_arrow", name: "Red Arrow", shipClass: "combat", level: 4, notes: "", tree: "premium" },
    { id: "sparrow", name: "Sparrow", shipClass: "siege", level: 4, notes: "", tree: "premium" },
    { id: "savannah", name: "Savannah", shipClass: "fast", level: 4, notes: "", tree: "premium" },
    { id: "friedrich_wilhelm", name: "Friedrich Wilhelm", shipClass: "transport", level: 4, notes: "", tree: "premium" },
    { id: "flying_cloud", name: "Flying Cloud", shipClass: "transport", level: 4, notes: "", tree: "premium" },
    { id: "three_hierarchs", name: "Three Hierarchs", shipClass: "heavy", level: 4, notes: "", tree: "premium" },
    { id: "prinz_willem", name: "Prinz Willem", shipClass: "transport", level: 3, notes: "", tree: "premium" },
    { id: "le_saint_louis", name: "Le Saint Louis", shipClass: "combat", level: 3, notes: "", tree: "premium" },
    { id: "azov", name: "Azov", shipClass: "heavy", level: 3, notes: "", tree: "premium" },
    { id: "shen", name: "Shen", shipClass: "siege", level: 3, notes: "", tree: "premium" },
    { id: "iberia", name: "Iberia", shipClass: "fast", level: 3, notes: "", tree: "premium" },
    { id: "firestorm", name: "Firestorm", shipClass: "fast", level: 2, notes: "", tree: "premium" },
    { id: "neptuno", name: "Neptuno", shipClass: "combat", level: 2, notes: "", tree: "premium" },
    { id: "vasa", name: "Vasa", shipClass: "heavy", level: 2, notes: "", tree: "premium" },
    { id: "st._pavel", name: "St. Pavel", shipClass: "heavy", level: 2, notes: "", tree: "premium" },
    { id: "montanes", name: "Montanes", shipClass: "combat", level: 2, notes: "", tree: "premium" },
    { id: "santisima_trinidad", name: "Santísima Trinidad", shipClass: "heavy", level: 1, notes: "", tree: "premium" },
    { id: "de_zeven_provincien", name: "De Zeven Provincien", shipClass: "combat", level: 1, notes: "", tree: "premium" },
    { id: "sovereign", name: "Sovereign", shipClass: "combat", level: 1, notes: "", tree: "premium" },
  ]
};

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(battleFile)) {
    fs.writeFileSync(battleFile, JSON.stringify({ battles: [] }, null, 2), "utf8");
  }

  if (!fs.existsSync(shipFile)) {
    fs.writeFileSync(shipFile, JSON.stringify({ shipTrees: DEFAULT_SHIP_TREES }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStorage();
  const raw = fs.readFileSync(battleFile, "utf8");
  return JSON.parse(raw);
}

function writeStore(store) {
  ensureStorage();
  fs.writeFileSync(battleFile, JSON.stringify(store, null, 2), "utf8");
}

function readShipStore() {
  ensureStorage();
  const raw = fs.readFileSync(shipFile, "utf8");
  return JSON.parse(raw);
}

function createBattle(battle) {
  const store = readStore();
  store.battles.push(battle);
  writeStore(store);
  return battle;
}

function getBattle(battleId) {
  const store = readStore();
  return store.battles.find((battle) => battle.id === battleId) || null;
}

function updateBattle(updatedBattle) {
  const store = readStore();
  const index = store.battles.findIndex((battle) => battle.id === updatedBattle.id);

  if (index === -1) {
    return null;
  }

  store.battles[index] = updatedBattle;
  writeStore(store);
  return updatedBattle;
}

function getShipTrees() {
  const store = readShipStore();
  return Object.keys(store.shipTrees || {});
}

function getAllShips() {
  const store = readShipStore();
  return Object.values(store.shipTrees || {}).flat();
}

function getShipById(shipId) {
  return getAllShips().find((ship) => ship.id === shipId) || null;
}

module.exports = {
  createBattle,
  getBattle,
  updateBattle,
  getAllShips,
  getShipById,
  getShipTrees
};
