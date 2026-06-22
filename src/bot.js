const {
  ActionRowBuilder,
  Client,
  Events,
  GatewayIntentBits,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
  EmbedBuilder,
  REST,
  Routes
} = require("discord.js");
const { createBattle, getBattle, updateBattle } = require("./storage");

const JOIN_SELECT_ID = "battle-join";
const LEAVE_SELECT_ID = "battle-leave";

function parseCommaList(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getSignupCount(battle) {
  return battle.categories.reduce((total, category) => {
    return total + (battle.signups[category] || []).length;
  }, 0);
}

function buildBattleEmbed(battle) {
  const categoryLines = battle.categories.map((category) => {
    const members = battle.signups[category] || [];

    if (members.length === 0) {
      return `**${category}**\n- keine Anmeldung`;
    }

    const list = members
      .map((member) => `- ${member.displayName} (${member.userTag})`)
      .join("\n");

    return `**${category}**\n${list}`;
  });

  return new EmbedBuilder()
    .setTitle(`Hafenschlacht: ${battle.title}`)
    .setDescription("Spieler koennen sich unten fuer eine Schiffskategorie anmelden.")
    .addFields(
      { name: "Schlacht", value: `${battle.battleTime}\n${battle.battleLocation}`, inline: true },
      { name: "Treffpunkt", value: `${battle.meetingTime}\n${battle.meetingLocation}`, inline: true },
      {
        name: "Rahmen",
        value: `Spieler: ${getSignupCount(battle)}/${battle.playerCount}\nStufen: ${battle.tiers}`,
        inline: true
      },
      { name: "Unterstuetzende Gilden", value: battle.supportGuilds, inline: false },
      { name: "Gegnerische Gilde", value: battle.enemyGuild, inline: false },
      { name: "Schiffskategorien", value: categoryLines.join("\n\n"), inline: false }
    )
    .setFooter({ text: `Schlacht-ID: ${battle.id}` })
    .setTimestamp(new Date(battle.createdAt));
}

function buildBattleComponents(battle) {
  const joinMenu = new StringSelectMenuBuilder()
    .setCustomId(`${JOIN_SELECT_ID}:${battle.id}`)
    .setPlaceholder("In Schiffskategorie eintragen")
    .addOptions(
      battle.categories.map((category) => ({
        label: category,
        value: category
      }))
    );

  const leaveMenu = new StringSelectMenuBuilder()
    .setCustomId(`${LEAVE_SELECT_ID}:${battle.id}`)
    .setPlaceholder("Anmeldung entfernen")
    .addOptions(
      battle.categories.map((category) => ({
        label: category,
        value: category
      }))
    );

  return [
    new ActionRowBuilder().addComponents(joinMenu),
    new ActionRowBuilder().addComponents(leaveMenu)
  ];
}

function removeUserFromAllCategories(battle, userId) {
  for (const category of battle.categories) {
    battle.signups[category] = (battle.signups[category] || []).filter((member) => member.userId !== userId);
  }
}

function addUserToCategory(battle, category, user) {
  removeUserFromAllCategories(battle, user.id);
  battle.signups[category] = battle.signups[category] || [];
  battle.signups[category].push({
    userId: user.id,
    userTag: user.tag,
    displayName: user.globalName || user.username
  });
}

async function refreshBattleMessage(interaction, battle) {
  await interaction.message.edit({
    embeds: [buildBattleEmbed(battle)],
    components: buildBattleComponents(battle)
  });
}

function createCommands() {
  return [
    new SlashCommandBuilder()
      .setName("schlacht-anlegen")
      .setDescription("Legt eine neue Hafenschlacht an")
      .addStringOption((option) =>
        option.setName("titel").setDescription("Name oder kurzer Titel der Schlacht").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("schlacht_zeit").setDescription("Wann ist die Schlacht?").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("schlacht_ort").setDescription("Wo ist die Schlacht?").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("treffpunkt_zeit").setDescription("Wann ist der Treffpunkt?").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("treffpunkt_ort").setDescription("Wo ist der Treffpunkt?").setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName("spielerzahl").setDescription("Wie viele Spieler werden benoetigt?").setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("schiffskategorien")
          .setDescription("Kommagetrennt, z. B. Linienschiff, Fregatte, Support")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("stufen").setDescription("Erlaubte Schiffsstufen, z. B. 6-8").setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("unterstuetzende_gilden")
          .setDescription("Eigene oder verbuendete Gilden")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("gegnerische_gilde").setDescription("Name der Gegnergilde").setRequired(true)
      )
      .toJSON()
  ];
}

async function registerCommands(token, clientId, guildId) {
  const rest = new REST({ version: "10" }).setToken(token);
  const commands = createCommands();

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), { body: commands });
}

async function createBot(config) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Bot online als ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === "schlacht-anlegen") {
        const title = interaction.options.getString("titel", true);
        const categories = parseCommaList(interaction.options.getString("schiffskategorien", true));

        if (categories.length === 0 || categories.length > 25) {
          await interaction.reply({
            content: "Bitte gib zwischen 1 und 25 Schiffskategorien an.",
            ephemeral: true
          });
          return;
        }

        const battle = createBattle({
          id: `${Date.now()}`,
          title,
          battleTime: interaction.options.getString("schlacht_zeit", true),
          battleLocation: interaction.options.getString("schlacht_ort", true),
          meetingTime: interaction.options.getString("treffpunkt_zeit", true),
          meetingLocation: interaction.options.getString("treffpunkt_ort", true),
          playerCount: interaction.options.getInteger("spielerzahl", true),
          categories,
          tiers: interaction.options.getString("stufen", true),
          supportGuilds: interaction.options.getString("unterstuetzende_gilden", true),
          enemyGuild: interaction.options.getString("gegnerische_gilde", true),
          signups: Object.fromEntries(categories.map((category) => [category, []])),
          createdAt: new Date().toISOString()
        });

        await interaction.reply({
          embeds: [buildBattleEmbed(battle)],
          components: buildBattleComponents(battle)
        });
        return;
      }

      if (interaction.isStringSelectMenu()) {
        const [action, battleId] = interaction.customId.split(":");
        const battle = getBattle(battleId);

        if (!battle) {
          await interaction.reply({
            content: "Diese Schlacht wurde nicht gefunden.",
            ephemeral: true
          });
          return;
        }

        const selectedCategory = interaction.values[0];

        if (!battle.categories.includes(selectedCategory)) {
          await interaction.reply({
            content: "Diese Schiffskategorie ist ungueltig.",
            ephemeral: true
          });
          return;
        }

        if (action === JOIN_SELECT_ID) {
          const alreadySignedUp = battle.categories.some((category) =>
            (battle.signups[category] || []).some((member) => member.userId === interaction.user.id)
          );
          const signupCount = getSignupCount(battle);

          if (!alreadySignedUp && signupCount >= battle.playerCount) {
            await interaction.reply({
              content: "Diese Hafenschlacht ist bereits voll.",
              ephemeral: true
            });
            return;
          }

          addUserToCategory(battle, selectedCategory, interaction.user);
          updateBattle(battle);
          await refreshBattleMessage(interaction, battle);
          await interaction.reply({
            content: `Du bist jetzt in **${selectedCategory}** eingetragen.`,
            ephemeral: true
          });
          return;
        }

        if (action === LEAVE_SELECT_ID) {
          battle.signups[selectedCategory] = (battle.signups[selectedCategory] || []).filter(
            (member) => member.userId !== interaction.user.id
          );
          updateBattle(battle);
          await refreshBattleMessage(interaction, battle);
          await interaction.reply({
            content: `Deine Anmeldung fuer **${selectedCategory}** wurde entfernt.`,
            ephemeral: true
          });
        }
      }
    } catch (error) {
      console.error(error);

      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Beim Verarbeiten der Aktion ist ein Fehler aufgetreten.",
          ephemeral: true
        });
      }
    }
  });

  await registerCommands(config.token, config.clientId, config.guildId);
  await client.login(config.token);
}

module.exports = {
  createBot
};
