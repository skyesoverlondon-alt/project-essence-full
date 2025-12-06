import type { Player } from "./player";

export const GOD_THRESHOLD_KL = 13;
export const ABSOLUTE_KL_CAP = 31;
export const MIN_KL = 0;
export const MAX_GOD_CHARGES = 3;
export const MIN_TURN_FOR_GOD_CHARGE_SPEND = 4;

/**
 * Placeholder for static KL bonuses from Domains, Relics, Deity text, etc.
 * For now we return 0 so we don't overcomplicate the early engine.
 * Later we can look at the player's domainZone / relicSupportZone / deity.abilities.
 */
function getStaticKlBonuses(_player: Player): number {
  return 0;
}

/**
 * Placeholder for start-of-turn KL effects.
 * Later we can read triggered abilities, auras, etc.
 */
function getStartOfTurnKlEffects(_player: Player): number {
  return 0;
}

/**
 * Recalculate a player's current KL based on:
 * - baseKl (from Deity)
 * - +1 per Shard in shardRow
 * - any static & start-of-turn bonuses
 * Then clamp to [MIN_KL, ABSOLUTE_KL_CAP].
 */
export function recalculateKl(player: Player): number {
  let kl = player.baseKl;

  // +1 KL per shard in the Shard Row
  kl += player.shardRow.length;

  // Static & start-of-turn effects (stubs for now)
  kl += getStaticKlBonuses(player);
  kl += getStartOfTurnKlEffects(player);

  if (kl > ABSOLUTE_KL_CAP) {
    kl = ABSOLUTE_KL_CAP;
  }
  if (kl < MIN_KL) {
    kl = MIN_KL;
  }

  return kl;
}

/**
 * Check if the player crosses the 13-KL God threshold this turn.
 * If oldKl < 13 and newKl >= 13 and the threshold wasn't already triggered this turn:
 * - grant +1 God Charge (up to a max of 3)
 * - mark klThresholdTriggeredThisTurn = true
 */
export function checkGodThreshold(
  player: Player,
  oldKl: number,
  newKl: number
): void {
  if (player.klThresholdTriggeredThisTurn) {
    return;
  }

  const crossedThreshold =
    oldKl < GOD_THRESHOLD_KL && newKl >= GOD_THRESHOLD_KL;

  if (crossedThreshold) {
    if (player.godCharges < MAX_GOD_CHARGES) {
      player.godCharges += 1;
    }
    player.klThresholdTriggeredThisTurn = true;
  }
}

/**
 * You cannot spend God Charges before turn 4.
 * You also cannot spend more than you have.
 */
export function canSpendGodCharges(
  player: Player,
  amount: number,
  turnNumber: number
): boolean {
  if (amount <= 0) return false;

  if (turnNumber < MIN_TURN_FOR_GOD_CHARGE_SPEND) {
    return false;
  }

  if (player.godCharges < amount) {
    return false;
  }

  return true;
}

/**
 * Spend God Charges, enforcing:
 * - Can't spend before turn 4
 * - Can't spend more than you have
 * Throws if the spend is illegal.
 */
export function spendGodCharges(
  player: Player,
  amount: number,
  turnNumber: number
): void {
  if (!canSpendGodCharges(player, amount, turnNumber)) {
    throw new Error(
      `Cannot spend ${amount} God Charge(s) on turn ${turnNumber} with ${player.godCharges} available.`
    );
  }

  player.godCharges -= amount;
}
