import { Zone } from "../engine/dist/zones.js";
import {
  createGameFromSetups,
  getActivePlayer,
  getOpponent,
  startTurn,
} from "../engine/dist/api.js";

const turnIndicator = document.querySelector(".turn-indicator");
const startButton = document.getElementById("start-game-btn");
const resetButton = document.getElementById("reset-btn");
const attackAllButton = document.getElementById("attack-all-btn");
const homeScreen = document.getElementById("screen-home");
const battleScreen = document.getElementById("screen-battle");
const backButton = document.getElementById("back-to-menu");
const menuMessage = document.getElementById("menu-message");
const menuTiles = document.querySelectorAll("[data-battle-mode], [data-action]");

let gameState = null;
let lastMode = "solo";

function normalizeCard(baseCard, ownerId, zone = Zone.VEILED_DECK) {
  const power = baseCard.power ?? baseCard.attack ?? 0;
  const guard = baseCard.toughness ?? baseCard.health ?? baseCard.essence ?? 1;
  return {
    cardId: baseCard.id,
    name: baseCard.name,
    typeLine: (baseCard.type || "").toUpperCase(),
    subtypes: Array.isArray(baseCard.aspects) ? baseCard.aspects : [],
    domainTag: baseCard.domain || baseCard.domainTag || "",
    klCost: baseCard.cost ?? baseCard.startingKL ?? 0,
    power,
    guard,
    startingEssence: baseCard.essence ?? 0,
    baseKl: baseCard.startingKL ?? 0,
    abilities: [],
    isToken: Boolean(baseCard.isToken),
    ownerId,
    controllerId: ownerId,
    zone,
    damageMarked: 0,
    tapped: false,
    temporaryModifiers: [],
  };
}

function buildPlayerSetup(id, deityData, deckStartIndex = 0) {
  const deityCard = normalizeCard(deityData, id, Zone.DEITY_ZONE);
  const pool = (typeof CARD_DATABASE !== "undefined" && CARD_DATABASE.length > 0)
    ? CARD_DATABASE.slice(deckStartIndex, deckStartIndex + 12)
    : [];
  const veiledDeck = pool.map((card) => normalizeCard(card, id, Zone.VEILED_DECK));
  return {
    id,
    deity: deityCard,
    veiledDeck,
  };
}

function highlightGodOrbs(prefix, count) {
  const selector = prefix === "top" ? "[data-top-god]" : "[data-bottom-god]";
  document.querySelectorAll(selector).forEach((orb) => {
    const slot = Number(orb.dataset.topGod || orb.dataset.bottomGod);
    orb.classList.toggle("active", slot <= count);
  });
}

function updateMeters(prefix, player) {
  const essenceMeter = document.getElementById(`${prefix}-essence-meter`);
  const klMeter = document.getElementById(`${prefix}-kl-meter`);
  if (essenceMeter) {
    const pct = Math.max(0, Math.min(1, player.essence / (player.deity.startingEssence || 25)));
    essenceMeter.style.transform = `scaleX(${pct.toFixed(2)})`;
  }
  if (klMeter) {
    const pct = Math.max(0, Math.min(1, player.currentKl / 31));
    klMeter.style.transform = `scaleX(${pct.toFixed(2)})`;
  }
}

function updatePlayerPanel(prefix, player) {
  document.getElementById(`${prefix}-player-name`)?.textContent =
    prefix === "top" ? "Player Two (P2)" : "Player One (P1)";
  document.getElementById(`${prefix}-essence`)?.textContent = player.essence;
  document.getElementById(`${prefix}-kl`)?.textContent = player.currentKl;
  document.getElementById(`${prefix}-base-kl`)?.textContent = player.baseKl;
  document.getElementById(`${prefix}-god`)?.textContent = player.godCharges;
  document.getElementById(`${prefix}-hand`)?.textContent = player.hand.length;
  document.getElementById(`${prefix}-veiled`)?.textContent = player.veiledDeck.length;
  document.getElementById(`${prefix}-crypt`)?.textContent = player.crypt.length;

  document.getElementById(`${prefix}-veiled-count`)?.textContent = `${player.veiledDeck.length} card(s)`;
  document.getElementById(`${prefix}-crypt-count`)?.textContent = `${player.crypt.length} card(s)`;
  document.getElementById(`${prefix}-domain-count`)?.textContent = `${player.domainZone ? 1 : 0} domain(s)`;
  document.getElementById(`${prefix}-shard-count`)?.textContent = `${player.shardRow.length} in play`;
  document.getElementById(`${prefix}-deity`)?.textContent = `${player.deity.name} – Essence ${player.deity.startingEssence ?? player.essence}`;

  highlightGodOrbs(prefix, player.godCharges);
  updateMeters(prefix, player);
}

function refreshBoard() {
  if (!gameState) return;
  const playerOne = gameState.players.find((p) => p.id === "P1");
  const playerTwo = gameState.players.find((p) => p.id === "P2");
  if (playerOne) updatePlayerPanel("bottom", playerOne);
  if (playerTwo) updatePlayerPanel("top", playerTwo);
  if (turnIndicator) {
    if (gameState.turnNumber === 0) {
      turnIndicator.textContent = "Turn: Not started • Click “Start Game (P1 Turn 1)”";
    } else {
      const active = getActivePlayer(gameState);
      turnIndicator.textContent = `Turn ${gameState.turnNumber} • Active: ${active?.id ?? "Unknown"}`;
    }
  }
  const centerLine = document.getElementById("center-line");
  if (centerLine) {
    centerLine.textContent = `Turn ${gameState.turnNumber} • KL threshold 13 • KL cap 31 • Max 3 God Charges per commander.`;
  }
}

function setupGame() {
  if (typeof DEITY_DATABASE === "undefined" || DEITY_DATABASE.length === 0) {
    console.error("Deity data missing");
    return;
  }
  const deityOne = DEITY_DATABASE[0];
  const deityTwo = DEITY_DATABASE[1] || DEITY_DATABASE[0];
  const setupOne = buildPlayerSetup("P1", deityOne, 0);
  const setupTwo = buildPlayerSetup("P2", deityTwo, 20);
  gameState = createGameFromSetups([setupOne, setupTwo], "P1");
  refreshBoard();
  attackAllButton.disabled = true;
}

function handleStart() {
  if (!gameState) setupGame();
  if (!gameState) return;
  startTurn(gameState);
  attackAllButton.disabled = false;
  refreshBoard();
}

function handleReset() {
  setupGame();
}

function handleAttackAll() {
  if (!gameState) return;
  const attacker = getActivePlayer(gameState);
  const defender = getOpponent(gameState, attacker.id);
  // No assignments yet; this is a placeholder hook for future combat UI.
  turnIndicator.textContent = `Attack declared by ${attacker.id} against ${defender.id} (UI placeholder).`;
}

function setMenuMessage(message) {
  if (menuMessage) {
    menuMessage.textContent = message;
  }
}

function showHome() {
  if (homeScreen) homeScreen.hidden = false;
  if (battleScreen) battleScreen.hidden = true;
  setMenuMessage("Select a tile to continue.");
}

function startBattle(mode = "solo") {
  lastMode = mode;
  setupGame();
  const modeLabel = document.querySelector(".mode-label");
  if (modeLabel) {
    modeLabel.textContent = mode === "campaign" ? "Campaign" : "Guided";
  }
  if (turnIndicator) {
    turnIndicator.textContent = `Mode: ${mode} • Ready to start`;
  }
  if (attackAllButton) {
    attackAllButton.disabled = true;
  }
  refreshBoard();
}

function showBattle(mode = "solo") {
  if (homeScreen) homeScreen.hidden = true;
  if (battleScreen) battleScreen.hidden = false;
  startBattle(mode);
}

function handleMenuTile(tile) {
  const battleMode = tile.dataset.battleMode;
  const action = tile.dataset.action;
  if (battleMode) {
    showBattle(battleMode);
    return;
  }
  const copy = {
    profile: "Profile setup will let you choose your name and avatar soon.",
    multiplayer: "Multiplayer lobbies will unlock in a future update.",
    deckbuilder: "Deck Builder will let you forge decks from your collection.",
    collection: "Collection view will showcase all unlocked shards.",
    shop: "Shard Shop will open for cosmetics and boosts soon.",
  };
  if (action && copy[action]) {
    setMenuMessage(copy[action]);
  }
}

startButton?.addEventListener("click", handleStart);
resetButton?.addEventListener("click", () => {
  setupGame();
  if (turnIndicator) {
    turnIndicator.textContent = `Mode: ${lastMode} • Ready to start`;
  }
});
attackAllButton?.addEventListener("click", handleAttackAll);

menuTiles.forEach((tile) => {
  tile.addEventListener("click", () => handleMenuTile(tile));
});

backButton?.addEventListener("click", showHome);

showHome();
