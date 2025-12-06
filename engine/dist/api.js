import { startTurn as coreStartTurn } from "./turn.js";
import {
  playDomain as corePlayDomain,
  playShard as corePlayShard,
  playAvatar as corePlayAvatar,
  playRelicOrSupport as corePlayRelicOrSupport,
  sendToCrypt as coreSendToCrypt,
  sendToNull as coreSendToNull,
} from "./movement.js";
import { resolveCombat as coreResolveCombat } from "./combat.js";

export function createPlayerFromSetup(setup) {
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

export function createGameFromSetups(setups, firstPlayerId) {
  if (!setups || setups.length === 0) {
    throw new Error("createGameFromSetups requires at least one PlayerSetup.");
  }
  const players = setups.map(createPlayerFromSetup);
  const resolvedFirstPlayerId = firstPlayerId ?? players[0].id;
  return {
    players,
    activePlayerId: "",
    firstPlayerId: resolvedFirstPlayerId,
    turnNumber: 0,
  };
}

export function getActivePlayer(state) {
  const player = state.players.find((p) => p.id === state.activePlayerId);
  if (!player) {
    throw new Error(`Active player with id ${state.activePlayerId} not found in GameState.`);
  }
  return player;
}

export function getOpponent(state, playerId) {
  if (state.players.length !== 2) {
    throw new Error("getOpponent is only valid for 2-player games at the moment.");
  }
  const opponent = state.players.find((p) => p.id !== playerId);
  if (!opponent) {
    throw new Error(`Opponent of player ${playerId} not found in GameState (2-player assumption).`);
  }
  return opponent;
}

export function startTurn(state) {
  coreStartTurn(state);
}

export function playDomain(state, playerId, cardId) {
  corePlayDomain(state, playerId, cardId);
}

export function playShard(state, playerId, cardId) {
  corePlayShard(state, playerId, cardId);
}

export function playAvatar(state, playerId, cardId) {
  corePlayAvatar(state, playerId, cardId);
}

export function playRelicOrSupport(state, playerId, cardId) {
  corePlayRelicOrSupport(state, playerId, cardId);
}

export function sendToCrypt(state, playerId, cardId) {
  coreSendToCrypt(state, playerId, cardId);
}

export function sendToNull(state, playerId, cardId) {
  coreSendToNull(state, playerId, cardId);
}

export function resolveCombat(state, attackingPlayerId, defendingPlayerId, assignments) {
  coreResolveCombat(state, attackingPlayerId, defendingPlayerId, assignments);
}
