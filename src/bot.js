const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const { createBattle, getBattle, updateBattle } = require("./storage");
const { getShipClassChoices, getShipClassLabel, getShipLevelChoices } = require("./wosbShips");

const JOIN_SELECT_ID = "battle-join";
const LEAVE_SELECT_ID = "battle-leave";

const CREATE_BATTLE_MODAL_ID = "create-battle-modal";

const DRAFT_STAGE_BATTLE = "battle";
const DRAFT_STAGE_MEETING = "meeting";
const DRAFT_STAGE_FLEET = "fleet";

const DRAFT_BATTLE_LOCATION_ID = "draft-battle-location";
const DRAFT_BATTLE_DATE_ID = "draft-battle-date";
const DRAFT_BATTLE_HOUR_ID = "draft-battle-hour";
const DRAFT_BATTLE_MINUTE_ID = "draft-battle-minute";

const DRAFT_MEETING_LOCATION_ID = "draft-meeting-location";
const DRAFT_MEETING_DATE_ID = "draft-meeting-date";
const DRAFT_MEETING_TIME_SELECT_ID = "draft-meeting-time";

const DRAFT_PLAYER_COUNT_ID = "draft-player-count";
const DRAFT_SHIP_CLASSES_ID = "draft-ship-classes";
const DRAFT_SHIP_LEVELS_ID = "draft-ship-levels";

const DRAFT_NEXT_ID = "draft-next";
const DRAFT_BACK_ID = "draft-back";
const DRAFT_CONFIRM_ID = "draft-confirm";
const DRAFT_CANCEL_ID = "draft-cancel";

const draftStore = new Map();

const PORT_CHOICES = [
  { label: "Port Radel", value: "Port Radel" }
];

const PLAYER_COUNT_CHOICES = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "15", value: "15" },
  { label: "20", value: "20" }
];

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function createUpcomingDateChoices(days = 14) {
  const choices = [];
  const now = new Date();

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);

    const year = date.getFullYear();
    const month = padNumber(date.getMonth() + 1);
    const day = padNumber(date.getDate());

    choices.push({
      label: `${day}.${month}.${year}`,
      value: `${year}-${month}-${day}`
    });
  }

  return choices;
}

function createHourChoices() {
  const choices = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const value = padNumber(hour);
    choices.push({
      label: `${value}:xx`,
      value
    });
  }

  return choices;
}

function createMinuteChoices() {
  return ["00", "15", "30", "45"].map((value) => ({
    label: `:${value}`,
    value
  }));
}

function timeValueToMinutes(value) {
  if (!value) {
    return null;
  }

  const [hour, minute] = value.split(":").map((part) => Number.parseInt(part, 10));

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  return (hour * 60) + minute;
}

function minutesToTimeValue(totalMinutes) {
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${padNumber(hour)}:${padNumber(minute)}`;
}

function buildTimeFromParts(hour, minute) {
  if (!hour || !minute) {
    return "";
  }

  return `${hour}:${minute}`;
}

function createMeetingTimeChoices(battleHour, battleMinute) {
  const battleTime = buildTimeFromParts(battleHour, battleMinute);
  const battleMinutes = timeValueToMinutes(battleTime);

  if (battleMinutes == null) {
    return [];
  }

  const choices = [];

  for (let offset = 120; offset >= 15; offset -= 15) {
    const value = minutesToTimeValue(battleMinutes - offset);
    choices.push({
      label: `${value} (${offset} Min vorher)`,
      value
    });
  }

  return choices;
}

function formatDateValue(value) {
  if (!value) {
    return "Noch nicht gesetzt";
  }

  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function getSignupCount(battle) {
  return battle.categories.reduce((total, category) => {
    return total + (battle.signups[category] || []).length;
  }, 0);
}

function buildSignupCategories(shipClasses, shipLevels) {
  const categories = [];

  for (const shipClass of shipClasses) {
    for (const level of shipLevels) {
      categories.push(`${getShipClassLabel(shipClass)} - Stufe ${level}`);
    }
  }

  return categories;
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
      { name: "Schlacht", value: `${battle.battleDate} ${battle.battleTime}\n${battle.battleLocation}`, inline: true },
      { name: "Treffpunkt", value: `${battle.meetingDate} ${battle.meetingTime}\n${battle.meetingLocation}`, inline: true },
      { name: "Rahmen", value: `Spieler: ${getSignupCount(battle)}/${battle.playerCount}`, inline: true },
      { name: "Ausrichtende Gilde", value: battle.hostingGuild, inline: false },
      { name: "Unterstuetzende Gilden", value: battle.supportGuilds || "-", inline: false },
      { name: "Gegnerische Gilde", value: battle.enemyGuild, inline: false },
      {
        name: "Vorgaben",
        value: `Klassen: ${battle.shipClassLabels.join(", ")}\nStufen: ${battle.shipLevels.map((level) => `Stufe ${level}`).join(", ")}`,
        inline: false
      },
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

function buildCreateBattleModal() {
  return new ModalBuilder()
    .setCustomId(CREATE_BATTLE_MODAL_ID)
    .setTitle("1. Allgemeine Angaben")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("hosting_guild")
          .setLabel("Ausrichtende Gilde")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("support_guilds")
          .setLabel("Unterstuetzende Gilden")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(250)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("enemy_guild")
          .setLabel("Gegnerische Gilde")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      )
    );
}

function buildDraftEmbed(draft) {
  const battleTime = buildTimeFromParts(draft.battleHour, draft.battleMinute);
  const classText =
    draft.shipClasses.length > 0
      ? draft.shipClasses.map((shipClass) => getShipClassLabel(shipClass)).join(", ")
      : "Noch nicht gesetzt";
  const levelText =
    draft.shipLevels.length > 0
      ? draft.shipLevels.map((level) => `Stufe ${level}`).join(", ")
      : "Noch nicht gesetzt";

  let description = "Waehle jetzt Ort, Datum und Uhrzeit der Schlacht.";

  if (draft.stage === DRAFT_STAGE_MEETING) {
    description = "Waehle jetzt Treffpunkt-Ort, Datum und Uhrzeit.";
  } else if (draft.stage === DRAFT_STAGE_FLEET) {
    description = "Waehle jetzt Spieleranzahl, Schiffklassen und Schiffsstufen.";
  }

  return new EmbedBuilder()
    .setTitle(`Neue Hafenschlacht: ${draft.title}`)
    .setDescription(description)
    .addFields(
      { name: "Ausrichtende Gilde", value: draft.hostingGuild, inline: false },
      { name: "Unterstuetzende Gilden", value: draft.supportGuilds || "-", inline: false },
      { name: "Gegnerische Gilde", value: draft.enemyGuild, inline: false },
      { name: "Schlacht", value: `${draft.battleLocation || "Noch nicht gesetzt"}\n${formatDateValue(draft.battleDate)} ${battleTime || "Noch nicht gesetzt"}`, inline: false },
      { name: "Treffpunkt", value: `${draft.meetingLocation || "Noch nicht gesetzt"}\n${formatDateValue(draft.meetingDate)} ${draft.meetingTime || "Noch nicht gesetzt"}`, inline: false },
      { name: "Spieleranzahl", value: draft.playerCount ? String(draft.playerCount) : "Noch nicht gesetzt", inline: true },
      { name: "Schiffklassen", value: classText, inline: false },
      { name: "Schiffsstufen", value: levelText, inline: false }
    );
}

function buildBattleStageComponents(draft) {
  const battleDateChoices = createUpcomingDateChoices();
  const hourChoices = createHourChoices();
  const minuteChoices = createMinuteChoices();

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_BATTLE_LOCATION_ID}:${draft.id}`)
        .setPlaceholder("Ort waehlen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          PORT_CHOICES.map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.battleLocation === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_BATTLE_DATE_ID}:${draft.id}`)
        .setPlaceholder("Datum waehlen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          battleDateChoices.map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.battleDate === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_BATTLE_HOUR_ID}:${draft.id}`)
        .setPlaceholder("Stunde waehlen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          hourChoices.map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.battleHour === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_BATTLE_MINUTE_ID}:${draft.id}`)
        .setPlaceholder("Minute waehlen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          minuteChoices.map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.battleMinute === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${DRAFT_NEXT_ID}:${draft.id}`)
        .setLabel("Weiter zu Treffpunkt")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_CANCEL_ID}:${draft.id}`)
        .setLabel("Abbrechen")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildMeetingStageComponents(draft) {
  const meetingDateChoices = createUpcomingDateChoices();
  const meetingTimeChoices = createMeetingTimeChoices(draft.battleHour, draft.battleMinute);

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_MEETING_LOCATION_ID}:${draft.id}`)
        .setPlaceholder("Treffpunkt-Ort waehlen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          PORT_CHOICES.map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.meetingLocation === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_MEETING_DATE_ID}:${draft.id}`)
        .setPlaceholder("Treffpunkt-Datum waehlen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          meetingDateChoices.map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.meetingDate === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_MEETING_TIME_SELECT_ID}:${draft.id}`)
        .setPlaceholder("Treffpunkt-Uhrzeit waehlen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          (meetingTimeChoices.length > 0
            ? meetingTimeChoices
            : [{ label: "Bitte erst Schlachtuhrzeit waehlen", value: "pending" }]).map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.meetingTime === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${DRAFT_BACK_ID}:${draft.id}`)
        .setLabel("Zurueck")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_NEXT_ID}:${draft.id}`)
        .setLabel("Weiter zu Flotte")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_CANCEL_ID}:${draft.id}`)
        .setLabel("Abbrechen")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildFleetStageComponents(draft) {
  const shipClassChoices = getShipClassChoices();
  const shipLevelChoices = getShipLevelChoices();

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_PLAYER_COUNT_ID}:${draft.id}`)
        .setPlaceholder("Spieleranzahl waehlen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          PLAYER_COUNT_CHOICES.map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: String(draft.playerCount || "") === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_SHIP_CLASSES_ID}:${draft.id}`)
        .setPlaceholder("Schiffklassen waehlen")
        .setMinValues(1)
        .setMaxValues(shipClassChoices.length)
        .addOptions(
          shipClassChoices.map((choice) => ({
            label: choice.name,
            value: choice.value,
            default: draft.shipClasses.includes(choice.value)
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_SHIP_LEVELS_ID}:${draft.id}`)
        .setPlaceholder("Schiffsstufen waehlen")
        .setMinValues(1)
        .setMaxValues(shipLevelChoices.length)
        .addOptions(
          shipLevelChoices.map((choice) => ({
            label: choice.name,
            value: choice.value,
            default: draft.shipLevels.includes(Number(choice.value))
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${DRAFT_BACK_ID}:${draft.id}`)
        .setLabel("Zurueck")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_CONFIRM_ID}:${draft.id}`)
        .setLabel("Schlacht erstellen")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_CANCEL_ID}:${draft.id}`)
        .setLabel("Abbrechen")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildDraftComponents(draft) {
  if (draft.stage === DRAFT_STAGE_BATTLE) {
    return buildBattleStageComponents(draft);
  }

  if (draft.stage === DRAFT_STAGE_MEETING) {
    return buildMeetingStageComponents(draft);
  }

  return buildFleetStageComponents(draft);
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
        await interaction.showModal(buildCreateBattleModal());
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === CREATE_BATTLE_MODAL_ID) {
          const draft = {
            id: `${Date.now()}`,
            ownerId: interaction.user.id,
            stage: DRAFT_STAGE_BATTLE,
            title: interaction.fields.getTextInputValue("title"),
            hostingGuild: interaction.fields.getTextInputValue("hosting_guild"),
            supportGuilds: interaction.fields.getTextInputValue("support_guilds"),
            enemyGuild: interaction.fields.getTextInputValue("enemy_guild"),
            battleLocation: "",
            battleDate: "",
            battleHour: "",
            battleMinute: "",
            meetingLocation: "",
            meetingDate: "",
            meetingTime: "",
            playerCount: 0,
            shipClasses: [],
            shipLevels: []
          };

          draftStore.set(draft.id, draft);

          await interaction.reply({
            embeds: [buildDraftEmbed(draft)],
            components: buildDraftComponents(draft),
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        return;
      }

      if (interaction.isButton()) {
        const [action, draftId] = interaction.customId.split(":");
        const draft = draftStore.get(draftId);

        if (!draft) {
          await interaction.reply({
            content: "Dieser Schlacht-Entwurf wurde nicht gefunden.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (draft.ownerId !== interaction.user.id) {
          await interaction.reply({
            content: "Nur der Ersteller kann diesen Entwurf bearbeiten.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (action === DRAFT_NEXT_ID) {
          if (draft.stage === DRAFT_STAGE_BATTLE) {
            if (!draft.battleLocation || !draft.battleDate || !draft.battleHour || !draft.battleMinute) {
              await interaction.reply({
                content: "Bitte waehle zuerst Ort, Datum und Uhrzeit der Schlacht aus.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            draft.stage = DRAFT_STAGE_MEETING;
            if (!draft.meetingDate) {
              draft.meetingDate = draft.battleDate;
            }
            draftStore.set(draft.id, draft);
            await interaction.update({
              embeds: [buildDraftEmbed(draft)],
              components: buildDraftComponents(draft)
            });
            return;
          }

          if (draft.stage === DRAFT_STAGE_MEETING) {
            if (!draft.meetingLocation || !draft.meetingDate || !draft.meetingTime) {
              await interaction.reply({
                content: "Bitte waehle zuerst Ort, Datum und Uhrzeit des Treffpunkts aus.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            draft.stage = DRAFT_STAGE_FLEET;
            draftStore.set(draft.id, draft);
            await interaction.update({
              embeds: [buildDraftEmbed(draft)],
              components: buildDraftComponents(draft)
            });
          }
          return;
        }

        if (action === DRAFT_BACK_ID) {
          if (draft.stage === DRAFT_STAGE_MEETING) {
            draft.stage = DRAFT_STAGE_BATTLE;
          } else if (draft.stage === DRAFT_STAGE_FLEET) {
            draft.stage = DRAFT_STAGE_MEETING;
          }

          draftStore.set(draft.id, draft);
          await interaction.update({
            embeds: [buildDraftEmbed(draft)],
            components: buildDraftComponents(draft)
          });
          return;
        }

        if (action === DRAFT_CONFIRM_ID) {
          if (draft.playerCount <= 0 || draft.shipClasses.length === 0 || draft.shipLevels.length === 0) {
            await interaction.reply({
              content: "Bitte waehle zuerst Spieleranzahl, Schiffklassen und Schiffsstufen aus.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          const categories = buildSignupCategories(draft.shipClasses, draft.shipLevels);

          if (categories.length > 25) {
            await interaction.reply({
              content: `Es entstehen ${categories.length} Anmeldeoptionen. Discord erlaubt maximal 25. Bitte waehle weniger Klassen oder Stufen.`,
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          const battle = createBattle({
            id: `${Date.now()}`,
            title: draft.title,
            battleDate: draft.battleDate,
            battleTime: buildTimeFromParts(draft.battleHour, draft.battleMinute),
            battleLocation: draft.battleLocation,
            meetingDate: draft.meetingDate,
            meetingTime: draft.meetingTime,
            meetingLocation: draft.meetingLocation,
            playerCount: draft.playerCount,
            hostingGuild: draft.hostingGuild,
            supportGuilds: draft.supportGuilds,
            enemyGuild: draft.enemyGuild,
            shipClasses: [...draft.shipClasses],
            shipClassLabels: draft.shipClasses.map((shipClass) => getShipClassLabel(shipClass)),
            shipLevels: [...draft.shipLevels],
            categories,
            signups: Object.fromEntries(categories.map((category) => [category, []])),
            createdAt: new Date().toISOString()
          });

          draftStore.delete(draftId);

          await interaction.update({
            content: "Die Hafenschlacht wurde erstellt.",
            embeds: [],
            components: []
          });

          if (interaction.channel && interaction.channel.isTextBased()) {
            await interaction.channel.send({
              embeds: [buildBattleEmbed(battle)],
              components: buildBattleComponents(battle)
            });
          }
          return;
        }

        if (action === DRAFT_CANCEL_ID) {
          draftStore.delete(draftId);
          await interaction.update({
            content: "Die Erstellung der Hafenschlacht wurde abgebrochen.",
            embeds: [],
            components: []
          });
        }

        return;
      }

      if (interaction.isStringSelectMenu()) {
        const [action, draftId] = interaction.customId.split(":");
        const draft = draftStore.get(draftId);

        if (draft) {
          if (draft.ownerId !== interaction.user.id) {
            await interaction.reply({
              content: "Nur der Ersteller kann diesen Entwurf bearbeiten.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (action === DRAFT_BATTLE_LOCATION_ID) {
            draft.battleLocation = interaction.values[0];
          } else if (action === DRAFT_BATTLE_DATE_ID) {
            draft.battleDate = interaction.values[0];
          } else if (action === DRAFT_BATTLE_HOUR_ID) {
            draft.battleHour = interaction.values[0];
            draft.meetingTime = "";
          } else if (action === DRAFT_BATTLE_MINUTE_ID) {
            draft.battleMinute = interaction.values[0];
            draft.meetingTime = "";
          } else if (action === DRAFT_MEETING_LOCATION_ID) {
            draft.meetingLocation = interaction.values[0];
          } else if (action === DRAFT_MEETING_DATE_ID) {
            draft.meetingDate = interaction.values[0];
          } else if (action === DRAFT_MEETING_TIME_SELECT_ID) {
            if (interaction.values[0] === "pending") {
              await interaction.reply({
                content: "Bitte waehle zuerst die Schlachtuhrzeit aus.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            draft.meetingTime = interaction.values[0];
          } else if (action === DRAFT_PLAYER_COUNT_ID) {
            draft.playerCount = Number(interaction.values[0]);
          } else if (action === DRAFT_SHIP_CLASSES_ID) {
            draft.shipClasses = [...interaction.values];
          } else if (action === DRAFT_SHIP_LEVELS_ID) {
            draft.shipLevels = interaction.values.map((value) => Number(value)).sort((left, right) => left - right);
          }

          draftStore.set(draft.id, draft);
          await interaction.update({
            embeds: [buildDraftEmbed(draft)],
            components: buildDraftComponents(draft)
          });
          return;
        }

        const battle = getBattle(draftId);

        if (!battle) {
          await interaction.reply({
            content: "Diese Schlacht wurde nicht gefunden.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const selectedCategory = interaction.values[0];

        if (!battle.categories.includes(selectedCategory)) {
          await interaction.reply({
            content: "Diese Schiffskategorie ist ungueltig.",
            flags: MessageFlags.Ephemeral
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
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          addUserToCategory(battle, selectedCategory, interaction.user);
          updateBattle(battle);
          await refreshBattleMessage(interaction, battle);
          await interaction.reply({
            content: `Du bist jetzt in **${selectedCategory}** eingetragen.`,
            flags: MessageFlags.Ephemeral
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
            flags: MessageFlags.Ephemeral
          });
        }
      }
    } catch (error) {
      console.error(error);

      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Beim Verarbeiten der Aktion ist ein Fehler aufgetreten.",
          flags: MessageFlags.Ephemeral
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
