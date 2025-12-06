import { Zone } from "./zones.js";

function getPlayer(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Player with id ${playerId} not found.`);
  return player;
}

function findCardInZone(zone, cardId) {
  const index = zone.findIndex((c) => c.cardId === cardId);
  if (index === -1) throw new Error(`Card ${cardId} not found in expected zone.`);
  return { card: zone[index], index };
}

function spendKlForCard(player, card) {
  const cost = card.klCost ?? 0;
  if (cost < 0) throw new Error(`Card ${card.cardId} has negative KL cost, which is invalid.`);
  if (player.currentKl < cost) {
    throw new Error(
      `Player ${player.id} cannot pay KL cost ${cost} for card ${card.cardId} (only ${player.currentKl} KL available).`
    );
  }
  player.currentKl -= cost;
}

function moveFromHandToZone(player, cardId, targetZoneArray, zoneType) {
  const { card, index } = findCardInZone(player.hand, cardId);
  spendKlForCard(player, card);
  player.hand.splice(index, 1);
  card.zone = zoneType;
  card.controllerId = player.id;
  targetZoneArray.push(card);
}

export function playDomain(state, playerId, cardId) {
  const player = getPlayer(state, playerId);
  if (player.domainZone) {
    const oldDomain = player.domainZone;
    oldDomain.zone = Zone.CRYPT;
    player.crypt.push(oldDomain);
    player.domainZone = null;
  }
  const { card, index } = findCardInZone(player.hand, cardId);
  spendKlForCard(player, card);
  player.hand.splice(index, 1);
  card.zone = Zone.DOMAIN_ZONE;
  card.controllerId = player.id;
  player.domainZone = card;
}

export function playShard(state, playerId, cardId) {
  const player = getPlayer(state, playerId);
  moveFromHandToZone(player, cardId, player.shardRow, Zone.SHARD_ROW);
}

export function playAvatar(state, playerId, cardId) {
  const player = getPlayer(state, playerId);
  moveFromHandToZone(player, cardId, player.avatarLine, Zone.AVATAR_LINE);
}

export function playRelicOrSupport(state, playerId, cardId) {
  const player = getPlayer(state, playerId);
  moveFromHandToZone(player, cardId, player.relicSupportZone, Zone.RELIC_SUPPORT_ZONE);
}

export function sendToCrypt(state, playerId, cardId) {
  const player = getPlayer(state, playerId);
  const zones = [
    { name: "shardRow", array: player.shardRow },
    { name: "avatarLine", array: player.avatarLine },
    { name: "relicSupportZone", array: player.relicSupportZone },
    {
      name: "domainZone",
      single: player.domainZone,
      setSingle: (c) => {
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
      zoneInfo.setSingle(null);
      card.zone = Zone.CRYPT;
      player.crypt.push(card);
      return;
    }
  }
  throw new Error(`Card ${cardId} not found on board to send to Crypt.`);
}

export function sendToNull(state, playerId, cardId) {
  const player = getPlayer(state, playerId);
  const handIndex = player.hand.findIndex((c) => c.cardId === cardId);
  if (handIndex !== -1) {
    const [card] = player.hand.splice(handIndex, 1);
    card.zone = Zone.NULL_ZONE;
    player.nullZone.push(card);
    return;
  }

  const zones = [
    { name: "shardRow", array: player.shardRow },
    { name: "avatarLine", array: player.avatarLine },
    { name: "relicSupportZone", array: player.relicSupportZone },
    {
      name: "domainZone",
      single: player.domainZone,
      setSingle: (c) => {
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
      zoneInfo.setSingle(null);
      card.zone = Zone.NULL_ZONE;
      player.nullZone.push(card);
      return;
    }
  }
  throw new Error(`Card ${cardId} not found to send to Null.`);
}
