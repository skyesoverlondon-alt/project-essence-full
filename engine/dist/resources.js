import { Zone } from "./zones.js";

export const GOD_THRESHOLD_KL = 13;
export const ABSOLUTE_KL_CAP = 31;
export const MIN_KL = 0;
export const MAX_GOD_CHARGES = 3;
export const MIN_TURN_FOR_GOD_CHARGE_SPEND = 4;

function getStaticKlBonuses(_player) {
  return 0;
}

function getStartOfTurnKlEffects(_player) {
  return 0;
}

export function recalculateKl(player) {
  let kl = player.baseKl;
  kl += player.shardRow.length;
  kl += getStaticKlBonuses(player);
  kl += getStartOfTurnKlEffects(player);

  if (kl > ABSOLUTE_KL_CAP) kl = ABSOLUTE_KL_CAP;
  if (kl < MIN_KL) kl = MIN_KL;
  return kl;
}

export function checkGodThreshold(player, oldKl, newKl) {
  if (player.klThresholdTriggeredThisTurn) return;
  const crossedThreshold = oldKl < GOD_THRESHOLD_KL && newKl >= GOD_THRESHOLD_KL;
  if (crossedThreshold) {
    if (player.godCharges < MAX_GOD_CHARGES) player.godCharges += 1;
    player.klThresholdTriggeredThisTurn = true;
  }
}

export function canSpendGodCharges(player, amount, turnNumber) {
  if (amount <= 0) return false;
  if (turnNumber < MIN_TURN_FOR_GOD_CHARGE_SPEND) return false;
  if (player.godCharges < amount) return false;
  return true;
}

export function spendGodCharges(player, amount, turnNumber) {
  if (!canSpendGodCharges(player, amount, turnNumber)) {
    throw new Error(
      `Cannot spend ${amount} God Charge(s) on turn ${turnNumber} with ${player.godCharges} available.`
    );
  }
  player.godCharges -= amount;
}
