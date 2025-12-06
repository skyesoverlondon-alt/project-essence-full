import { Player } from "./player";

export interface GameState {
  players: Player[];
  activePlayerId: string;
  firstPlayerId: string;
  turnNumber: number;
  // We can extend this later with phase, stack, etc.
}
