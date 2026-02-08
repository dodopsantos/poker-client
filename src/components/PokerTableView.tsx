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
  /** Optional showdown reveal map: seatNo -> [card1, card2] */
  showdownReveals?: Record<number, string[]> | null;
  /** Pot -> winner chip transfer animation trigger */
  payoutAnim?: { id: string; pot: number; winners: Array<{ seatNo: number; userId: string; payout: number }> } | null;
};

// UI-only timer (server authoritative logic can add real deadlines later).
const TURN_TIMER_MS = 15_000;
// Optional: small beeps in the last 3 seconds of the hero's turn.
const ENABLE_TURN_BEEP = true;

function formatChips(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${Math.floor(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}k`;
  return `${n}`;
}


type DerivedPot = { amount: number; eligibleSeats: number[] };

/** Derive main + side pots from committed chips (frontend-only visualization). */
function deriveSidePots(seats: Array<any>): DerivedPot[] {
  const all = seats
    .filter((s) => typeof s.seatNo === "number")
    .map((s) => ({
      seatNo: s.seatNo as number,
      committed: Math.max(0, Math.floor(Number((s as any).committed ?? 0) || 0)),
      hasFolded: Boolean((s as any).hasFolded),
      occupied: Boolean(s.user),
    }))
    .filter((s) => s.occupied);

  const contribBySeat = new Map<number, number>();
  for (const p of all) contribBySeat.set(p.seatNo, p.committed);

  const levels = Array.from(new Set(all.map((p) => p.committed).filter((v) => v > 0))).sort((a, b) => a - b);
  let prev = 0;
  const pots: DerivedPot[] = [];

  for (const lvl of levels) {
    const participants = all.filter((p) => (contribBySeat.get(p.seatNo) ?? 0) >= lvl);
    const amount = (lvl - prev) * participants.length;
    const eligibleSeats = participants.filter((p) => !p.hasFolded).map((p) => p.seatNo);
    if (amount > 0) pots.push({ amount, eligibleSeats });
    prev = lvl;
  }

  return pots;
}

type SeatAnchor = { x: number; y: number };

// Fine-tuned PokerStars-like fixed layout (6-max).
// Coordinates are percentages of the table overlay box.
const SEAT_MAP_6MAX: Record<number, SeatAnchor> = {
  1: { x: 50, y: 88 }, // HERO (bottom center)
  2: { x: 18, y: 72 }, // bottom-left
  3: { x: 12, y: 32 }, // top-left
  4: { x: 50, y: 10 }, // top center
  5: { x: 88, y: 32 }, // top-right
  6: { x: 82, y: 72 }, // bottom-right
};

function rotateSeatIndex(serverSeatNo: number, heroSeatNo: number, maxSeats: number) {
  // Map hero's server seat to visual seat 1.
  // visual = ((server - hero + max) % max) + 1
  return ((serverSeatNo - heroSeatNo + maxSeats) % maxSeats) + 1;
}

function seatSizeClassByVisualSeat(visualSeatNo: number) {
  if (visualSeatNo === 1) return "pokerSeatSizeHero";
  if (visualSeatNo === 4) return "pokerSeatSizeTop";
  if (visualSeatNo === 3 || visualSeatNo === 5) return "pokerSeatSizeCorner";
  return "pokerSeatSizeBottom";
}

/**
 * Move bet chips from table center towards the acting seat (PokerStars-like).
 * We start at center (CSS: left/top 50/50) and translate in the direction of the seat,
 * but only partially (so chips sit between seat and pot).
 */
function betOffsetFromAnchor(anchor: SeatAnchor) {
  // Vector from center to seat (in %)
  const dxPct = anchor.x - 50;
  const dyPct = anchor.y - 50;

  // How far from center to move (0..1). Smaller = closer to pot.
  const T = 0.55;
  // Convert "%" deltas to px-ish values. Tune per your design.
  const PX = 5.5;

  let x = dxPct * T * PX;
  let y = dyPct * T * PX;

  // Clamp so chips never go too far into the seats
  const CLAMP = 160;
  x = Math.max(-CLAMP, Math.min(CLAMP, x));
  y = Math.max(-CLAMP, Math.min(CLAMP, y));

  return { x, y };
}

export function PokerTableView({
  state,
  mySeatNo = null,
  myCards = [],
  onEmptySeatClick,
  canSit = true,
  showdownReveals = null,
  payoutAnim = null,
}: Props) {
  const totalSeats = state.table.maxPlayers;
  const tableRef = useRef<HTMLDivElement | null>(null);

  // --- Chip flight animations (seat -> pot, pot -> winner) ---
  const [overlayRect, setOverlayRect] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setOverlayRect({ w: r.width, h: r.height });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  type FlyChip = {
    id: string;
    fromX: number;
    fromY: number;
    dx: number;
    dy: number;
    amount: number;
    label: string;
    kind: "toPot" | "toWinner";
  };
  const [flyChips, setFlyChips] = useState<FlyChip[]>([]);
  const prevBetsRef = useRef<Record<number, number>>({});
  // Snapshot of seats used for payout animations so we don't re-trigger on every state tick.
  const payoutSnapshotRef = useRef<{ seats: any[]; pot: number } | null>(null);

  const pctToPx = (p: SeatAnchor) => {
    const w = overlayRect?.w ?? 0;
    const h = overlayRect?.h ?? 0;
    return { x: (p.x / 100) * w, y: (p.y / 100) * h };
  };

  const spawnFlyChip = (from: SeatAnchor, to: SeatAnchor, amount: number, label: string, kind: FlyChip["kind"]) => {
    if (!overlayRect) return;
    const a = pctToPx(from);
    const b = pctToPx(to);
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: FlyChip = {
      id,
      fromX: a.x,
      fromY: a.y,
      dx: b.x - a.x,
      dy: b.y - a.y,
      amount,
      label,
      kind,
    };
    setFlyChips((prev) => [...prev, item]);
    window.setTimeout(() => {
      setFlyChips((prev) => prev.filter((x) => x.id !== id));
    }, 900);
  };

  const isSitting = mySeatNo != null;

  const turnSeatNo = useMemo(
    () => state.seats.find((x) => x.isTurn)?.seatNo ?? null,
    [state.seats]
  );

  // Key changes whenever the turn changes (or a new snapshot arrives), restarting CSS animations.
  const turnAnimKey = useMemo(
    () => `${state.game.handId ?? "nohand"}:${turnSeatNo ?? "none"}:${state.updatedAt}`,
    [state.game.handId, turnSeatNo, state.updatedAt]
  );

  // Server-authoritative remaining time (ms). Falls back to a UI-only constant.
  const turnRemainingMs = useMemo(() => {
    const endsAt = (state.game as any).turnEndsAt as number | null | undefined;
    if (typeof endsAt === "number" && Number.isFinite(endsAt)) {
      return Math.max(0, endsAt - Date.now());
    }
    return TURN_TIMER_MS;
  }, [state.game, state.updatedAt]);

  // Hero countdown bar (visual). Updates while it's the hero's turn.
  const isHeroTurn = mySeatNo != null && turnSeatNo === mySeatNo;
  const [heroTurnPct, setHeroTurnPct] = useState(1); // 1 -> 0
  const [heroTurnColor, setHeroTurnColor] = useState("rgba(34,197,94,0.90)");
  const [heroTurnBg, setHeroTurnBg] = useState("rgba(34,197,94,0.16)");
  // Bitmask of seconds we've already beeped for (3,2,1) so we don't repeat.
  const heroBeepMaskRef = useRef(0);

  const beep = () => {
    if (!ENABLE_TURN_BEEP) return;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880; // subtle but noticeable
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.12);
      o.onended = () => {
        try { ctx.close(); } catch { }
      };
    } catch {
      // Ignore audio errors (autoplay restrictions, etc.)
    }
  };

  useEffect(() => {
    if (!isHeroTurn) {
      setHeroTurnPct(1);
      setHeroTurnColor("rgba(34,197,94,0.90)");
      setHeroTurnBg("rgba(34,197,94,0.16)");
      heroBeepMaskRef.current = 0;
      return;
    }

    const endsAt = (state.game as any).turnEndsAt as number | null | undefined;
    const startAt = Date.now();
    const endAt = typeof endsAt === "number" && Number.isFinite(endsAt) ? endsAt : startAt + TURN_TIMER_MS;
    const duration = Math.max(1, endAt - startAt);

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, endAt - now);
      const pct = remaining / duration;
      setHeroTurnPct(pct);

      // Beep at 3s, 2s, 1s remaining.
      if (ENABLE_TURN_BEEP) {
        const sec = Math.ceil(remaining / 1000);
        // mask bits: 3->4, 2->2, 1->1
        const bit = sec === 3 ? 4 : sec === 2 ? 2 : sec === 1 ? 1 : 0;
        if (bit && (heroBeepMaskRef.current & bit) === 0) {
          heroBeepMaskRef.current |= bit;
          beep();
        }
      }

      // Color thresholds (PokerStars-like urgency)
      if (pct > 0.5) {
        setHeroTurnColor("rgba(34,197,94,0.90)");
        setHeroTurnBg("rgba(34,197,94,0.16)");
      } else if (pct > 0.2) {
        setHeroTurnColor("rgba(234,179,8,0.95)");
        setHeroTurnBg("rgba(234,179,8,0.18)");
      } else {
        setHeroTurnColor("rgba(239,68,68,0.95)");
        setHeroTurnBg("rgba(239,68,68,0.18)");
      }
    };

    tick();
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [isHeroTurn, (state.game as any).turnEndsAt, state.updatedAt, turnAnimKey]);

  // Keep the current user always at the bottom (PokerStars behavior).
  const heroSeat = mySeatNo ?? 1;

  const getVisualSeatNo = (serverSeatNo: number) => {
    if (totalSeats !== 6) return serverSeatNo;
    return rotateSeatIndex(serverSeatNo, heroSeat, totalSeats);
  };

  const getSeatAnchor = (serverSeatNo: number): SeatAnchor => {
    const visualSeatNo = getVisualSeatNo(serverSeatNo);
    if (totalSeats === 6 && SEAT_MAP_6MAX[visualSeatNo]) return SEAT_MAP_6MAX[visualSeatNo];
    return { x: 50, y: 50 };
  };

  // Pot visual anchor (roughly the center of the board area)
  const POT_ANCHOR: SeatAnchor = { x: 50, y: 40 };

  const derivedPots = useMemo(() => deriveSidePots(state.seats), [state.seats]);

  // Seat -> pot: whenever a player's displayed bet increases, animate chips flying to the pot.
  useEffect(() => {
    if (!overlayRect) return;

    const prev = prevBetsRef.current;
    const next: Record<number, number> = { ...prev };

    for (const s of state.seats) {
      const cur = Number((s as any).bet ?? 0) || 0;
      const was = Number(prev[s.seatNo] ?? 0) || 0;

      if (cur > was && cur > 0) {
        const delta = cur - was;
        spawnFlyChip(
          getSeatAnchor(s.seatNo),
          POT_ANCHOR,
          delta,
          `Bet seat #${s.seatNo}`,
          "toPot"
        );
      }

      next[s.seatNo] = cur;
    }

    prevBetsRef.current = next;
  }, [state.seats, overlayRect]);

  // Pot gather -> winner: first gather chips into the pot, then pay out to winner(s).
  // IMPORTANT: run only once per payout event (payoutAnim.id), not on every state tick.
  useEffect(() => {
    if (!overlayRect) return;
    if (!payoutAnim?.id) return;

    const winners = payoutAnim.winners ?? [];
    if (!winners.length) return;

    // Freeze a snapshot of seats/pot for this payout so later snapshots don't restart the animation.
    payoutSnapshotRef.current = {
      seats: state.seats.map((s) => ({ ...s })),
      pot: Number(payoutAnim.pot ?? 0) || 0,
    };

    const snap = payoutSnapshotRef.current;
    const pot = snap.pot;

    // 1) Gather: animate chips from contributors into the pot.
    // Use committed first (more stable). If committed is 0 but bet exists, use bet.
    const rawContrib = (snap.seats ?? [])
      .map((s: any) => {
        const committed = Number(s.committed ?? 0) || 0;
        const bet = Number(s.bet ?? 0) || 0;
        const amount = committed > 0 ? committed : bet;
        return { seatNo: s.seatNo, amount: Math.max(0, amount) };
      })
      .filter((x: any) => x.amount > 0);

    const sum = rawContrib.reduce((acc: number, x: any) => acc + x.amount, 0);
    const scale = pot > 0 && sum > 0 ? Math.min(1, pot / sum) : 1;

    const contributors = rawContrib
      .map((c: any) => ({ ...c, amount: Math.max(1, Math.floor(c.amount * scale)) }))
      .slice(0, 12);

    const GATHER_STAGGER_MS = 70;
    const GATHER_TAIL_MS = 520;
    const SETTLE_MS = 280;

    const timers: number[] = [];

    contributors.forEach((c: any, i: number) => {
      const tt = window.setTimeout(() => {
        spawnFlyChip(
          getSeatAnchor(c.seatNo),
          POT_ANCHOR,
          c.amount,
          `Gather seat #${c.seatNo}`,
          "toPot"
        );
      }, 120 + i * GATHER_STAGGER_MS);
      timers.push(tt);
    });

    // 2) Payout: after gather finishes + settle, fly chips from pot to winner(s).
    const payoutDelay = 120 + contributors.length * GATHER_STAGGER_MS + GATHER_TAIL_MS + SETTLE_MS;
    const t2 = window.setTimeout(() => {
      for (const w of winners) {
        const amt = Number((w as any).payout ?? 0) || 0;
        if (amt <= 0) continue;

        spawnFlyChip(
          POT_ANCHOR,
          getSeatAnchor(w.seatNo),
          amt,
          `Payout seat #${w.seatNo}`,
          "toWinner"
        );
      }
    }, payoutDelay);
    timers.push(t2);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [payoutAnim?.id, overlayRect]);

  return (
    <div className="pokerStage">
      <div className="pokerTableWrap" ref={tableRef}>
        {/* FELT / CLIPPED TABLE */}
        <div className="pokerTable">
          <div className="pokerFelt" />
        </div>

        {/* OVERLAY (NOT CLIPPED) */}
        <div className="pokerOverlay">
          {/* Center: pot + board */}
          <div className="pokerCenter">
            <div className="pokerPot">
              <div className="small">Pote</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{formatChips(state.game.pot.total)}</div>
            </div>

            {derivedPots.length > 1 && (
              <div className="pokerPotsRow" aria-label="Potes (main + side pots)">
                {derivedPots.map((p, idx) => (
                  <div className="pokerPotItem" key={`pot-${idx}-${p.amount}`}>
                    <div className="pokerPotLabel">{idx === 0 ? "Main" : `Side ${idx}`}</div>
                    <BetChipStack amount={p.amount} display={formatChips(p.amount)} label={`Pot ${idx === 0 ? "Main" : `Side ${idx}`}`} />
                  </div>
                ))}
              </div>
            )}

            <div className="pokerBoard">
              {state.game.board.length === 0 ? (
                <div className="pokerBoardEmpty small">Board (placeholder)</div>
              ) : (
                state.game.board.map((c, idx) => <Card size="lg" code={c} key={`${c}-${idx}`} />)
              )}
            </div>
          </div>

          {/* Chip flight animations (not part of state; UI-only) */}
          {flyChips.map((c) => (
            <div
              key={c.id}
              className={`pokerFlyChip ${c.kind}`}
              style={
                {
                  left: `${c.fromX}px`,
                  top: `${c.fromY}px`,
                  "--dx": `${c.dx}px`,
                  "--dy": `${c.dy}px`,
                } as any
              }
              aria-hidden="true"
            >
              <div className="pokerFlyChipInner">
                <BetChipStack amount={c.amount} display={formatChips(c.amount)} label={c.label} />
              </div>
            </div>
          ))}

          {/* Seats */}
          {state.seats.map((s) => {
            const visualSeatNo = getVisualSeatNo(s.seatNo);
            const anchor =
              totalSeats === 6 && SEAT_MAP_6MAX[visualSeatNo]
                ? SEAT_MAP_6MAX[visualSeatNo]
                : { x: 50, y: 50 };

            const occupied = Boolean(s.user);
            const canClickSeat = !occupied && Boolean(onEmptySeatClick) && canSit && !isSitting;
            const seatSizeClass = totalSeats === 6 ? seatSizeClassByVisualSeat(visualSeatNo) : "";

            const { x: betX, y: betY } = betOffsetFromAnchor(anchor);

            return (
              <React.Fragment key={s.seatNo}>
                <div
                  className={[
                    "pokerSeat",
                    seatSizeClass,
                    occupied ? "pokerSeatOccupied" : "pokerSeatEmpty",
                    s.isTurn && mySeatNo !== s.seatNo ? "pokerSeatTurn" : "",
                    (s as any).hasFolded ? "pokerSeatFolded" : "",
                  ].join(" ")}
                  style={{
                    left: `${anchor.x}%`,
                    top: `${anchor.y}%`,
                    cursor:
                      !occupied && onEmptySeatClick
                        ? canClickSeat
                          ? "pointer"
                          : "not-allowed"
                        : "default",
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

                  {/* Turn ring for villains only (hero uses the green bar countdown) */}
                  {s.isTurn && mySeatNo !== s.seatNo && (
                    <div
                      key={turnAnimKey}
                      className="turnTimer"
                      style={{ animationDuration: `${turnRemainingMs}ms` } as any}
                      aria-hidden="true"
                    />
                  )}

                  {/* HERO */}
                  {mySeatNo === s.seatNo && occupied ? (
                    <div className="heroSeat">
                      <div className="heroCards" aria-label="Minhas cartas (hero)">
                        {(myCards?.length ?? 0) >= 2 ? (
                          myCards.slice(0, 2).map((c, idx) => (
                            <Card
                              size="lg"
                              code={c}
                              key={`${c}-${idx}`}
                              className={idx === 0 ? "heroCard heroCard0" : "heroCard heroCard1"}
                            />
                          ))
                        ) : (
                          [0, 1].map((idx) => (
                            <Card
                              size="lg"
                              faceDown
                              key={`hero-back-${idx}`}
                              className={idx === 0 ? "heroCard heroCard0" : "heroCard heroCard1"}
                            />
                          ))
                        )}
                      </div>

                      <div
                        key={s.isTurn ? turnAnimKey : "heroPlate"}
                        className="heroPlate"
                        data-turn={s.isTurn ? "true" : "false"}
                        data-urgency={
                          s.isTurn
                            ? heroTurnPct > 0.5
                              ? "green"
                              : heroTurnPct > 0.2
                                ? "yellow"
                                : "red"
                            : "none"
                        }
                        style={
                          {
                            "--turnPct": `${Math.round(heroTurnPct * 100)}%`,
                            "--turnColor": heroTurnColor,
                            "--turnBg": heroTurnBg,
                          } as any
                        }
                      >
                        {s.isDealer && (
                          <div className="seatDealerButton" title="Dealer" aria-label="Dealer">
                            D
                          </div>
                        )}
                        <div className="heroPlateName">{s.user!.username}</div>
                        <div className="heroPlateStack">{formatChips(s.stack)}</div>
                        <div className="seatPillRightIcon heroRightIcon" aria-hidden="true">
                          ★
                        </div>

                        {(() => {
                          const committed = Number((s as any).committed ?? 0) || 0;
                          const total = Math.max(1, (Number(s.stack) || 0) + committed);
                          const pct = Math.max(0, Math.min(1, (Number(s.stack) || 0) / total));
                          const displayPct = s.isTurn ? heroTurnPct : pct;
                          return (
                            <div
                              className="heroStackBar"
                              style={
                                s.isTurn
                                  ? ({ background: "var(--turnBg)" } as any)
                                  : undefined
                              }
                            >
                              <div
                                className="heroStackBarFill"
                                style={
                                  s.isTurn
                                    ? ({
                                      width: `${Math.round(displayPct * 100)}%`,
                                      background: "var(--turnColor)",
                                    } as any)
                                    : ({ width: `${Math.round(displayPct * 100)}%` } as any)
                                }
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Villain cards (face down until showdown; reveal on SHOWDOWN_REVEAL) */}
                      {occupied && state.game.handId && !(s as any).hasFolded && mySeatNo !== s.seatNo && (
                        <div className="villainCards" aria-label={`Cartas do seat #${s.seatNo}`}>
                          {(() => {
                            const revealed = showdownReveals?.[s.seatNo] ?? null;
                            if (revealed && revealed.length >= 2) {
                              return (
                                <>
                                  <Card size="sm" code={revealed[0]} />
                                  <Card size="sm" code={revealed[1]} />
                                </>
                              );
                            }
                            return (
                              <>
                                <Card size="sm" faceDown />
                                <Card size="sm" faceDown />
                              </>
                            );
                          })()}
                        </div>
                      )}

                      <div className={`seatPill ${occupied ? "" : "seatPillEmpty"}`}>
                        {occupied && s.isDealer && (
                          <div className="seatDealerButton" title="Dealer" aria-label="Dealer">
                            D
                          </div>
                        )}

                        <div className="seatPillInner">
                          {occupied ? (
                            <>
                              <div className="seatPillName" title={s.user!.username}>
                                {s.user!.username}
                              </div>
                              <div className="seatPillStack">{formatChips(s.stack)}</div>
                            </>
                          ) : (
                            <>
                              <div className="seatPillName">Lugar</div>
                              <div className="seatPillStack">Vazio</div>
                            </>
                          )}
                        </div>

                        {occupied && (
                          <div className="seatPillRightIcon" aria-hidden="true">
                            ★
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Bet chip stack (pulled towards seat from the center) */}
                {typeof (s as any).bet === "number" && (s as any).bet > 0 && (
                  <div
                    key={`bet-${s.seatNo}-${(s as any).bet}`}
                    className="pokerBetChip pokerBetChipPop"
                    style={{ transform: `translate(${betX}px, ${betY}px)` }}
                    aria-label={`Aposta do seat #${s.seatNo}`}
                  >
                    <BetChipStack
                      amount={(s as any).bet}
                      display={formatChips((s as any).bet)}
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
    </div>
  );
}
