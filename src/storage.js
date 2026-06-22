const fs = require("fs");
const path = require("path");

const dataDir = path.join(process.cwd(), "data");
const battleFile = path.join(dataDir, "battles.json");

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(battleFile)) {
    fs.writeFileSync(battleFile, JSON.stringify({ battles: [] }, null, 2), "utf8");
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

module.exports = {
  createBattle,
  getBattle,
  updateBattle
};
