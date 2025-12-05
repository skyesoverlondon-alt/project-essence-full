import type { GameState } from "./gameState";
import type { Player } from "./player";
import type { Card } from "./card";
import { Zone } from "./zones";
import { recalculateKl, checkGodThreshold } from "./resources";

/**
 * Find the active player by id.
 */
function getActivePlayer(state: GameState): Player {
  const player = state.players.find((p) => p.id === state.activePlayerId);
  if (!player) {
    throw new Error(
      `Active player with id ${state.activePlayerId} not found in GameState.`
    );
  }
  return player;
}

/**
 * Ready all permanents under the player's control.
 * For now we just untap cards in the main board zones.
 */
function readyAllPermanents(player: Player): void {
  const zones: (Card | null | Card[])[] = [
    player.domainZone,
    player.shardRow,
    player.avatarLine,
    player.relicSupportZone,
  ];

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

/**
 * Draw a single card from the top of the veiled deck into hand.
 * Top of deck = index 0.
 */
function drawCard(player: Player): void {
  if (player.veiledDeck.length === 0) {
    return;
  }
  const card = player.veiledDeck.shift()!;
  card.zone = Zone.HAND;
  player.hand.push(card);
}

/**
 * Start Phase for the current active player:
 * - Ready permanents
 * - Handle draw (first player on turn 1 skips)
 * - Reset KL threshold flag
 * - Recalculate KL and check God threshold
 */
export function startPhase(state: GameState): void {
  const player = getActivePlayer(state);

  // 1. Ready permanents
  readyAllPermanents(player);

  // 2. Draw step (first player on turn 1 skips draw)
  const isFirstTurn = state.turnNumber === 1;
  const isFirstPlayer = player.id === state.firstPlayerId;
  const shouldSkipDraw = isFirstTurn && isFirstPlayer;

  if (!shouldSkipDraw) {
    drawCard(player);
  }

  // 3. KL recalculation & God threshold
  player.klThresholdTriggeredThisTurn = false;

  const oldKl = player.currentKl ?? player.baseKl;
  const newKl = recalculateKl(player);
  player.currentKl = newKl;

  checkGodThreshold(player, oldKl, newKl);
}

/**
 * Advance the game to the next turn and run the Start Phase.
 *
 * Behavior:
 * - If turnNumber is 0: this is the very first call:
 *   - set turnNumber = 1
 *   - activePlayerId = firstPlayerId
 * - Otherwise:
 *   - increment turnNumber
 *   - rotate activePlayerId to the next player in the players array (cyclic)
 * - Then run startPhase for the active player.
 */
export function startTurn(state: GameState): void {
  if (state.players.length === 0) {
    throw new Error("GameState has no players.");
  }

  if (state.turnNumber === 0) {
    // First ever turn
    state.turnNumber = 1;
    state.activePlayerId = state.firstPlayerId;
  } else {
    state.turnNumber += 1;
    const currentIndex = state.players.findIndex(
      (p) => p.id === state.activePlayerId
    );
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + 1) % state.players.length;
    state.activePlayerId = state.players[nextIndex].id;
  }

  startPhase(state);
}
