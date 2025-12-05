import type { GameState } from "./gameState";
import type { Player } from "./player";
import type { Card } from "./card";
import { Zone } from "./zones";

function getPlayer(state: GameState, playerId: string): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player with id ${playerId} not found.`);
  }
  return player;
}

function findCardInZone(zone: Card[], cardId: string): { card: Card; index: number } {
  const index = zone.findIndex((c) => c.cardId === cardId);
  if (index === -1) {
    throw new Error(`Card ${cardId} not found in expected zone.`);
  }
  return { card: zone[index], index };
}

function spendKlForCard(player: Player, card: Card): void {
  const cost = card.klCost ?? 0;
  if (cost < 0) {
    throw new Error(`Card ${card.cardId} has negative KL cost, which is invalid.`);
  }
  if (player.currentKl < cost) {
    throw new Error(
      `Player ${player.id} cannot pay KL cost ${cost} for card ${card.cardId} (only ${player.currentKl} KL available).`
    );
  }
  player.currentKl -= cost;
}

/**
 * Move a card from hand to a board zone array.
 */
function moveFromHandToZone(
  player: Player,
  cardId: string,
  targetZoneArray: Card[],
  zoneType: Zone
): void {
  const { card, index } = findCardInZone(player.hand, cardId);
  spendKlForCard(player, card);

  // Remove from hand
  player.hand.splice(index, 1);

  // Place in target zone
  card.zone = zoneType;
  card.controllerId = player.id;
  targetZoneArray.push(card);
}

/**
 * Play a Domain from hand.
 * If a Domain is already in domainZone, we send the old Domain to the Crypt.
 */
export function playDomain(state: GameState, playerId: string, cardId: string): void {
  const player = getPlayer(state, playerId);

  // If there's already a domain, send it to Crypt
  if (player.domainZone) {
    const oldDomain = player.domainZone;
    oldDomain.zone = Zone.CRYPT;
    player.crypt.push(oldDomain);
    player.domainZone = null;
  }

  const { card, index } = findCardInZone(player.hand, cardId);
  spendKlForCard(player, card);

  // Remove from hand
  player.hand.splice(index, 1);

  // Place as the new domain
  card.zone = Zone.DOMAIN_ZONE;
  card.controllerId = player.id;
  player.domainZone = card;
}

/**
 * Play a Shard from hand to the Shard Row.
 */
export function playShard(state: GameState, playerId: string, cardId: string): void {
  const player = getPlayer(state, playerId);
  moveFromHandToZone(player, cardId, player.shardRow, Zone.SHARD_ROW);
}

/**
 * Play an Avatar from hand to the Avatar Line.
 */
export function playAvatar(state: GameState, playerId: string, cardId: string): void {
  const player = getPlayer(state, playerId);
  moveFromHandToZone(player, cardId, player.avatarLine, Zone.AVATAR_LINE);
}

/**
 * Play a Relic/Support from hand to the Relic/Support zone.
 */
export function playRelicOrSupport(
  state: GameState,
  playerId: string,
  cardId: string
): void {
  const player = getPlayer(state, playerId);
  moveFromHandToZone(
    player,
    cardId,
    player.relicSupportZone,
    Zone.RELIC_SUPPORT_ZONE
  );
}

/**
 * Send a card from a board zone to the Crypt.
 */
export function sendToCrypt(
  state: GameState,
  playerId: string,
  cardId: string
): void {
  const player = getPlayer(state, playerId);

  // Try each board zone + domain
  const zones: { name: string; array?: Card[]; single?: Card | null; setSingle?: (c: Card | null) => void }[] = [
    { name: "shardRow", array: player.shardRow },
    { name: "avatarLine", array: player.avatarLine },
    { name: "relicSupportZone", array: player.relicSupportZone },
    {
      name: "domainZone",
      single: player.domainZone,
      setSingle: (c: Card | null) => {
        player.domainZone = c;
      },
    },
  ];

  for (const zoneInfo of zones) {
    if (zoneInfo.array) {
      const index = zoneInfo.array.findIndex((c) => c.cardId === cardId);
      if (index !== -1) {
        const [card] = zoneInfo.array.splice(index, 1);
        card.zone = Zone.CRYPT;
        player.crypt.push(card);
        return;
      }
    } else if (zoneInfo.single && zoneInfo.single.cardId === cardId) {
      const card = zoneInfo.single;
      zoneInfo.setSingle!(null);
      card.zone = Zone.CRYPT;
      player.crypt.push(card);
      return;
    }
  }

  throw new Error(`Card ${cardId} not found on board to send to Crypt.`);
}

/**
 * Send a card from anywhere the player controls (hand or board) to the Null Zone.
 */
export function sendToNull(
  state: GameState,
  playerId: string,
  cardId: string
): void {
  const player = getPlayer(state, playerId);

  // 1) Hand
  const handIndex = player.hand.findIndex((c) => c.cardId === cardId);
  if (handIndex !== -1) {
    const [card] = player.hand.splice(handIndex, 1);
    card.zone = Zone.NULL_ZONE;
    player.nullZone.push(card);
    return;
  }

  // 2) Board (similar to sendToCrypt)
  const zones: { name: string; array?: Card[]; single?: Card | null; setSingle?: (c: Card | null) => void }[] = [
    { name: "shardRow", array: player.shardRow },
    { name: "avatarLine", array: player.avatarLine },
    { name: "relicSupportZone", array: player.relicSupportZone },
    {
      name: "domainZone",
      single: player.domainZone,
      setSingle: (c: Card | null) => {
        player.domainZone = c;
      },
    },
  ];

  for (const zoneInfo of zones) {
    if (zoneInfo.array) {
      const index = zoneInfo.array.findIndex((c) => c.cardId === cardId);
      if (index !== -1) {
        const [card] = zoneInfo.array.splice(index, 1);
        card.zone = Zone.NULL_ZONE;
        player.nullZone.push(card);
        return;
      }
    } else if (zoneInfo.single && zoneInfo.single.cardId === cardId) {
      const card = zoneInfo.single;
      zoneInfo.setSingle!(null);
      card.zone = Zone.NULL_ZONE;
      player.nullZone.push(card);
      return;
    }
  }

  throw new Error(`Card ${cardId} not found to send to Null.`);
}
