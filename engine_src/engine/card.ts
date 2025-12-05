import { Zone } from "./zones";

export type CardType =
  | "DEITY"
  | "DOMAIN"
  | "SHARD"
  | "AVATAR"
  | "SPELL"
  | "RITE"
  | "RELIC"
  | "SUPPORT"
  | "TOKEN";

export interface CardAbility {
  id: string;
  label: string;
  description: string;
}

export interface Card {
  // Static card data (from your card schema)
  cardId: string;
  name: string;
  typeLine: CardType;
  subtypes: string[];
  domainTag?: string;
  klCost: number;
  power?: number;
  guard?: number;
  startingEssence?: number; // for Deities
  baseKl?: number; // for Deities
  abilities: CardAbility[];
  isToken: boolean;

  // Runtime / in-game state
  ownerId: string; // which player owns this card for deck/crypt/null
  controllerId: string; // who currently controls it on board
  zone: Zone;
  damageMarked: number;
  tapped: boolean;
  temporaryModifiers: any[]; // we can refine this later
}
