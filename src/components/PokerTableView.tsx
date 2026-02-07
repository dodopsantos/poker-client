"use client";

import type { TableState } from "../contracts/table";

type Props = {
  state: TableState;
};

function safeCard(code: string) {
  if (!code || typeof code !== "string") return "??";
  // Typical: "AS", "TD", "7H".
  const v = code.slice(0, -1) || "?";
  const s = code.slice(-1) || "?";
  return `${v}${s}`;
}

function formatChips(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${Math.floor(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}k`;
  return `${n}`;
}

export function PokerTableView({ state }: Props) {
  const totalSeats = state.table.maxPlayers;
  const radius = 172; // px

  return (
    <div className="pokerStage">
      <div className="pokerTable">
        <div className="pokerFelt" />

        {/* Center: pot + board */}
        <div className="pokerCenter">
          <div className="pokerPot">
            <div className="small">Pote</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{formatChips(state.game.pot.total)}</div>
          </div>

          <div className="pokerBoard">
            {state.game.board.length === 0 ? (
              <div className="pokerBoardEmpty small">Board (placeholder)</div>
            ) : (
              state.game.board.map((c, idx) => (
                <div className="pokerCard" key={`${c}-${idx}`}>
                  {safeCard(c)}
                </div>
              ))
            )}
          </div>

          <div className="pokerMeta small">
            <span>Round: {state.game.round ?? "-"}</span>
            <span>•</span>
            <span>Current bet: {formatChips(state.game.currentBet)}</span>
            <span>•</span>
            <span>Min raise: {formatChips(state.game.minRaise)}</span>
          </div>
        </div>

        {/* Seats around the table */}
        {state.seats.map((s) => {
          const i = s.seatNo - 1;
          const angle = (Math.PI * 2 * i) / totalSeats - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const occupied = Boolean(s.user);

          return (
            <div
              key={s.seatNo}
              className={`pokerSeat ${occupied ? "pokerSeatOccupied" : "pokerSeatEmpty"}`}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              title={occupied ? `${s.user!.username} • stack ${s.stack}` : `Seat #${s.seatNo}`}
            >
              <div className="pokerSeatBadge">#{s.seatNo}</div>
              <div className="pokerSeatName">{occupied ? s.user!.username : "vazio"}</div>
              <div className="pokerSeatStack small">{formatChips(s.stack)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
