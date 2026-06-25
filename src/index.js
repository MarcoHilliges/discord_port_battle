require("dotenv").config();
const { createBot } = require("./bot");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildIds = (process.env.GUILD_IDS || process.env.GUILD_ID || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!token || !clientId) {
  console.error("Bitte DISCORD_TOKEN und CLIENT_ID in der .env setzen.");
  process.exit(1);
}

createBot({ token, clientId, guildIds }).catch((error) => {
  console.error("Bot konnte nicht gestartet werden:", error);
  process.exit(1);
});
