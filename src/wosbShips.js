const {
  getAllShips,
  getShipById,
  getShipTrees
} = require("./storage");

const SHIP_CLASS_LABELS = {
  fast: "Schnell",
  combat: "Kampf",
  heavy: "Schwer",
  siege: "Belagerung",
  transport: "Transport",
};

function getShipClassLabel(shipClass) {
  return SHIP_CLASS_LABELS[shipClass] || shipClass;
}

function getShipTreeChoices() {
  return getShipTrees().map((tree) => ({
    name: getShipClassLabel(tree),
    value: tree
  }));
}

function getShipClassChoices() {
  return Object.entries(SHIP_CLASS_LABELS).map(([value, label]) => ({
    name: label,
    value
  }));
}

function getShipLevelChoices() {
  return [...new Set(getAllShips().map((ship) => ship.level))]
    .sort((left, right) => left - right)
    .map((level) => ({
      name: `Stufe ${level}`,
      value: String(level)
    }));
}

function getShipChoices() {
  return getAllShips().map((ship) => ({
    name: `${ship.name} (${getShipClassLabel(ship.shipClass)}, Stufe ${ship.level})`,
    value: ship.id
  }));
}

function searchShipChoices({ query = "", tree, shipClass, level, limit = 25 } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedLevel = level == null ? null : Number(level);

  return getAllShips()
    .filter((ship) => {
      if (tree && ship.tree !== tree) {
        return false;
      }

      if (shipClass && ship.shipClass !== shipClass) {
        return false;
      }

      if (normalizedLevel != null && !Number.isNaN(normalizedLevel) && ship.level !== normalizedLevel) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${ship.name} ${ship.tree} ${ship.shipClass} ${ship.level}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (left.level !== right.level) {
        return right.level - left.level;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, limit)
    .map((ship) => ({
      name: `${ship.name} (${getShipClassLabel(ship.shipClass)}, Stufe ${ship.level})`,
      value: ship.id
    }));
}

module.exports = {
  getShipById,
  getShipChoices,
  getShipClassChoices,
  getShipClassLabel,
  getShipLevelChoices,
  getShipTreeChoices,
  searchShipChoices
};
