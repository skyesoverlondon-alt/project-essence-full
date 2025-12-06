import type { Card } from "./card";
import type { Player } from "./player";
import type { GameState } from "./gameState";

import { startTurn as coreStartTurn } from "./turn";
import {
  playDomain as corePlayDomain,
  playShard as corePlayShard,
  playAvatar as corePlayAvatar,
  playRelicOrSupport as corePlayRelicOrSupport,
  sendToCrypt as coreSendToCrypt,
  sendToNull as coreSendToNull,
} from "./movement";
import {
  resolveCombat as coreResolveCombat,
  type CombatAssignment,
} from "./combat";

/**
 * Shape for setting up a player from outside the engine.
 * You give the Deity card and a veiled deck (already in the right owner/controller).
 */
export interface PlayerSetup {
  id: string;
  deity: Card;
  veiledDeck: Card[];
}

/**
 * Create an engine Player from a PlayerSetup.
 * - essence comes from deity.startingEssence (or 0)
 * - baseKl and currentKl from deity.baseKl (or 0)
 * - zones start empty except veiledDeck
 */
export function createPlayerFromSetup(setup: PlayerSetup): Player {
  const { id, deity, veiledDeck } = setup;

  const startingEssence = deity.startingEssence ?? 0;
  const baseKl = deity.baseKl ?? 0;

  return {
    id,
    deity,
    essence: startingEssence,
    baseKl,
    currentKl: baseKl,
    godCharges: 0,
    klThresholdTriggeredThisTurn: false,

    hand: [],
    veiledDeck: [...veiledDeck],
    crypt: [],
    nullZone: [],
    domainZone: null,
    shardRow: [],
    avatarLine: [],
    relicSupportZone: [],

    turnsTaken: 0,
  };
}

/**
 * Create a GameState from an array of PlayerSetup entries.
 * - Converts each setup into a Player
 * - firstPlayerId defaults to players[0].id if not provided
 * - turnNumber starts at 0, activePlayerId is empty until first startTurn()
 */
export function createGameFromSetups(
  setups: PlayerSetup[],
  firstPlayerId?: string
): GameState {
  if (setups.length === 0) {
    throw new Error("createGameFromSetups requires at least one PlayerSetup.");
  }

  const players: Player[] = setups.map(createPlayerFromSetup);
  const resolvedFirstPlayerId = firstPlayerId ?? players[0].id;

  return {
    players,
    activePlayerId: "",
    firstPlayerId: resolvedFirstPlayerId,
    turnNumber: 0,
  };
}

/**
 * Convenience: get the active player from a GameState.
 */
export function getActivePlayer(state: GameState): Player {
  const player = state.players.find((p) => p.id === state.activePlayerId);
  if (!player) {
    throw new Error(
      `Active player with id ${state.activePlayerId} not found in GameState.`
    );
  }
  return player;
}

/**
 * Convenience: in a 2-player game, get the opponent of a given player.
 */
export function getOpponent(state: GameState, playerId: string): Player {
  if (state.players.length !== 2) {
    throw new Error(
      "getOpponent is only valid for 2-player games at the moment."
    );
  }
  const opponent = state.players.find((p) => p.id !== playerId);
  if (!opponent) {
    throw new Error(
      `Opponent of player ${playerId} not found in GameState (2-player assumption).`
    );
  }
  return opponent;
}

/**
 * Wrapper around the core startTurn.
 * External callers always use this instead of importing from ./turn directly.
 */
export function startTurn(state: GameState): void {
  coreStartTurn(state);
}

/**
 * Movement wrappers
 */
export function playDomain(
  state: GameState,
  playerId: string,
  cardId: string
): void {
  corePlayDomain(state, playerId, cardId);
}

export function playShard(
  state: GameState,
  playerId: string,
  cardId: string
): void {
  corePlayShard(state, playerId, cardId);
}

export function playAvatar(
  state: GameState,
  playerId: string,
  cardId: string
): void {
  corePlayAvatar(state, playerId, cardId);
}

export function playRelicOrSupport(
  state: GameState,
  playerId: string,
  cardId: string
): void {
  corePlayRelicOrSupport(state, playerId, cardId);
}

export function sendToCrypt(
  state: GameState,
  playerId: string,
  cardId: string
): void {
  coreSendToCrypt(state, playerId, cardId);
}

export function sendToNull(
  state: GameState,
  playerId: string,
  cardId: string
): void {
  coreSendToNull(state, playerId, cardId);
}

/**
 * Combat wrapper
 */
export function resolveCombat(
  state: GameState,
  attackingPlayerId: string,
  defendingPlayerId: string,
  assignments: CombatAssignment[]
): void {
  coreResolveCombat(state, attackingPlayerId, defendingPlayerId, assignments);
}

// Re-export type so callers can import it from the API surface.
export type { CombatAssignment } from "./combat";
export type { GameState } from "./gameState";
export type { Player } from "./player";
export type { Card } from "./card";
