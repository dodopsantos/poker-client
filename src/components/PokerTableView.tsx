"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { TableState } from "../contracts/table";
import { Card } from "./Card";
import { BetChipStack } from "./BetChipStack";

type Props = {
  state: TableState;
  mySeatNo?: number | null;
  myCards?: string[];
  onEmptySeatClick?: (seatNo: number) => void;
  canSit?: boolean;
};

function safeCard(code: string) {
  if (!code || typeof code !== "string") return "??";
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

export function PokerTableView({
  state,
  mySeatNo = null,
  myCards = [],
  onEmptySeatClick,
  canSit = true,
}: Props) {
  const totalSeats = state.table.maxPlayers;

  const tableRef = useRef<HTMLDivElement | null>(null);
  const [tableSize, setTableSize] = useState<{ w: number; h: number }>({
    w: 1200,
    h: 620,
  });

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(300, Math.floor(r.width));
      const h = Math.max(240, Math.floor(r.height));
      setTableSize({ w, h });
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const radii = useMemo(() => {
    const rx = Math.floor(tableSize.w * 0.38);
    const ry = Math.floor(tableSize.h * 0.30);
    return { rx, ry };
  }, [tableSize]);

  const isSitting = mySeatNo != null;

  // --- Hero seat rotation (UI only) ---
  // Keep the current user always at the "bottom" position (like PokerStars).
  const heroSeat = mySeatNo ?? null;

  const normalizeSeatForUi = (seatNo: number) => {
    if (!heroSeat) return seatNo;

    // 6-max layout reference:
    // 1 top, 2 top-right, 3 mid-right, 4 bottom, 5 bottom-left, 6 mid-left.
    // We want the hero seat to render at position 4 (bottom).
    const target = 4;
    const offset = target - heroSeat;
    return ((seatNo + offset - 1) % totalSeats) + 1;
  };

  return (
    <div className="pokerStage">
      <div className="pokerTable" ref={tableRef}>
        <div className="pokerFelt" />

        {/* Center: pot + board */}
        <div className="pokerCenter">
          <div className="pokerPot">
            <div className="small">Pote</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {formatChips(state.game.pot.total)}
            </div>
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
          // For 6-max, a hand-tuned symmetric layout looks more natural on a wide oval table.
          // Layout: top, top-right, mid-right, bottom, bottom-left, mid-left.
          const sixMaxAnglesDeg: Record<number, number> = {
            1: -90,
            2: -30,
            3: 30,
            4: 90,
            5: 150,
            6: -150,
          };

          const uiSeatNo = normalizeSeatForUi(s.seatNo);
          const angle =
            totalSeats === 6 && sixMaxAnglesDeg[uiSeatNo] !== undefined
              ? (sixMaxAnglesDeg[uiSeatNo] * Math.PI) / 180
              : (Math.PI * 2 * (uiSeatNo - 1)) / totalSeats - Math.PI / 2;

          const x = Math.cos(angle) * radii.rx;
          const y = Math.sin(angle) * radii.ry;

          const occupied = Boolean(s.user);

          // Block clicking empty seats when user already sits (PokerStars behavior)
          const canClickSeat = !occupied && Boolean(onEmptySeatClick) && canSit && !isSitting;

          return (
            <React.Fragment key={s.seatNo}>
              <div
                className={`pokerSeat ${occupied ? "pokerSeatOccupied" : "pokerSeatEmpty"} ${s.isTurn ? "pokerSeatTurn" : ""
                  } ${(s as any).hasFolded ? "pokerSeatFolded" : ""}`}
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  cursor: !occupied && onEmptySeatClick ? (canClickSeat ? "pointer" : "not-allowed") : "default",
                }}
                onClick={() => {
                  if (canClickSeat && onEmptySeatClick) onEmptySeatClick(s.seatNo);
                }}
                title={
                  occupied
                    ? `${s.user!.username} • stack ${s.stack}`
                    : canClickSeat
                      ? `Seat #${s.seatNo} (clique para sentar)`
                      : isSitting
                        ? `Você já está sentado no seat #${mySeatNo}`
                        : `Seat #${s.seatNo}`
                }
              >
                <div className="pokerSeatBadge">#{s.seatNo}</div>

                {/* Hero style (PokerStars plate) */}
                {mySeatNo === s.seatNo && occupied ? (
                  <div className="heroSeat">
                    <div className="heroCards" aria-label="Minhas cartas (hero)">
                      {myCards.slice(0, 2).map((c, idx) => (
                        <Card
                          size="lg"
                          code={c}
                          key={`${c}-${idx}`}
                          className={idx === 0 ? "heroCard heroCard0" : "heroCard heroCard1"}
                        />
                      ))}
                    </div>

                    <div className="heroPlate">
                      <div className="heroPlateName">{s.user!.username}</div>
                      <div className="heroPlateStack">{formatChips(s.stack)}</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="pokerSeatName">{occupied ? s.user!.username : "vazio"}</div>
                    <div className="pokerSeatStack small">{formatChips(s.stack)}</div>
                  </>
                )}

                <div
                  className="row"
                  style={{
                    gap: 6,
                    marginTop: 6,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  {s.isDealer && <span className="badge">D</span>}
                  {s.isTurn && <span className="badge">vez</span>}
                  {(s as any).hasFolded && <span className="badge">fold</span>}
                  {(s as any).isAllIn && <span className="badge">ALL-IN</span>}
                </div>
              </div>

              {/* Bet chip stack */}
              {typeof s.bet === "number" && s.bet > 0 && (
                <div
                  key={`bet-${s.seatNo}-${s.bet}`}
                  className="pokerBetChip pokerBetChipPop"
                  style={{ transform: `translate(${x * 0.62}px, ${y * 0.62}px)` }}
                  aria-label={`Aposta do seat #${s.seatNo}`}
                >
                  <BetChipStack
                    amount={s.bet}
                    display={formatChips(s.bet)}
                    isAllIn={(s as any).isAllIn}
                    label={`Aposta do seat #${s.seatNo}`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
