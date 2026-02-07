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
};

export type Pot = { total: number };

export type BettingRound = "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";

export type PublicGameState = {
  handId: string | null;
  round: BettingRound | null;
  board: string[];
  pot: Pot;
  currentBet: number;
  minRaise: number;
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
  | { type: "ERROR"; code: string; message: string };
