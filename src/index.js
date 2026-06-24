require("dotenv").config();
const { createBot } = require("./bot");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const panelChannelId = process.env.BATTLE_PANEL_CHANNEL_ID || process.env.PANEL_CHANNEL_ID;

if (!token || !clientId) {
  console.error("Bitte DISCORD_TOKEN und CLIENT_ID in der .env setzen.");
  process.exit(1);
}

createBot({ token, clientId, guildId, panelChannelId }).catch((error) => {
  console.error("Bot konnte nicht gestartet werden:", error);
  process.exit(1);
});
