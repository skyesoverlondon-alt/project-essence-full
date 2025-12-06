import { Card } from "./card";

export interface Player {
  id: string;

  // Core identity
  deity: Card;

  // Resources
  essence: number; // life force / HP analogue
  baseKl: number; // base KL from Deity
  currentKl: number; // recalculated each turn
  godCharges: number;
  klThresholdTriggeredThisTurn: boolean;

  // Zones
  hand: Card[];
  veiledDeck: Card[];
  crypt: Card[];
  nullZone: Card[];
  domainZone: Card | null;
  shardRow: Card[];
  avatarLine: Card[];
  relicSupportZone: Card[];

  // Turn tracking
  turnsTaken: number;
}
