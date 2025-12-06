import { Zone } from "./zones.js";
import { sendToCrypt } from "./movement.js";

export function resolveCombat(state, attackingPlayerId, defendingPlayerId, assignments) {
  const attackerPlayer = state.players.find((p) => p.id === attackingPlayerId);
  const defenderPlayer = state.players.find((p) => p.id === defendingPlayerId);
  if (!attackerPlayer || !defenderPlayer) {
    throw new Error("Attacker or defender not found in GameState.");
  }

  const attackerMap = new Map();
  for (const assign of assignments) {
    const attackerCard = attackerPlayer.avatarLine.find((c) => c.cardId === assign.attackerCardId);
    if (!attackerCard) {
      throw new Error(`Avatar ${assign.attackerCardId} not found on avatarLine for player ${attackerPlayer.id}.`);
    }
    attackerCard.tapped = true;
    attackerMap.set(assign.attackerCardId, attackerCard);
  }

  let totalUnblockedDamageToEssence = 0;

  const getPower = (card) => card.power ?? 0;
  const getGuard = (card) => (card.guard == null ? 1 : card.guard);
  const markDamage = (card, amount) => {
    if (amount <= 0) return;
    card.damageMarked += amount;
  };

  for (const assign of assignments) {
    const attackerCard = attackerMap.get(assign.attackerCardId);
    const attackerPower = getPower(attackerCard);
    if (assign.blockerCardId) {
      const blockerCard = defenderPlayer.avatarLine.find((c) => c.cardId === assign.blockerCardId);
      if (!blockerCard) {
        throw new Error(`Blocker ${assign.blockerCardId} not found on avatarLine for player ${defenderPlayer.id}.`);
      }
      const blockerPower = getPower(blockerCard);
      markDamage(attackerCard, blockerPower);
      markDamage(blockerCard, attackerPower);
    } else {
      totalUnblockedDamageToEssence += attackerPower;
    }
  }

  if (totalUnblockedDamageToEssence > 0) {
    defenderPlayer.essence -= totalUnblockedDamageToEssence;
    if (defenderPlayer.essence < 0) defenderPlayer.essence = 0;
  }

  const isDead = (card) => card.damageMarked >= getGuard(card);
  const deadAttackers = attackerPlayer.avatarLine.filter(isDead).map((c) => c.cardId);
  const deadDefenders = defenderPlayer.avatarLine.filter(isDead).map((c) => c.cardId);

  for (const cardId of deadAttackers) sendToCrypt(state, attackingPlayerId, cardId);
  for (const cardId of deadDefenders) sendToCrypt(state, defendingPlayerId, cardId);
}
