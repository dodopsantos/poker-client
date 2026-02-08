export type TableStatus = "OPEN" | "RUNNING" | "CLOSED";
export type SeatState = "EMPTY" | "SITTING" | "PLAYING";

export type SeatPublic = {
  seatNo: number;
  state: SeatState;
  user?: { id: string; username: string };
  stack: number;
  isDealer?: boolean;
  isTurn?: boolean;
  bet?: number;
  hasFolded?: boolean;
  isAllIn?: boolean;
  committed?: number;
};

export type Pot = { total: number };

export type BettingRound = "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";

export type PublicGameState = {
  handId: string | null;
  round: BettingRound | null;
  board: string[];
  /** Cards already drawn for the next street but not revealed yet (server-driven dealing animation). */
  pendingBoard?: string[];
  pot: Pot;
  currentBet: number;
  minRaise: number;
  /** When true, the server is currently revealing board cards (clients should disable actions). */
  isDealingBoard?: boolean;
  /** Server-authoritative turn deadline (unix ms). Optional for backwards compatibility. */
  turnEndsAt?: number | null;
};

export type TableState = {
  table: {
    id: string;
    name: string;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
    status: TableStatus;
  };
  seats: SeatPublic[];
  game: PublicGameState;
  updatedAt: number;
};

export type TableEvent =
  | { type: "STATE_SNAPSHOT"; tableId: string; state: TableState }
  | { type: "HAND_STARTED"; tableId: string; handId: string; round: BettingRound }
  | { type: "HAND_ENDED"; tableId: string; winnerSeat?: number; winners?: Array<{ seatNo: number; userId: string; payout: number }>; pot?: number }
  | { type: "SHOWDOWN_REVEAL"; tableId: string; pot: number; reveal: Array<{ seatNo: number; userId: string; cards: string[] }>; winners: Array<{ seatNo: number; userId: string; payout: number }> }
  | { type: "ERROR"; code: string; message: string };

export type PrivateCardsEvent = { tableId: string; handId: string; cards: string[] };
