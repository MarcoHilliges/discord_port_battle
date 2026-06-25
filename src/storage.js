const fs = require("fs");
const path = require("path");

const dataDir = path.join(process.cwd(), "data");
const battleFile = path.join(dataDir, "battles.json");
const shipFile = path.join(dataDir, "ships.json");
const harborFile = path.join(dataDir, "harbors.json");
const settingsFile = path.join(dataDir, "settings.json");

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(battleFile)) {
    fs.writeFileSync(battleFile, JSON.stringify({ battles: [] }, null, 2), "utf8");
  }

  if (!fs.existsSync(shipFile)) {
    fs.writeFileSync(shipFile, JSON.stringify({ shipTrees: {} }, null, 2), "utf8");
  }

  if (!fs.existsSync(harborFile)) {
    fs.writeFileSync(harborFile, JSON.stringify({ harbors: [] }, null, 2), "utf8");
  }

  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({ guildSettings: {} }, null, 2), "utf8");
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

function readHarborStore() {
  ensureStorage();
  const raw = fs.readFileSync(harborFile, "utf8");
  return JSON.parse(raw);
}

function normalizeSettingsStore(store) {
  if (store?.guildSettings && typeof store.guildSettings === "object") {
    return {
      guildSettings: { ...store.guildSettings }
    };
  }

  if (typeof store?.battleChannelId === "string" && store.battleChannelId) {
    return {
      guildSettings: {
        legacy: {
          battleChannelId: store.battleChannelId
        }
      }
    };
  }

  return {
    guildSettings: {}
  };
}

function readSettingsStore() {
  ensureStorage();
  const raw = fs.readFileSync(settingsFile, "utf8");
  return normalizeSettingsStore(JSON.parse(raw));
}

function writeSettingsStore(store) {
  ensureStorage();
  fs.writeFileSync(settingsFile, JSON.stringify(store, null, 2), "utf8");
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

function getHarbors() {
  const store = readHarborStore();
  return store.harbors || [];
}

function getHarborBySlug(harborSlug) {
  return getHarbors().find((harbor) => harbor.harbor === harborSlug) || null;
}

function getBattleChannelId(guildId) {
  const store = readSettingsStore();

  if (!guildId) {
    return "";
  }

  return store.guildSettings?.[guildId]?.battleChannelId || "";
}

function setBattleChannelId(guildId, channelId) {
  if (!guildId) {
    return "";
  }

  const store = readSettingsStore();
  store.guildSettings[guildId] = store.guildSettings[guildId] || {};
  store.guildSettings[guildId].battleChannelId = channelId || "";
  writeSettingsStore(store);
  return store.guildSettings[guildId].battleChannelId;
}

module.exports = {
  createBattle,
  getBattle,
  updateBattle,
  getAllShips,
  getHarbors,
  getHarborBySlug,
  getBattleChannelId,
  getShipById,
  getShipTrees,
  setBattleChannelId
};
