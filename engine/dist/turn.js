import { Zone } from "./zones.js";
import { recalculateKl, checkGodThreshold } from "./resources.js";

function getActivePlayer(state) {
  const player = state.players.find((p) => p.id === state.activePlayerId);
  if (!player) throw new Error(`Active player with id ${state.activePlayerId} not found in GameState.`);
  return player;
}

function readyAllPermanents(player) {
  const zones = [player.domainZone, player.shardRow, player.avatarLine, player.relicSupportZone];
  for (const zone of zones) {
    if (!zone) continue;
    if (Array.isArray(zone)) {
      zone.forEach((card) => {
        card.tapped = false;
      });
    } else {
      zone.tapped = false;
    }
  }
}

function drawCard(player) {
  if (player.veiledDeck.length === 0) return;
  const card = player.veiledDeck.shift();
  card.zone = Zone.HAND;
  player.hand.push(card);
}

export function startPhase(state) {
  const player = getActivePlayer(state);
  readyAllPermanents(player);
  const isFirstTurn = state.turnNumber === 1;
  const isFirstPlayer = player.id === state.firstPlayerId;
  const shouldSkipDraw = isFirstTurn && isFirstPlayer;
  if (!shouldSkipDraw) drawCard(player);
  player.klThresholdTriggeredThisTurn = false;
  const oldKl = player.currentKl ?? player.baseKl;
  const newKl = recalculateKl(player);
  player.currentKl = newKl;
  checkGodThreshold(player, oldKl, newKl);
}

export function startTurn(state) {
  if (state.players.length === 0) {
    throw new Error("GameState has no players.");
  }

  if (state.turnNumber === 0) {
    state.turnNumber = 1;
    state.activePlayerId = state.firstPlayerId;
  } else {
    state.turnNumber += 1;
    const currentIndex = state.players.findIndex((p) => p.id === state.activePlayerId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.players.length;
    state.activePlayerId = state.players[nextIndex].id;
  }

  startPhase(state);
}
