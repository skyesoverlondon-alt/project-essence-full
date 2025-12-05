import type { GameState } from "./gameState";
import type { Player } from "./player";
import type { Card } from "./card";
import { Zone } from "./zones";
import { sendToCrypt } from "./movement";

export interface CombatAssignment {
  attackerCardId: string;
  blockerCardId?: string; // undefined = unblocked
}

function getPlayer(state: GameState, playerId: string): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player with id ${playerId} not found in GameState.`);
  }
  return player;
}

function findAvatarOnLine(player: Player, cardId: string): Card {
  const card = player.avatarLine.find((c) => c.cardId === cardId);
  if (!card) {
    throw new Error(
      `Avatar ${cardId} not found on avatarLine for player ${player.id}.`
    );
  }
  return card;
}

function getPower(card: Card): number {
  return card.power ?? 0;
}

function getGuard(card: Card): number {
  // If no guard defined, treat it as 1 toughness by default
  if (card.guard == null) return 1;
  return card.guard;
}

function markDamage(card: Card, amount: number): void {
  if (amount <= 0) return;
  card.damageMarked += amount;
}

function isDead(card: Card): boolean {
  const guard = getGuard(card);
  return card.damageMarked >= guard;
}

/**
 * Resolve combat for a set of attackers and optional blockers.
 *
 * - Each attacker in `assignments` must be an Avatar on the attacking player's avatarLine.
 * - If a blockerCardId is provided, that card must be an Avatar on the defending player's avatarLine.
 * - Damage is simultaneous between attacker and blocker.
 * - Unblocked attackers deal Essence damage to the defending player equal to their Power.
 * - Any creature whose damageMarked >= guard dies and is sent to the Crypt.
 */
export function resolveCombat(
  state: GameState,
  attackingPlayerId: string,
  defendingPlayerId: string,
  assignments: CombatAssignment[]
): void {
  const attackerPlayer = getPlayer(state, attackingPlayerId);
  const defenderPlayer = getPlayer(state, defendingPlayerId);

  // Mark all attackers as tapped when they declare
  const attackerMap = new Map<string, Card>();
  for (const assign of assignments) {
    const attackerCard = findAvatarOnLine(attackerPlayer, assign.attackerCardId);
    attackerCard.tapped = true;
    attackerMap.set(assign.attackerCardId, attackerCard);
  }

  // First pass: assign damage
  let totalUnblockedDamageToEssence = 0;

  for (const assign of assignments) {
    const attackerCard = attackerMap.get(assign.attackerCardId)!;
    const attackerPower = getPower(attackerCard);

    if (assign.blockerCardId) {
      // Blocked combat
      const blockerCard = findAvatarOnLine(defenderPlayer, assign.blockerCardId);
      const blockerPower = getPower(blockerCard);

      // Simultaneous damage
      markDamage(attackerCard, blockerPower);
      markDamage(blockerCard, attackerPower);
    } else {
      // Unblocked: damage goes to defender's Essence
      totalUnblockedDamageToEssence += attackerPower;
    }
  }

  // Apply Essence damage to defending player
  if (totalUnblockedDamageToEssence > 0) {
    defenderPlayer.essence -= totalUnblockedDamageToEssence;
    if (defenderPlayer.essence < 0) {
      defenderPlayer.essence = 0;
    }
  }

  // Second pass: kill any dead Avatars on both sides (send to Crypt)
  // We snapshot card IDs first to avoid mutating while iterating.
  const deadAttackers: string[] = [];
  for (const card of attackerPlayer.avatarLine) {
    if (isDead(card)) {
      deadAttackers.push(card.cardId);
    }
  }

  const deadDefenders: string[] = [];
  for (const card of defenderPlayer.avatarLine) {
    if (isDead(card)) {
      deadDefenders.push(card.cardId);
    }
  }

  for (const cardId of deadAttackers) {
    sendToCrypt(state, attackingPlayerId, cardId);
  }

  for (const cardId of deadDefenders) {
    sendToCrypt(state, defendingPlayerId, cardId);
  }
}
