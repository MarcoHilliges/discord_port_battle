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
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const {
  createBattle,
  getAllShips,
  getBattle,
  getBattleChannelId,
  getGuildClassLimitDefaults,
  getHarborBySlug,
  getHarbors,
  getShipById,
  setBattleChannelId,
  setGuildClassLimitDefaults,
  updateBattle
} = require("./storage");
const { getShipClassChoices, getShipClassLabel, getShipLevelChoices } = require("./wosbShips");

const SIGNUP_BUTTON_ID = "battle-signup";
const RESERVE_BUTTON_ID = "battle-reserve";
const CHANGE_BUTTON_ID = "battle-change";
const UNREGISTER_BUTTON_ID = "battle-unregister";
const EDIT_BATTLE_BUTTON_ID = "battle-edit";
const VIEW_UNREGISTRATIONS_BUTTON_ID = "battle-view-unregistrations";
const VIEW_UNREGISTRATIONS_PREV_BUTTON_ID = "battle-view-unregistrations-prev";
const VIEW_UNREGISTRATIONS_NEXT_BUTTON_ID = "battle-view-unregistrations-next";
const VIEW_UNREGISTRATIONS_CLOSE_BUTTON_ID = "battle-view-unregistrations-close";
const CHANGE_TO_SIGNUP_BUTTON_ID = "battle-change-signup";
const CHANGE_TO_RESERVE_BUTTON_ID = "battle-change-reserve";
const CATEGORY_SELECT_ID = "battle-category";
const SHIP_SELECT_ID = "battle-ship";
const OPEN_CREATE_BATTLE_BUTTON_ID = "open-create-battle";

const CREATE_BATTLE_MODAL_ID = "create-battle-modal";
const EDIT_BATTLE_MODAL_ID = "edit-battle-modal";
const CLASS_LIMITS_MODAL_ID = "draft-class-limits-modal";
const CLASS_LIMIT_DEFAULTS_MODAL_ID = "class-limit-defaults-modal";

const DRAFT_STAGE_BATTLE = "battle";
const DRAFT_STAGE_BATTLE_SCHEDULE = "battle-schedule";
const DRAFT_STAGE_MEETING = "meeting";
const DRAFT_STAGE_FLEET = "fleet";
const DRAFT_STAGE_CLASS_LIMITS = "class-limits";

const DRAFT_BATTLE_LOCATION_ID = "draft-battle-location";
const DRAFT_BATTLE_DATE_ID = "draft-battle-date";
const DRAFT_BATTLE_HOUR_ID = "draft-battle-hour";
const DRAFT_BATTLE_MINUTE_ID = "draft-battle-minute";

const DRAFT_MEETING_LOCATION_ID = "draft-meeting-location";
const DRAFT_MEETING_LIGHTHOUSE_ID = "draft-meeting-lighthouse";
const DRAFT_MEETING_DATE_ID = "draft-meeting-date";
const DRAFT_MEETING_TIME_SELECT_ID = "draft-meeting-time";

const DRAFT_PLAYER_COUNT_ID = "draft-player-count";
const DRAFT_SHIP_CLASSES_ID = "draft-ship-classes";
const DRAFT_SHIP_LEVELS_ID = "draft-ship-levels";

const DRAFT_NEXT_ID = "draft-next";
const DRAFT_BACK_ID = "draft-back";
const DRAFT_HARBOR_PAGE_PREV_ID = "draft-harbor-page-prev";
const DRAFT_HARBOR_PAGE_NEXT_ID = "draft-harbor-page-next";
const DRAFT_CONFIRM_ID = "draft-confirm";
const DRAFT_CANCEL_ID = "draft-cancel";
const DRAFT_EDIT_CLASS_LIMITS_ID = "draft-edit-class-limits";
const DRAFT_TOGGLE_CLASS_LIMIT_ENFORCEMENT_ID = "draft-toggle-class-limit-enforcement";

const draftStore = new Map();

const HARBOR_PAGE_SIZE = 25;
const UNREGISTRATIONS_PAGE_SIZE = 10;

const PLAYER_COUNT_CHOICES = [
  { label: "5", value: "5" },
  { label: "10", value: "10" },
  { label: "15", value: "15" },
  { label: "20", value: "20" },
  { label: "25", value: "25" },
  { label: "30", value: "30" },
  { label: "35", value: "35" },
  { label: "40", value: "40" }
];
const DEFAULT_BATTLE_DESCRIPTION = "Spieler können sich unten anmelden, auf Reserve setzen, ihren Status ändern oder sich abmelden.";
const DEFAULT_CLASS_LIMIT_WEIGHTS = {
  fast: 1,
  combat: 2,
  heavy: 4,
  siege: 1,
  transport: 1
};

function formatLighthouseLabel(lighthouse) {
  const directionMap = {
    north: "Nord",
    south: "Süd",
    east: "Ost",
    west: "West"
  };

  return lighthouse
    .split("-")
    .map((part) => directionMap[part] || part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function getSelectableBattleHarbors() {
  return getHarbors().filter((harbor) => harbor.port_battle_possible);
}

function getHarborChoices(page = 0, harbors = getHarbors()) {
  const start = page * HARBOR_PAGE_SIZE;
  return harbors.slice(start, start + HARBOR_PAGE_SIZE).map((harbor) => ({
    label: harbor.name,
    value: harbor.harbor
  }));
}

function getHarborPageCount(harbors = getHarbors()) {
  return Math.max(1, Math.ceil(harbors.length / HARBOR_PAGE_SIZE));
}

function findHarborPage(harborSlug, harbors = getHarbors()) {
  const index = harbors.findIndex((harbor) => harbor.harbor === harborSlug);

  if (index === -1) {
    return 0;
  }

  return Math.floor(index / HARBOR_PAGE_SIZE);
}

function formatHarborName(harborValue) {
  const harbor = getHarborBySlug(harborValue);
  return harbor ? harbor.name : harborValue || "Noch nicht gesetzt";
}

function formatMeetingLocation(harborValue, lighthouseValue) {
  if (!harborValue) {
    return "Noch nicht gesetzt";
  }

  const harborName = formatHarborName(harborValue);

  if (!lighthouseValue) {
    return harborName;
  }

  return `${harborName} - Leuchtturm ${formatLighthouseLabel(lighthouseValue)}`;
}

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
    const shortYear = String(year).slice(-2);
    const month = padNumber(date.getMonth() + 1);
    const day = padNumber(date.getDate());

    choices.push({
      label: `${day}.${month}.${shortYear}`,
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

function splitTimeValue(value) {
  if (!value || !value.includes(":")) {
    return { hour: "", minute: "" };
  }

  const [hour, minute] = value.split(":");
  return {
    hour: hour || "",
    minute: minute || ""
  };
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
  return `${day}.${month}.${String(year).slice(-2)}`;
}

function formatDateTimeWithRelative(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return "Noch nicht gesetzt";
  }

  const targetDateTime = new Date(`${dateValue}T${timeValue}:00`);
  const unixTimestamp = Math.floor(targetDateTime.getTime() / 1000);

  if (Number.isNaN(unixTimestamp)) {
    return `${formatDateValue(dateValue)} ${timeValue}`;
  }

  return `${formatDateValue(dateValue)} ${timeValue} (<t:${unixTimestamp}:R>)`;
}

function getDefaultClassLimitWeights(shipClasses = []) {
  return Object.fromEntries(
    shipClasses.map((shipClass) => [shipClass, DEFAULT_CLASS_LIMIT_WEIGHTS[shipClass] || 1])
  );
}

function getGuildDefaultClassLimitWeights(guildId, shipClasses = Object.keys(DEFAULT_CLASS_LIMIT_WEIGHTS)) {
  const guildDefaults = getGuildClassLimitDefaults(guildId);
  return normalizeClassLimitWeights(shipClasses, { ...DEFAULT_CLASS_LIMIT_WEIGHTS, ...guildDefaults });
}

function normalizeClassLimitWeights(shipClasses = [], classLimitWeights = {}) {
  return Object.fromEntries(
    shipClasses.map((shipClass) => {
      const weight = Number(classLimitWeights[shipClass]);
      return [shipClass, Number.isInteger(weight) && weight > 0 ? weight : (DEFAULT_CLASS_LIMIT_WEIGHTS[shipClass] || 1)];
    })
  );
}

function buildClassLimitCounts(playerCount, shipClasses = [], classLimitWeights = {}) {
  if (!playerCount || shipClasses.length === 0) {
    return {};
  }

  const normalizedWeights = normalizeClassLimitWeights(shipClasses, classLimitWeights);
  const totalWeight = shipClasses.reduce((sum, shipClass) => sum + normalizedWeights[shipClass], 0);

  if (totalWeight <= 0) {
    return Object.fromEntries(shipClasses.map((shipClass) => [shipClass, 0]));
  }

  const rawCounts = shipClasses.map((shipClass) => {
    const rawCount = (playerCount * normalizedWeights[shipClass]) / totalWeight;
    return {
      shipClass,
      base: Math.floor(rawCount),
      fraction: rawCount - Math.floor(rawCount)
    };
  });

  let remaining = playerCount - rawCounts.reduce((sum, entry) => sum + entry.base, 0);
  rawCounts.sort((left, right) => {
    if (right.fraction !== left.fraction) {
      return right.fraction - left.fraction;
    }

    return shipClasses.indexOf(left.shipClass) - shipClasses.indexOf(right.shipClass);
  });

  for (let index = 0; index < rawCounts.length && remaining > 0; index += 1) {
    rawCounts[index].base += 1;
    remaining -= 1;
  }

  return Object.fromEntries(rawCounts.map((entry) => [entry.shipClass, entry.base]));
}

function getClassLimitModeLabel(isEnforced) {
  return isEnforced ? "Erzwungen" : "Nur Richtwert";
}

function formatClassLimitSummary(shipClasses = [], playerCount = 0, classLimitWeights = {}) {
  if (shipClasses.length === 0) {
    return "Noch nicht gesetzt";
  }

  const normalizedWeights = normalizeClassLimitWeights(shipClasses, classLimitWeights);
  const classLimitCounts = buildClassLimitCounts(playerCount, shipClasses, normalizedWeights);

  return shipClasses
    .map((shipClass) => `${getShipClassLabel(shipClass)}: ${classLimitCounts[shipClass] || 0} (${normalizedWeights[shipClass]} Teile)`)
    .join("\n");
}

function formatClassLimitCountsSummary(shipClasses = [], playerCount = 0, classLimitWeights = {}) {
  if (shipClasses.length === 0) {
    return "-";
  }

  const classLimitCounts = buildClassLimitCounts(playerCount, shipClasses, classLimitWeights);

  return shipClasses
    .map((shipClass) => `${getShipClassLabel(shipClass)}: ${classLimitCounts[shipClass] || 0}`)
    .join("\n");
}

function getSignupCount(battle) {
  return battle.categories.reduce((total, category) => {
    return (
      total +
      (battle.signups[category] || []).filter((member) => (member.status || "signup") === "signup").length
    );
  }, 0);
}

function getReserveCount(battle) {
  return battle.categories.reduce((total, category) => {
    return total + (battle.signups[category] || []).filter((member) => member.status === "reserve").length;
  }, 0);
}

function getUnregistrationEntries(battle) {
  return Array.isArray(battle.unregistrations) ? battle.unregistrations : [];
}

function getUnregistrationCount(battle) {
  return getUnregistrationEntries(battle).length;
}

function getClassSignupCount(battle, shipClass, ignoredUserId = "") {
  return battle.categories.reduce((total, category) => {
    const rule = findCategoryRule(battle, category);

    if (!rule || rule.shipClass !== shipClass) {
      return total;
    }

    return (
      total +
      (battle.signups[category] || []).filter(
        (member) => (member.status || "signup") === "signup" && member.userId !== ignoredUserId
      ).length
    );
  }, 0);
}

function getBattleClassLimitCounts(battle) {
  return buildClassLimitCounts(
    battle.playerCount,
    battle.shipClasses || [],
    battle.classLimitWeights || getDefaultClassLimitWeights(battle.shipClasses || [])
  );
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

function findCategoryRule(battle, category) {
  for (const shipClass of battle.shipClasses) {
    for (const level of battle.shipLevels) {
      if (`${getShipClassLabel(shipClass)} - Stufe ${level}` === category) {
        return { shipClass, level };
      }
    }
  }

  return null;
}

function getShipsForCategory(battle, category) {
  const rule = findCategoryRule(battle, category);

  if (!rule) {
    return [];
  }

  return getAllShips()
    .filter((ship) => ship.shipClass === rule.shipClass && ship.level === rule.level)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function findUserSignup(battle, userId) {
  for (const category of battle.categories) {
    const member = (battle.signups[category] || []).find((entry) => entry.userId === userId);

    if (member) {
      return {
        category,
        member
      };
    }
  }

  return null;
}

function getStatusLabel(status) {
  return status === "reserve" ? "Reserve" : "Anmeldung";
}

function buildCategorySelectComponents(battle, targetStatus) {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${CATEGORY_SELECT_ID}:${battle.id}:${targetStatus}`)
        .setPlaceholder(`Kategorie für ${getStatusLabel(targetStatus)} wählen`)
        .addOptions(
          battle.categories.map((category) => ({
            label: category,
            value: category
          }))
        )
    )
  ];
}

function buildShipSelectComponents(battle, categoryIndex, targetStatus) {
  const category = battle.categories[categoryIndex];
  const ships = getShipsForCategory(battle, category);

  if (ships.length === 0) {
    return [];
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${SHIP_SELECT_ID}:${battle.id}:${targetStatus}:${categoryIndex}`)
        .setPlaceholder("Passendes Schiff wählen")
        .addOptions(
          ships.slice(0, 25).map((ship) => ({
            label: ship.name,
            description: `${getShipClassLabel(ship.shipClass)}, Stufe ${ship.level}`,
            value: ship.id
          }))
        )
    )
  ];
}

function buildBattleEmbed(battle) {
  const classLines = battle.shipClasses.map((shipClass) => {
    const classMembers = battle.categories.flatMap((category) => {
      const rule = findCategoryRule(battle, category);

      if (!rule || rule.shipClass !== shipClass) {
        return [];
      }

      return (battle.signups[category] || []).map((member) => ({
        ...member,
        shipLevel: rule.level
      }));
    });

    const signedUpMembers = classMembers.filter((member) => (member.status || "signup") === "signup");
    const reserveMembers = classMembers.filter((member) => member.status === "reserve");

    if (signedUpMembers.length === 0 && reserveMembers.length === 0) {
      return `**${getShipClassLabel(shipClass)}**\n- keine Anmeldung`;
    }

    const formatMember = (member) => {
      const shipText = member.shipName ? ` - ${member.shipName} (St. ${member.shipLevel})` : "";
      const memberText = member.userId ? `<@${member.userId}>` : member.displayName;
      return `- ${memberText}${shipText}`;
    };

    const sortMembers = (left, right) => {
      if ((left.shipLevel || 0) !== (right.shipLevel || 0)) {
        return (left.shipLevel || 0) - (right.shipLevel || 0);
      }

      return (left.shipName || "").localeCompare(right.shipName || "");
    };

    const sections = [];

    if (signedUpMembers.length > 0) {
      sections.push(`Anmeldung:\n${signedUpMembers.sort(sortMembers).map(formatMember).join("\n")}`);
    }

    if (reserveMembers.length > 0) {
      sections.push(`Reserve:\n${reserveMembers.sort(sortMembers).map(formatMember).join("\n")}`);
    }

    return `**${getShipClassLabel(shipClass)}**\n${sections.join("\n")}`;
  });

  return new EmbedBuilder()
    .setTitle(`Hafenschlacht: ${battle.title}`)
    .setDescription(battle.description || DEFAULT_BATTLE_DESCRIPTION)
    .addFields(
      { name: "-----------------", value: "", inline: false },
      { name: "Schlacht", value: `${formatDateTimeWithRelative(battle.battleDate, battle.battleTime)}\n${formatHarborName(battle.battleLocation)}`, inline: true },
      { name: "Treffpunkt", value: `${formatDateTimeWithRelative(battle.meetingDate, battle.meetingTime)}\n${formatMeetingLocation(battle.meetingLocation, battle.meetingLighthouse)}`, inline: true },
      { name: "Flotte", value: `Spieler: ${getSignupCount(battle)}/${battle.playerCount}\nReserve: ${getReserveCount(battle)}`, inline: true },
      { name: "-----------------", value: "", inline: false },
      { name: "Ausrichter", value: battle.hostingGuild, inline: true },
      { name: "Unterstützende", value: battle.supportGuilds || "-", inline: true },
      { name: "Gegner", value: battle.enemyGuild, inline: true },
      { name: "-----------------", value: "", inline: false },
      {
        name: "Vorgaben",
        value: `Klassen: ${battle.shipClassLabels.join(", ")}\nStufen: ${battle.shipLevels.map((level) => `Stufe ${level}`).join(", ")}\nKlassenlimits:\n${formatClassLimitCountsSummary(battle.shipClasses, battle.playerCount, battle.classLimitWeights)}`,
        inline: false
      },
      { name: "-----------------", value: "", inline: false },
      { name: "Schiffskategorien", value: classLines.join("\n\n"), inline: false },
      { name: "-----------------", value: "", inline: false },
      { name: "Abmeldungen", value: String(getUnregistrationCount(battle)), inline: false },
      { name: "-----------------", value: "", inline: false }
    )
    .setFooter({ text: "Port Battle Planner made by TheWolf | Marco" });
}

function buildBattleComponents(battle) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${SIGNUP_BUTTON_ID}:${battle.id}`)
        .setLabel("Anmelden")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${RESERVE_BUTTON_ID}:${battle.id}`)
        .setLabel("Reserve")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${CHANGE_BUTTON_ID}:${battle.id}`)
        .setLabel("Ändern")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${UNREGISTER_BUTTON_ID}:${battle.id}`)
        .setLabel("Abmelden")
        .setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${EDIT_BATTLE_BUTTON_ID}:${battle.id}`)
        .setLabel("Schlacht bearbeiten")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${VIEW_UNREGISTRATIONS_BUTTON_ID}:${battle.id}`)
        .setLabel("Abmeldungen ansehen")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildCreateBattlePanelEmbed() {
  return new EmbedBuilder()
    .setTitle("Hafenschlacht-Verwaltung")
    .setDescription("Erstelle hier per Klick eine neue Hafenschlacht.")
    .setFooter({ text: "Port Battle Planner made by TheWolf | Marco" });
}

function buildCreateBattlePanelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(OPEN_CREATE_BATTLE_BUTTON_ID)
        .setLabel("Neue Hafenschlacht erstellen")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

async function ensureCreateBattlePanel(client, channelId) {
  if (!channelId) {
    return;
  }

  const channel = await client.channels.fetch(channelId);

  if (!channel || !channel.isTextBased()) {
    return;
  }

  const recentMessages = await channel.messages.fetch({ limit: 20 });
  const existingPanelMessage = recentMessages.find((message) => {
    if (message.author?.id !== client.user?.id) {
      return false;
    }

    return message.components.some((row) =>
      row.components.some((component) => component.customId === OPEN_CREATE_BATTLE_BUTTON_ID)
    );
  });

  const payload = {
    embeds: [buildCreateBattlePanelEmbed()],
    components: buildCreateBattlePanelComponents()
  };

  if (existingPanelMessage) {
    await existingPanelMessage.edit(payload);
    return;
  }

  await channel.send(payload);
}

function getAssignedBattleChannelIdForGuild(guildId) {
  return getBattleChannelId(guildId);
}

function isAdminInteraction(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}

async function replyAdminOnly(interaction) {
  await interaction.reply({
    content: "Nur Administratoren können diesen Befehl ausführen.",
    flags: MessageFlags.Ephemeral
  });
}

async function replyChannelNotConfigured(interaction) {
  await interaction.reply({
    content: "Es wurde noch kein Hafenschlacht-Kanal festgelegt. Bitte nutze zuerst `/schlacht-planer-kanal-zuweisen` und weise einen Kanal zu.",
    flags: MessageFlags.Ephemeral
  });
}

async function replyWrongChannel(interaction, channelId) {
  await interaction.reply({
    content: `Dieser Bot kann nur im zugewiesenen Kanal <#${channelId}> verwendet werden.`,
    flags: MessageFlags.Ephemeral
  });
}

async function replyBattleThreadOnly(interaction, battle) {
  const threadHint = battle?.threadId
    ? `Bitte nutze dafür den zugehörigen Schlacht-Thread <#${battle.threadId}>.`
    : "Bitte nutze dafür den zugehörigen Schlacht-Thread.";

  await interaction.reply({
    content: threadHint,
    flags: MessageFlags.Ephemeral
  });
}

function truncateText(value, maxLength) {
  if (!value) {
    return "";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function buildBattleThreadName(battle) {
  const harborName = formatHarborName(battle.battleLocation);
  return truncateText(`Port Battle - ${harborName} - ${battle.title}`, 100);
}

function buildBattleThreadIntro(battle) {
  return {
    content: `Dieser Thread gehört zur **${battle.title}** am **${formatDateTimeWithRelative(battle.battleDate, battle.battleTime)}**.\n\nNutze die Buttons unten für deine Teilnahme oder Änderungen.`,
    components: buildBattleComponents(battle)
  };
}

async function ensureBattleThread(client, battle, message) {
  if (battle.threadId) {
    return battle;
  }

  try {
    const thread = await message.startThread({
      name: buildBattleThreadName(battle),
      autoArchiveDuration: 10080
    });
    const threadMessage = await thread.send(buildBattleThreadIntro(battle));
    battle.threadId = thread.id;
    battle.threadMessageId = threadMessage.id;
    updateBattle(battle);
  } catch (error) {
    console.warn(`Thread für Schlacht ${battle.id} konnte nicht erstellt werden: ${error.message}`);
  }

  return battle;
}

function isBattleInteractionAllowed(interaction, assignedBattleChannelId, battle) {
  if (!assignedBattleChannelId || !battle?.threadId) {
    return false;
  }

  return interaction.channelId === battle.threadId;
}

function isDraftInteractionAllowed(interaction, assignedBattleChannelId, draft) {
  if (!assignedBattleChannelId) {
    return false;
  }

  return interaction.channelId === assignedBattleChannelId || interaction.channelId === draft?.contextChannelId;
}

function buildBattleModal(customId, title, defaults = {}) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Name")
          .setStyle(TextInputStyle.Short)
          .setValue(defaults.title || "")
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("battle_description")
          .setLabel("Beschreibung")
          .setStyle(TextInputStyle.Paragraph)
          .setValue(defaults.description || "")
          .setRequired(false)
          .setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("hosting_guild")
          .setLabel("Ausrichtende Gilde")
          .setStyle(TextInputStyle.Short)
          .setValue(defaults.hostingGuild || "")
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("support_guilds")
          .setLabel("Unterstützende Gilden")
          .setStyle(TextInputStyle.Paragraph)
          .setValue(defaults.supportGuilds || "")
          .setRequired(false)
          .setMaxLength(250)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("enemy_guild")
          .setLabel("Gegnerische Gilde")
          .setStyle(TextInputStyle.Short)
          .setValue(defaults.enemyGuild || "")
          .setRequired(true)
          .setMaxLength(100)
      )
    );
}

function buildCreateBattleModal() {
  return buildBattleModal(CREATE_BATTLE_MODAL_ID, "1. Allgemeine Angaben");
}

function buildEditBattleModal(battle) {
  return buildBattleModal(`${EDIT_BATTLE_MODAL_ID}:${battle.id}`, "Allgemeine Angaben bearbeiten", battle);
}

function buildClassLimitsModal(draft) {
  const normalizedWeights = normalizeClassLimitWeights(draft.shipClasses, draft.classLimitWeights);

  return new ModalBuilder()
    .setCustomId(`${CLASS_LIMITS_MODAL_ID}:${draft.id}`)
    .setTitle("Klassenverhältnis festlegen")
    .addComponents(
      ...draft.shipClasses.map((shipClass) =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(`class_limit_${shipClass}`)
            .setLabel(`${getShipClassLabel(shipClass)} Verhältnis`)
            .setStyle(TextInputStyle.Short)
            .setValue(String(normalizedWeights[shipClass] || 1))
            .setRequired(true)
            .setMaxLength(2)
        )
      )
    );
}

function buildClassLimitDefaultsModal(guildId) {
  const defaults = getGuildDefaultClassLimitWeights(guildId);
  const shipClasses = Object.keys(DEFAULT_CLASS_LIMIT_WEIGHTS);

  return new ModalBuilder()
    .setCustomId(`${CLASS_LIMIT_DEFAULTS_MODAL_ID}:${guildId}`)
    .setTitle("Standard-Klassenverhältnis")
    .addComponents(
      ...shipClasses.map((shipClass) =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(`class_limit_default_${shipClass}`)
            .setLabel(`${getShipClassLabel(shipClass)} Standard`)
            .setStyle(TextInputStyle.Short)
            .setValue(String(defaults[shipClass] || 1))
            .setRequired(true)
            .setMaxLength(2)
        )
      )
    );
}

function createDraftFromBattle(base) {
  const battleTimeParts = splitTimeValue(base.battleTime);
  const meetingTimeParts = splitTimeValue(base.meetingTime);

  return {
    id: `${Date.now()}`,
    ownerId: base.ownerId,
    mode: base.mode || "create",
    battleId: base.battleId || "",
    stage: DRAFT_STAGE_BATTLE,
    title: base.title || "",
    hostingGuild: base.hostingGuild || "",
    supportGuilds: base.supportGuilds || "",
    enemyGuild: base.enemyGuild || "",
    description: base.description || "",
    battleLocation: base.battleLocation || "",
    battleHarborPage: findHarborPage(base.battleLocation, getSelectableBattleHarbors()),
    battleDate: base.battleDate || "",
    battleHour: battleTimeParts.hour,
    battleMinute: battleTimeParts.minute,
    meetingLocation: base.meetingLocation || "",
    meetingHarborPage: findHarborPage(base.meetingLocation),
    meetingLighthouse: base.meetingLighthouse || "",
    meetingDate: base.meetingDate || base.battleDate || "",
    meetingTime: base.meetingTime || "",
    contextChannelId: base.contextChannelId || "",
    playerCount: base.playerCount || 0,
    shipClasses: [...(base.shipClasses || [])],
    shipLevels: [...(base.shipLevels || [])],
    classLimitWeights: normalizeClassLimitWeights(base.shipClasses || [], base.classLimitWeights || {}),
    classLimitsEnforced: base.classLimitsEnforced !== false
  };
}

function mergeSignupsByCategory(previousSignups, previousCategories, nextCategories) {
  const entriesByUser = new Map();

  for (const category of previousCategories) {
    for (const member of previousSignups[category] || []) {
      if (!entriesByUser.has(member.userId)) {
        entriesByUser.set(member.userId, { ...member, previousCategory: category });
      }
    }
  }

  return Object.fromEntries(
    nextCategories.map((category) => {
      const keptMembers = [];

      for (const member of entriesByUser.values()) {
        if (member.previousCategory === category) {
          keptMembers.push({
            userId: member.userId,
            userTag: member.userTag,
            displayName: member.displayName,
            shipId: member.shipId || "",
            shipName: member.shipName || "",
            status: member.status || "signup"
          });
        }
      }

      return [category, keptMembers];
    })
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
  const classLimitText = formatClassLimitSummary(draft.shipClasses, draft.playerCount, draft.classLimitWeights);

  const isEditMode = draft.mode === "edit";
  let description = isEditMode
    ? "Passe jetzt den Ort der Schlacht an."
    : "Wähle jetzt den Ort der Schlacht.";

  if (draft.stage === DRAFT_STAGE_BATTLE_SCHEDULE) {
    description = isEditMode
      ? "Passe jetzt Datum und Uhrzeit der Schlacht an."
      : "Wähle jetzt Datum und Uhrzeit der Schlacht.";
  }

  if (draft.stage === DRAFT_STAGE_MEETING) {
    description = isEditMode
      ? "Passe jetzt Treffpunkt-Ort und Uhrzeit an."
      : "Wähle jetzt Treffpunkt-Ort und Uhrzeit.";
  } else if (draft.stage === DRAFT_STAGE_FLEET) {
    description = isEditMode
      ? "Passe jetzt Spieleranzahl, Schiffklassen und Schiffsstufen an."
      : "Wähle jetzt Spieleranzahl, Schiffklassen und Schiffsstufen.";
  } else if (draft.stage === DRAFT_STAGE_CLASS_LIMITS) {
    description = isEditMode
      ? "Passe jetzt das Klassenverhältnis innerhalb der Flotte an."
      : "Lege jetzt das Klassenverhältnis innerhalb der Flotte fest.";
  }

  return new EmbedBuilder()
    .setTitle(`${draft.mode === "edit" ? "Hafenschlacht bearbeiten" : "Neue Hafenschlacht"}: ${draft.title}`)
    .setDescription(description)
    .addFields(
      { name: "Beschreibung", value: draft.description || "-", inline: false },
      { name: "Ausrichtende Gilde", value: draft.hostingGuild, inline: false },
      { name: "Unterstützende Gilden", value: draft.supportGuilds || "-", inline: false },
      { name: "Gegnerische Gilde", value: draft.enemyGuild, inline: false },
      { name: "Schlacht", value: `${formatHarborName(draft.battleLocation)}\n${formatDateTimeWithRelative(draft.battleDate, battleTime)}`, inline: false },
      { name: "Treffpunkt", value: `${formatMeetingLocation(draft.meetingLocation, draft.meetingLighthouse)}\n${formatDateTimeWithRelative(draft.meetingDate, draft.meetingTime)}`, inline: false },
      { name: "Spieleranzahl", value: draft.playerCount ? String(draft.playerCount) : "Noch nicht gesetzt", inline: true },
      { name: "Schiffklassen", value: classText, inline: false },
      { name: "Schiffsstufen", value: levelText, inline: false },
      { name: "Klassenlimit-Modus", value: getClassLimitModeLabel(draft.classLimitsEnforced), inline: false },
      { name: "Klassenlimits", value: classLimitText, inline: false }
    );
}

function buildBattleStageComponents(draft) {
  const battleHarbors = getSelectableBattleHarbors();
  const harborChoices = getHarborChoices(draft.battleHarborPage || 0, battleHarbors);
  const harborPageCount = getHarborPageCount(battleHarbors);

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_BATTLE_LOCATION_ID}:${draft.id}`)
        .setPlaceholder(`Schlachtort wählen (${(draft.battleHarborPage || 0) + 1}/${harborPageCount})`)
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          harborChoices.map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.battleLocation === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${DRAFT_HARBOR_PAGE_PREV_ID}:${draft.id}`)
        .setLabel("Zurück")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((draft.battleHarborPage || 0) <= 0),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_HARBOR_PAGE_NEXT_ID}:${draft.id}`)
        .setLabel("Weitere Häfen")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((draft.battleHarborPage || 0) >= harborPageCount - 1),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_NEXT_ID}:${draft.id}`)
        .setLabel("Weiter")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_CANCEL_ID}:${draft.id}`)
        .setLabel("Abbrechen")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildBattleScheduleStageComponents(draft) {
  const battleDateChoices = createUpcomingDateChoices();
  const hourChoices = createHourChoices();
  const minuteChoices = createMinuteChoices();

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_BATTLE_DATE_ID}:${draft.id}`)
        .setPlaceholder("Datum wählen")
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
        .setPlaceholder("Stunde wählen")
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
        .setPlaceholder("Minute wählen")
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
        .setCustomId(`${DRAFT_BACK_ID}:${draft.id}`)
        .setLabel("Zurück")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_NEXT_ID}:${draft.id}`)
        .setLabel("Weiter")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_CANCEL_ID}:${draft.id}`)
        .setLabel("Abbrechen")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildMeetingStageComponents(draft) {
  const meetingTimeChoices = createMeetingTimeChoices(draft.battleHour, draft.battleMinute);
  const harborChoices = getHarborChoices(draft.meetingHarborPage || 0);
  const harborPageCount = getHarborPageCount();
  const selectedHarbor = getHarborBySlug(draft.meetingLocation);
  const lighthouseChoices = selectedHarbor
    ? [
        { label: "Hafen", value: "" },
        ...selectedHarbor.lighthouses.map((lighthouse) => ({
          label: formatLighthouseLabel(lighthouse),
          value: lighthouse
        }))
      ]
    : [{ label: "Bitte erst Hafen wählen", value: "pending" }];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_MEETING_LOCATION_ID}:${draft.id}`)
        .setPlaceholder(`Treffpunkt-Hafen wählen (${(draft.meetingHarborPage || 0) + 1}/${harborPageCount})`)
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          harborChoices.map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.meetingLocation === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${DRAFT_HARBOR_PAGE_PREV_ID}:${draft.id}`)
        .setLabel("Zurück")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((draft.meetingHarborPage || 0) <= 0),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_HARBOR_PAGE_NEXT_ID}:${draft.id}`)
        .setLabel("Weitere Häfen")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((draft.meetingHarborPage || 0) >= harborPageCount - 1)
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_MEETING_LIGHTHOUSE_ID}:${draft.id}`)
        .setPlaceholder("Treffpunkt-Leuchtturm wählen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          lighthouseChoices.map((choice) => ({
            label: choice.label,
            value: choice.value || "__none__",
            default:
              (choice.value === "" && !draft.meetingLighthouse) ||
              draft.meetingLighthouse === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${DRAFT_MEETING_TIME_SELECT_ID}:${draft.id}`)
        .setPlaceholder("Treffpunkt-Uhrzeit wählen")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          (meetingTimeChoices.length > 0
            ? meetingTimeChoices
            : [{ label: "Bitte erst Schlachtuhrzeit wählen", value: "pending" }]).map((choice) => ({
            label: choice.label,
            value: choice.value,
            default: draft.meetingTime === choice.value
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${DRAFT_BACK_ID}:${draft.id}`)
        .setLabel("Zurück")
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
        .setPlaceholder("Spieleranzahl wählen")
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
        .setPlaceholder("Schiffklassen wählen")
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
        .setPlaceholder("Schiffsstufen wählen")
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
        .setLabel("Zurück")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_NEXT_ID}:${draft.id}`)
        .setLabel("Weiter zu Klassenlimits")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_CANCEL_ID}:${draft.id}`)
        .setLabel("Abbrechen")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildClassLimitsStageComponents(draft) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${DRAFT_TOGGLE_CLASS_LIMIT_ENFORCEMENT_ID}:${draft.id}`)
        .setLabel(`Klassenlimit: ${getClassLimitModeLabel(draft.classLimitsEnforced)}`)
        .setStyle(draft.classLimitsEnforced ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${DRAFT_BACK_ID}:${draft.id}`)
        .setLabel("Zurück")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_EDIT_CLASS_LIMITS_ID}:${draft.id}`)
        .setLabel("Verhältnis anpassen")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${DRAFT_CONFIRM_ID}:${draft.id}`)
        .setLabel(draft.mode === "edit" ? "Änderungen speichern" : "Schlacht erstellen")
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

  if (draft.stage === DRAFT_STAGE_BATTLE_SCHEDULE) {
    return buildBattleScheduleStageComponents(draft);
  }

  if (draft.stage === DRAFT_STAGE_MEETING) {
    return buildMeetingStageComponents(draft);
  }

  if (draft.stage === DRAFT_STAGE_CLASS_LIMITS) {
    return buildClassLimitsStageComponents(draft);
  }

  return buildFleetStageComponents(draft);
}

function removeUserFromAllCategories(battle, userId) {
  for (const category of battle.categories) {
    battle.signups[category] = (battle.signups[category] || []).filter((member) => member.userId !== userId);
  }
}

function removeUserFromUnregistrations(battle, userId) {
  battle.unregistrations = getUnregistrationEntries(battle).filter((entry) => entry.userId !== userId);
}

function addUserToUnregistrations(battle, user) {
  removeUserFromUnregistrations(battle, user.id);
  battle.unregistrations = getUnregistrationEntries(battle);
  battle.unregistrations.push({
    userId: user.id,
    displayName: user.globalName || user.username,
    userTag: user.tag,
    createdAt: new Date().toISOString()
  });
}

function addUserToCategory(battle, category, user, ship, status = "signup") {
  removeUserFromAllCategories(battle, user.id);
  removeUserFromUnregistrations(battle, user.id);
  battle.signups[category] = battle.signups[category] || [];
  battle.signups[category].push({
    userId: user.id,
    userTag: user.tag,
    displayName: user.globalName || user.username,
    shipId: ship?.id || "",
    shipName: ship?.name || "",
    status
  });
}

function buildUnregistrationsOverview(battle) {
  const entries = getUnregistrationEntries(battle);

  if (entries.length === 0) {
    return "Es liegen aktuell keine Abmeldungen vor.";
  }

  return entries
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return rightTime - leftTime;
    })
    .map((entry) => `- ${entry.userId ? `<@${entry.userId}>` : (entry.displayName || entry.userTag || "Unbekannt")}`)
    .join("\n");
}

function getSortedUnregistrations(battle) {
  return getUnregistrationEntries(battle)
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
}

function getUnregistrationsPageCount(battle) {
  return Math.max(1, Math.ceil(getUnregistrationEntries(battle).length / UNREGISTRATIONS_PAGE_SIZE));
}

function buildUnregistrationsEmbed(battle, page = 0) {
  const entries = getSortedUnregistrations(battle);
  const pageCount = getUnregistrationsPageCount(battle);
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const start = safePage * UNREGISTRATIONS_PAGE_SIZE;
  const pageEntries = entries.slice(start, start + UNREGISTRATIONS_PAGE_SIZE);

  const description = pageEntries.length > 0
    ? pageEntries
      .map((entry, index) => {
        const position = start + index + 1;
        const memberText = entry.userId ? `<@${entry.userId}>` : (entry.displayName || entry.userTag || "Unbekannt");
        const timeText = entry.createdAt ? ` - ${formatDateValue(String(entry.createdAt).slice(0, 10))}` : "";
        return `${position}. ${memberText}${timeText}`;
      })
      .join("\n")
    : "Es liegen aktuell keine Abmeldungen vor.";

  return new EmbedBuilder()
    .setTitle(`Abmeldungen: ${battle.title}`)
    .setDescription(description)
    .addFields({
      name: "Übersicht",
      value: `Gesamt: ${entries.length}\nSeite: ${safePage + 1}/${pageCount}`,
      inline: false
    });
}

function buildUnregistrationsComponents(battle, page = 0) {
  const pageCount = getUnregistrationsPageCount(battle);
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${VIEW_UNREGISTRATIONS_PREV_BUTTON_ID}:${battle.id}:${safePage}`)
        .setLabel("Zurück")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId(`${VIEW_UNREGISTRATIONS_NEXT_BUTTON_ID}:${battle.id}:${safePage}`)
        .setLabel("Weiter")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= pageCount - 1),
      new ButtonBuilder()
        .setCustomId(`${VIEW_UNREGISTRATIONS_CLOSE_BUTTON_ID}:${battle.id}`)
        .setLabel("Schließen")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

async function refreshBattleMessage(client, interaction, battle) {
  let message = interaction.message;

  if (!message || message.id !== battle.messageId) {
    if (!battle.channelId || !battle.messageId) {
      return;
    }

    const channel = await client.channels.fetch(battle.channelId);

    if (!channel || !channel.isTextBased()) {
      return;
    }

    message = await channel.messages.fetch(battle.messageId);
  }

  await message.edit({
    embeds: [buildBattleEmbed(battle)],
    components: []
  });

  await ensureBattleThread(client, battle, message);

  if (battle.threadId && battle.threadMessageId) {
    try {
      const thread = await client.channels.fetch(battle.threadId);

      if (thread && thread.isTextBased()) {
        const threadMessage = await thread.messages.fetch(battle.threadMessageId);
        await threadMessage.edit(buildBattleThreadIntro(battle));
      }
    } catch (error) {
      console.warn(`Thread-Nachricht für Schlacht ${battle.id} konnte nicht aktualisiert werden: ${error.message}`);
    }
  }
}

function createCommands() {
  return [
    new SlashCommandBuilder()
      .setName("schlacht-planer-kanal-zuweisen")
      .setDescription("Weist den Hafenschlacht-Kanal zu")
      .addChannelOption((option) =>
        option
          .setName("kanal")
          .setDescription("Textkanal für Hafenschlachten")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("schlacht-anlegen")
      .setDescription("Legt eine neue Hafenschlacht an")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("schlacht-panel")
      .setDescription("Sendet ein Panel mit Button zum Erstellen von Hafenschlachten")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("schlacht-standard-klassenlimits")
      .setDescription("Legt server-spezifische Standardwerte für Klassenverhältnisse fest")
      .toJSON()
  ];
}

async function registerCommands(token, clientId, guildIds = []) {
  const rest = new REST({ version: "10" }).setToken(token);
  const commands = createCommands();

  if (guildIds.length > 0) {
    let successCount = 0;
    let missingAccessCount = 0;

    for (const guildId of guildIds) {
      try {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        successCount += 1;
        console.log(`Slash-Commands für Server ${guildId} registriert.`);
      } catch (error) {
        if (error?.code === 50001) {
          missingAccessCount += 1;
          console.warn(`Slash-Commands für Server ${guildId} übersprungen: Missing Access.`);
          continue;
        }

        throw error;
      }
    }

    if (successCount === 0) {
      console.warn(
        `Für keinen der konfigurierten Discord-Server konnten Slash-Commands registriert werden (${missingAccessCount}/${guildIds.length}x Missing Access).`
      );
      console.warn(
        "Der Bot startet trotzdem. Prüfe GUILD_IDS in .env und lade den Bot mit Scope applications.commands in den Ziel-Server ein."
      );
    }

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
      const guildId = interaction.guildId || "";
      const assignedBattleChannelId = getAssignedBattleChannelIdForGuild(guildId);

      if (interaction.isChatInputCommand() && interaction.commandName === "schlacht-planer-kanal-zuweisen") {
        if (!isAdminInteraction(interaction)) {
          await replyAdminOnly(interaction);
          return;
        }

        const channel = interaction.options.getChannel("kanal", true);

        if (channel.type !== ChannelType.GuildText) {
          await interaction.reply({
            content: "Bitte wähle einen normalen Textkanal aus.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        setBattleChannelId(guildId, channel.id);
        await ensureCreateBattlePanel(client, channel.id);

        await interaction.reply({
          content: `Der Kanal ${channel} wurde als Hafenschlacht-Kanal zugewiesen.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.isChatInputCommand() && interaction.commandName === "schlacht-anlegen") {
        if (!isAdminInteraction(interaction)) {
          await replyAdminOnly(interaction);
          return;
        }

        if (!assignedBattleChannelId) {
          await replyChannelNotConfigured(interaction);
          return;
        }

        if (interaction.channelId !== assignedBattleChannelId) {
          await replyWrongChannel(interaction, assignedBattleChannelId);
          return;
        }

        await interaction.showModal(buildCreateBattleModal());
        return;
      }

      if (interaction.isChatInputCommand() && interaction.commandName === "schlacht-panel") {
        if (!isAdminInteraction(interaction)) {
          await replyAdminOnly(interaction);
          return;
        }

        if (!assignedBattleChannelId) {
          await replyChannelNotConfigured(interaction);
          return;
        }

        if (!interaction.channel || !interaction.channel.isTextBased()) {
          await interaction.reply({
            content: "Dieses Panel kann hier nicht erstellt werden.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await ensureCreateBattlePanel(client, assignedBattleChannelId);

        await interaction.reply({
          content: `Das Schlacht-Panel wurde im zugewiesenen Kanal <#${assignedBattleChannelId}> erstellt oder aktualisiert.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.isChatInputCommand() && interaction.commandName === "schlacht-standard-klassenlimits") {
        if (!isAdminInteraction(interaction)) {
          await replyAdminOnly(interaction);
          return;
        }

        await interaction.showModal(buildClassLimitDefaultsModal(guildId));
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === CREATE_BATTLE_MODAL_ID) {
          if (!assignedBattleChannelId) {
            await replyChannelNotConfigured(interaction);
            return;
          }

          if (interaction.channelId !== assignedBattleChannelId) {
            await replyWrongChannel(interaction, assignedBattleChannelId);
            return;
          }

          if (!isAdminInteraction(interaction)) {
            await replyAdminOnly(interaction);
            return;
          }

          const draft = createDraftFromBattle({
            ownerId: interaction.user.id,
            mode: "create",
            contextChannelId: interaction.channelId,
            title: interaction.fields.getTextInputValue("title"),
            hostingGuild: interaction.fields.getTextInputValue("hosting_guild"),
            supportGuilds: interaction.fields.getTextInputValue("support_guilds"),
            enemyGuild: interaction.fields.getTextInputValue("enemy_guild"),
            description: interaction.fields.getTextInputValue("battle_description"),
            classLimitWeights: getGuildDefaultClassLimitWeights(guildId)
          });
          draft.guildId = guildId;

          draftStore.set(draft.id, draft);

          await interaction.reply({
            embeds: [buildDraftEmbed(draft)],
            components: buildDraftComponents(draft),
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (interaction.customId.startsWith(`${CLASS_LIMIT_DEFAULTS_MODAL_ID}:`)) {
          if (!assignedBattleChannelId) {
            await replyChannelNotConfigured(interaction);
            return;
          }

          if (interaction.channelId !== assignedBattleChannelId) {
            await replyWrongChannel(interaction, assignedBattleChannelId);
            return;
          }

          if (!isAdminInteraction(interaction)) {
            await replyAdminOnly(interaction);
            return;
          }

          const [, targetGuildId] = interaction.customId.split(":");
          const shipClasses = Object.keys(DEFAULT_CLASS_LIMIT_WEIGHTS);
          const nextDefaults = {};

          for (const shipClass of shipClasses) {
            const parsedValue = Number.parseInt(
              interaction.fields.getTextInputValue(`class_limit_default_${shipClass}`),
              10
            );

            if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
              await interaction.reply({
                content: `Bitte gib für ${getShipClassLabel(shipClass)} eine ganze Zahl größer 0 an.`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            nextDefaults[shipClass] = parsedValue;
          }

          setGuildClassLimitDefaults(targetGuildId, nextDefaults);
          await interaction.reply({
            content: `Die server-spezifischen Standardwerte wurden gespeichert.\n${formatClassLimitSummary(shipClasses, 8, nextDefaults)}`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (interaction.customId.startsWith(`${CLASS_LIMITS_MODAL_ID}:`)) {
          const [, draftId] = interaction.customId.split(":");
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

          if (!isDraftInteractionAllowed(interaction, assignedBattleChannelId, draft)) {
            await replyWrongChannel(interaction, assignedBattleChannelId);
            return;
          }

          const classLimitWeights = {};

          for (const shipClass of draft.shipClasses) {
            const parsedValue = Number.parseInt(interaction.fields.getTextInputValue(`class_limit_${shipClass}`), 10);

            if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
              await interaction.reply({
                content: `Bitte gib für ${getShipClassLabel(shipClass)} eine ganze Zahl größer 0 an.`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            classLimitWeights[shipClass] = parsedValue;
          }

          draft.classLimitWeights = classLimitWeights;
          draft.stage = DRAFT_STAGE_CLASS_LIMITS;
          draftStore.set(draft.id, draft);

          if (interaction.message && typeof interaction.update === "function") {
            await interaction.update({
              embeds: [buildDraftEmbed(draft)],
              components: buildDraftComponents(draft)
            });
          } else {
            await interaction.reply({
              embeds: [buildDraftEmbed(draft)],
              components: buildDraftComponents(draft),
              flags: MessageFlags.Ephemeral
            });
          }
          return;
        }

        if (interaction.customId.startsWith(`${EDIT_BATTLE_MODAL_ID}:`)) {
          const [, battleId] = interaction.customId.split(":");
          const battle = getBattle(battleId);

          if (!battle) {
            await interaction.reply({
              content: "Diese Schlacht wurde nicht gefunden.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (!isBattleInteractionAllowed(interaction, assignedBattleChannelId, battle)) {
            await replyBattleThreadOnly(interaction, battle);
            return;
          }

          const canEdit = battle.createdByUserId
            ? battle.createdByUserId === interaction.user.id || interaction.memberPermissions?.has("ManageGuild")
            : interaction.memberPermissions?.has("ManageGuild");

          if (!canEdit) {
            await interaction.reply({
              content: "Nur der Ersteller oder ein Server-Moderator kann diese Schlacht bearbeiten.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          const draft = createDraftFromBattle({
            ...battle,
            ownerId: interaction.user.id,
            mode: "edit",
            battleId: battle.id,
            contextChannelId: interaction.channelId
          });

          draft.title = interaction.fields.getTextInputValue("title");
          draft.hostingGuild = interaction.fields.getTextInputValue("hosting_guild");
          draft.supportGuilds = interaction.fields.getTextInputValue("support_guilds");
          draft.enemyGuild = interaction.fields.getTextInputValue("enemy_guild");
          draft.description = interaction.fields.getTextInputValue("battle_description");

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
        if (interaction.customId === OPEN_CREATE_BATTLE_BUTTON_ID) {
          if (!isAdminInteraction(interaction)) {
            await replyAdminOnly(interaction);
            return;
          }

          if (!assignedBattleChannelId) {
            await replyChannelNotConfigured(interaction);
            return;
          }

          if (interaction.channelId !== assignedBattleChannelId) {
            await replyWrongChannel(interaction, assignedBattleChannelId);
            return;
          }

          await interaction.showModal(buildCreateBattleModal());
          return;
        }

        const [action, objectId] = interaction.customId.split(":");
        const draft = draftStore.get(objectId);

        if (action === DRAFT_EDIT_CLASS_LIMITS_ID) {
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

          if (!isDraftInteractionAllowed(interaction, assignedBattleChannelId, draft)) {
            await replyWrongChannel(interaction, assignedBattleChannelId);
            return;
          }

          if (draft.shipClasses.length === 0) {
            await interaction.reply({
              content: "Bitte wähle zuerst Schiffklassen aus.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          await interaction.showModal(buildClassLimitsModal(draft));
          return;
        }

        if (action === DRAFT_TOGGLE_CLASS_LIMIT_ENFORCEMENT_ID) {
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

          if (!isDraftInteractionAllowed(interaction, assignedBattleChannelId, draft)) {
            await replyWrongChannel(interaction, assignedBattleChannelId);
            return;
          }

          draft.classLimitsEnforced = !draft.classLimitsEnforced;
          draftStore.set(draft.id, draft);
          await interaction.update({
            embeds: [buildDraftEmbed(draft)],
            components: buildDraftComponents(draft)
          });
          return;
        }

        if (
          action === SIGNUP_BUTTON_ID ||
          action === RESERVE_BUTTON_ID ||
          action === CHANGE_BUTTON_ID ||
          action === UNREGISTER_BUTTON_ID ||
          action === EDIT_BATTLE_BUTTON_ID ||
          action === VIEW_UNREGISTRATIONS_BUTTON_ID ||
          action === VIEW_UNREGISTRATIONS_PREV_BUTTON_ID ||
          action === VIEW_UNREGISTRATIONS_NEXT_BUTTON_ID ||
          action === VIEW_UNREGISTRATIONS_CLOSE_BUTTON_ID ||
          action === CHANGE_TO_SIGNUP_BUTTON_ID ||
          action === CHANGE_TO_RESERVE_BUTTON_ID
        ) {
          const battle = getBattle(objectId);

          if (!battle) {
            await interaction.reply({
              content: "Diese Schlacht wurde nicht gefunden.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (!isBattleInteractionAllowed(interaction, assignedBattleChannelId, battle)) {
            await replyBattleThreadOnly(interaction, battle);
            return;
          }

          if (action === EDIT_BATTLE_BUTTON_ID) {
            const canEdit = battle.createdByUserId
              ? battle.createdByUserId === interaction.user.id || interaction.memberPermissions?.has("ManageGuild")
              : interaction.memberPermissions?.has("ManageGuild");

            if (!canEdit) {
              await interaction.reply({
                content: "Nur der Ersteller oder ein Server-Moderator kann diese Schlacht bearbeiten.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            await interaction.showModal(buildEditBattleModal(battle));
            return;
          }

          if (action === VIEW_UNREGISTRATIONS_BUTTON_ID) {
            if (!isAdminInteraction(interaction)) {
              await replyAdminOnly(interaction);
              return;
            }

            await interaction.reply({
              embeds: [buildUnregistrationsEmbed(battle, 0)],
              components: buildUnregistrationsComponents(battle, 0),
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (action === VIEW_UNREGISTRATIONS_PREV_BUTTON_ID || action === VIEW_UNREGISTRATIONS_NEXT_BUTTON_ID) {
            if (!isAdminInteraction(interaction)) {
              await replyAdminOnly(interaction);
              return;
            }

            const currentPage = Number.parseInt(interaction.customId.split(":")[2] || "0", 10) || 0;
            const nextPage = action === VIEW_UNREGISTRATIONS_PREV_BUTTON_ID ? currentPage - 1 : currentPage + 1;

            await interaction.update({
              embeds: [buildUnregistrationsEmbed(battle, nextPage)],
              components: buildUnregistrationsComponents(battle, nextPage)
            });
            return;
          }

          if (action === VIEW_UNREGISTRATIONS_CLOSE_BUTTON_ID) {
            if (!isAdminInteraction(interaction)) {
              await replyAdminOnly(interaction);
              return;
            }

            await interaction.update({
              content: "Die Abmeldungsübersicht wurde geschlossen.",
              embeds: [],
              components: []
            });
            return;
          }

          const existingSignup = findUserSignup(battle, interaction.user.id);

          if (action === SIGNUP_BUTTON_ID || action === RESERVE_BUTTON_ID) {
            if (existingSignup) {
              await interaction.reply({
                content: "Du bist bereits angemeldet oder auf Reserve. Bitte nutze Ändern oder Abmelden.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            if (action === SIGNUP_BUTTON_ID && getSignupCount(battle) >= battle.playerCount) {
              await interaction.reply({
                content: "Diese Hafenschlacht ist bereits voll. Nutze Reserve, wenn du dich vormerken willst.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            const targetStatus = action === SIGNUP_BUTTON_ID ? "signup" : "reserve";
            await interaction.reply({
              content: `Wähle jetzt die Kategorie für deine ${getStatusLabel(targetStatus)}.`,
              components: buildCategorySelectComponents(battle, targetStatus),
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (action === CHANGE_BUTTON_ID) {
            if (!existingSignup) {
              await interaction.reply({
                content: "Du bist aktuell weder angemeldet noch auf Reserve.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            await interaction.reply({
              content: `Aktuell: **${existingSignup.category}** als **${getStatusLabel(existingSignup.member.status || "signup")}**. Wähle den neuen Status.`,
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId(`${CHANGE_TO_SIGNUP_BUTTON_ID}:${battle.id}`)
                    .setLabel("Zu Anmeldung")
                    .setStyle(ButtonStyle.Success),
                  new ButtonBuilder()
                    .setCustomId(`${CHANGE_TO_RESERVE_BUTTON_ID}:${battle.id}`)
                    .setLabel("Zu Reserve")
                    .setStyle(ButtonStyle.Secondary)
                )
              ],
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (action === CHANGE_TO_SIGNUP_BUTTON_ID || action === CHANGE_TO_RESERVE_BUTTON_ID) {
            if (!existingSignup) {
              await interaction.reply({
                content: "Du bist aktuell weder angemeldet noch auf Reserve.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            const targetStatus = action === CHANGE_TO_SIGNUP_BUTTON_ID ? "signup" : "reserve";

            if (
              targetStatus === "signup" &&
              (existingSignup.member.status || "signup") !== "signup" &&
              getSignupCount(battle) >= battle.playerCount
            ) {
              await interaction.reply({
                content: "Diese Hafenschlacht ist bereits voll. Ein Wechsel in Anmeldung ist aktuell nicht möglich.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            await interaction.reply({
              content: `Wähle jetzt die Kategorie für deine ${getStatusLabel(targetStatus)}.`,
              components: buildCategorySelectComponents(battle, targetStatus),
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (action === UNREGISTER_BUTTON_ID) {
            removeUserFromAllCategories(battle, interaction.user.id);
            addUserToUnregistrations(battle, interaction.user);
            updateBattle(battle);
            await refreshBattleMessage(client, interaction, battle);
            await interaction.reply({
              content: existingSignup
                ? "Du wurdest von der Hafenschlacht abgemeldet."
                : "Du wurdest als abgemeldet für diese Hafenschlacht eingetragen.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }
        }

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

        if (!isDraftInteractionAllowed(interaction, assignedBattleChannelId, draft)) {
          await replyWrongChannel(interaction, assignedBattleChannelId);
          return;
        }

        if (action === DRAFT_NEXT_ID) {
          if (draft.stage === DRAFT_STAGE_BATTLE) {
            if (!draft.battleLocation) {
              await interaction.reply({
                content: "Bitte wähle zuerst den Ort der Schlacht aus.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            draft.stage = DRAFT_STAGE_BATTLE_SCHEDULE;
            draftStore.set(draft.id, draft);
            await interaction.update({
              embeds: [buildDraftEmbed(draft)],
              components: buildDraftComponents(draft)
            });
            return;
          }

          if (draft.stage === DRAFT_STAGE_BATTLE_SCHEDULE) {
            if (!draft.battleDate || !draft.battleHour || !draft.battleMinute) {
              await interaction.reply({
                content: "Bitte wähle zuerst Datum und Uhrzeit der Schlacht aus.",
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
            if (!draft.meetingLocation || !draft.meetingTime) {
              await interaction.reply({
                content: "Bitte wähle zuerst Ort, Datum und Uhrzeit des Treffpunkts aus.",
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
            return;
          }

          if (draft.stage === DRAFT_STAGE_FLEET) {
            if (draft.playerCount <= 0 || draft.shipClasses.length === 0 || draft.shipLevels.length === 0) {
              await interaction.reply({
                content: "Bitte wähle zuerst Spieleranzahl, Schiffklassen und Schiffsstufen aus.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            const categories = buildSignupCategories(draft.shipClasses, draft.shipLevels);

            if (categories.length > 25) {
              await interaction.reply({
                content: `Es entstehen ${categories.length} Anmeldeoptionen. Discord erlaubt maximal 25. Bitte wähle weniger Klassen oder Stufen.`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            await interaction.showModal(buildClassLimitsModal(draft));
          }
          return;
        }

        if (action === DRAFT_BACK_ID) {
          if (draft.stage === DRAFT_STAGE_BATTLE_SCHEDULE) {
            draft.stage = DRAFT_STAGE_BATTLE;
          } else if (draft.stage === DRAFT_STAGE_MEETING) {
            draft.stage = DRAFT_STAGE_BATTLE_SCHEDULE;
          } else if (draft.stage === DRAFT_STAGE_FLEET) {
            draft.stage = DRAFT_STAGE_MEETING;
          } else if (draft.stage === DRAFT_STAGE_CLASS_LIMITS) {
            draft.stage = DRAFT_STAGE_FLEET;
          }

          draftStore.set(draft.id, draft);
          await interaction.update({
            embeds: [buildDraftEmbed(draft)],
            components: buildDraftComponents(draft)
          });
          return;
        }

        if (action === DRAFT_CONFIRM_ID) {
          const categories = buildSignupCategories(draft.shipClasses, draft.shipLevels);

          if (categories.length > 25) {
            await interaction.reply({
              content: `Es entstehen ${categories.length} Anmeldeoptionen. Discord erlaubt maximal 25. Bitte wähle weniger Klassen oder Stufen.`,
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          const battleData = {
            title: draft.title,
            guildId: draft.guildId || guildId,
            battleDate: draft.battleDate,
            battleTime: buildTimeFromParts(draft.battleHour, draft.battleMinute),
            battleLocation: draft.battleLocation,
            meetingDate: draft.meetingDate,
            meetingTime: draft.meetingTime,
            meetingLocation: draft.meetingLocation,
            meetingLighthouse: draft.meetingLighthouse,
            playerCount: draft.playerCount,
            hostingGuild: draft.hostingGuild,
            supportGuilds: draft.supportGuilds,
            enemyGuild: draft.enemyGuild,
            description: draft.description,
            shipClasses: [...draft.shipClasses],
            shipClassLabels: draft.shipClasses.map((shipClass) => getShipClassLabel(shipClass)),
            shipLevels: [...draft.shipLevels],
            classLimitWeights: normalizeClassLimitWeights(draft.shipClasses, draft.classLimitWeights),
            classLimitsEnforced: draft.classLimitsEnforced !== false,
            categories,
            createdByUserId: draft.ownerId
          };

          let battle;

          if (draft.mode === "edit" && draft.battleId) {
            const existingBattle = getBattle(draft.battleId);

            if (!existingBattle) {
              await interaction.reply({
                content: "Diese Schlacht wurde nicht gefunden.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            battle = {
              ...existingBattle,
              ...battleData,
              unregistrations: getUnregistrationEntries(existingBattle),
              signups: mergeSignupsByCategory(existingBattle.signups || {}, existingBattle.categories || [], categories)
            };

            updateBattle(battle);
          } else {
            battle = createBattle({
              id: `${Date.now()}`,
              ...battleData,
              unregistrations: [],
              signups: Object.fromEntries(categories.map((category) => [category, []])),
              createdAt: new Date().toISOString()
            });
          }

          draftStore.delete(objectId);

          await interaction.update({
            content: draft.mode === "edit" ? "Die Hafenschlacht wurde aktualisiert." : "Die Hafenschlacht wurde erstellt.",
            embeds: [],
            components: []
          });

          if (draft.mode === "edit") {
            await refreshBattleMessage(client, interaction, battle);
          } else if (interaction.channel && interaction.channel.isTextBased()) {
            const message = await interaction.channel.send({
              embeds: [buildBattleEmbed(battle)],
              components: []
            });
            battle.channelId = interaction.channel.id;
            battle.messageId = message.id;
            updateBattle(battle);
            await ensureBattleThread(client, battle, message);
          }
          return;
        }

        if (action === DRAFT_CANCEL_ID) {
          draftStore.delete(objectId);
          await interaction.update({
            content: "Die Erstellung der Hafenschlacht wurde abgebrochen.",
            embeds: [],
            components: []
          });
        }

        if (action === DRAFT_HARBOR_PAGE_PREV_ID || action === DRAFT_HARBOR_PAGE_NEXT_ID) {
          const pageDelta = action === DRAFT_HARBOR_PAGE_PREV_ID ? -1 : 1;

          if (draft.stage === DRAFT_STAGE_BATTLE) {
            draft.battleHarborPage = Math.min(
              Math.max((draft.battleHarborPage || 0) + pageDelta, 0),
              getHarborPageCount(getSelectableBattleHarbors()) - 1
            );
          } else if (draft.stage === DRAFT_STAGE_MEETING) {
            draft.meetingHarborPage = Math.min(
              Math.max((draft.meetingHarborPage || 0) + pageDelta, 0),
              getHarborPageCount() - 1
            );
          }

          draftStore.set(draft.id, draft);
          await interaction.update({
            embeds: [buildDraftEmbed(draft)],
            components: buildDraftComponents(draft)
          });
          return;
        }

        return;
      }

      if (interaction.isStringSelectMenu()) {
        if (!assignedBattleChannelId) {
          await replyChannelNotConfigured(interaction);
          return;
        }

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

          if (!isDraftInteractionAllowed(interaction, assignedBattleChannelId, draft)) {
            await replyWrongChannel(interaction, assignedBattleChannelId);
            return;
          }

          if (action === DRAFT_BATTLE_LOCATION_ID) {
            draft.battleLocation = interaction.values[0];
            draft.battleHarborPage = findHarborPage(draft.battleLocation, getSelectableBattleHarbors());
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
            draft.meetingHarborPage = findHarborPage(draft.meetingLocation);
            draft.meetingLighthouse = "";
          } else if (action === DRAFT_MEETING_LIGHTHOUSE_ID) {
            if (interaction.values[0] === "pending") {
              await interaction.reply({
                content: "Bitte wähle zuerst den Treffpunkt-Hafen aus.",
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            draft.meetingLighthouse = interaction.values[0] === "__none__" ? "" : interaction.values[0];
          } else if (action === DRAFT_MEETING_DATE_ID) {
            draft.meetingDate = interaction.values[0];
          } else if (action === DRAFT_MEETING_TIME_SELECT_ID) {
            if (interaction.values[0] === "pending") {
              await interaction.reply({
                content: "Bitte wähle zuerst die Schlachtuhrzeit aus.",
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

        if (!isBattleInteractionAllowed(interaction, assignedBattleChannelId, battle)) {
          await replyBattleThreadOnly(interaction, battle);
          return;
        }

        if (action === CATEGORY_SELECT_ID) {
          const [, battleId, targetStatus] = interaction.customId.split(":");
          const selectedBattle = getBattle(battleId);

          if (!selectedBattle) {
            await interaction.reply({
              content: "Diese Schlacht wurde nicht gefunden.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          const selectedCategory = interaction.values[0];
          const rule = findCategoryRule(selectedBattle, selectedCategory);

          if (!selectedBattle.categories.includes(selectedCategory)) {
            await interaction.reply({
              content: "Diese Schiffskategorie ist ungültig.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          const existingSignup = findUserSignup(selectedBattle, interaction.user.id);

          if (!existingSignup && targetStatus === "signup" && getSignupCount(selectedBattle) >= selectedBattle.playerCount) {
            await interaction.reply({
              content: "Diese Hafenschlacht ist bereits voll.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (targetStatus === "signup" && rule && selectedBattle.classLimitsEnforced !== false) {
            const ignoredUserId =
              existingSignup &&
              (existingSignup.member.status || "signup") === "signup" &&
              findCategoryRule(selectedBattle, existingSignup.category)?.shipClass === rule.shipClass
                ? interaction.user.id
                : "";
            const classLimitCounts = getBattleClassLimitCounts(selectedBattle);
            const classSignupCount = getClassSignupCount(selectedBattle, rule.shipClass, ignoredUserId);

            if (classSignupCount >= (classLimitCounts[rule.shipClass] || 0)) {
              await interaction.reply({
                content: `Für ${getShipClassLabel(rule.shipClass)} sind bereits alle Plätze belegt.`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }
          }

          const shipSelectComponents = buildShipSelectComponents(
            selectedBattle,
            selectedBattle.categories.indexOf(selectedCategory),
            targetStatus
          );

          if (shipSelectComponents.length === 0) {
            await interaction.reply({
              content: "Für diese Vorgabe wurden keine passenden Schiffe gefunden.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          await interaction.update({
            content: `Kategorie **${selectedCategory}** gewählt. Wähle jetzt dein Schiff für ${getStatusLabel(targetStatus)} aus.`,
            components: shipSelectComponents,
          });
          return;
        }

        if (action === SHIP_SELECT_ID) {
          const [, battleId, targetStatus, categoryIndexValue] = interaction.customId.split(":");
          const selectedBattle = getBattle(battleId);
          const categoryIndex = Number(categoryIndexValue);

          if (!selectedBattle) {
            await interaction.reply({
              content: "Diese Schlacht wurde nicht gefunden.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          const category = selectedBattle.categories[categoryIndex];
          const ship = getShipById(interaction.values[0]);
          const allowedShips = getShipsForCategory(selectedBattle, category);

          if (!category || !ship || !allowedShips.some((allowedShip) => allowedShip.id === ship.id)) {
            await interaction.reply({
              content: "Dieses Schiff passt nicht zu der gewählten Vorgabe.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          const existingSignup = findUserSignup(selectedBattle, interaction.user.id);
          const rule = findCategoryRule(selectedBattle, category);

          if (
            targetStatus === "signup" &&
            (!existingSignup || (existingSignup.member.status || "signup") !== "signup") &&
            getSignupCount(selectedBattle) >= selectedBattle.playerCount
          ) {
            await interaction.reply({
              content: "Diese Hafenschlacht ist bereits voll.",
              flags: MessageFlags.Ephemeral
            });
            return;
          }

          if (targetStatus === "signup" && rule && selectedBattle.classLimitsEnforced !== false) {
            const ignoredUserId =
              existingSignup &&
              (existingSignup.member.status || "signup") === "signup" &&
              findCategoryRule(selectedBattle, existingSignup.category)?.shipClass === rule.shipClass
                ? interaction.user.id
                : "";
            const classLimitCounts = getBattleClassLimitCounts(selectedBattle);
            const classSignupCount = getClassSignupCount(selectedBattle, rule.shipClass, ignoredUserId);

            if (classSignupCount >= (classLimitCounts[rule.shipClass] || 0)) {
              await interaction.reply({
                content: `Für ${getShipClassLabel(rule.shipClass)} sind bereits alle Plätze belegt.`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }
          }

          addUserToCategory(selectedBattle, category, interaction.user, ship, targetStatus);
          updateBattle(selectedBattle);
          await refreshBattleMessage(client, interaction, selectedBattle);
          await interaction.update({
            content: `Du bist jetzt in **${category}** mit **${ship.name}** als **${getStatusLabel(targetStatus)}** eingetragen.`,
            components: []
          });
          return;
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

  await registerCommands(config.token, config.clientId, config.guildIds || []);
  await client.login(config.token);
}

module.exports = {
  createBot
};
