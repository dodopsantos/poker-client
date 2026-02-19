"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "../../../src/components/RequireAuth";
import { getSocket } from "../../../src/lib/socket";
import type { TableEvent, TableState } from "../../../src/contracts/table";
import { apiFetch } from "../../../src/lib/api";
import { getToken, logout } from "../../../src/lib/auth";
import { PokerTableView } from "../../../src/components/PokerTableView";
import { ToastManager } from "../../../src/components/Toast";

function decodeJwt(token: string | null): any {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

type Action = "FOLD" | "CHECK" | "CALL" | "RAISE";

export default function TablePage() {
  return (
    <RequireAuth>
      <TableInner />
    </RequireAuth>
  );
}

function TableInner() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const socket = useMemo(() => getSocket(), []);
  const [state, setState] = useState<TableState | null>(null);

  // Toast system (replaces error/info)
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "error" | "info" | "success" }>>([]);

  const addToast = (message: string, type: "error" | "info" | "success" = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const [myCards, setMyCards] = useState<string[]>([]);
  const [showdownReveals, setShowdownReveals] = useState<Record<number, string[]>>({});
  const [payoutAnim, setPayoutAnim] = useState<
    | { id: string; pot: number; winners: Array<{ seatNo: number; userId: string; payout: number }> }
    | null
  >(null);
  const [raiseTo, setRaiseTo] = useState<number>(0);

  const me = useMemo(() => decodeJwt(getToken()) as { userId: string; username: string } | null, []);

  // sit modal
  const [buyIn, setBuyIn] = useState(1000);
  const [seatNo, setSeatNo] = useState<number | null>(null);
  const [sitOpen, setSitOpen] = useState(false);
  
  // rebuy modal
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState(0);
  
  // sit-out state
  const [isSittingOut, setIsSittingOut] = useState(false);

  useEffect(() => {
    function onState(s: TableState) {
      setState(s);
    }

    function onEvent(ev: TableEvent) {
      if (ev.type === "STATE_SNAPSHOT") setState((ev as any).state);

      if (ev.type === "HAND_STARTED") {
        addToast(`Nova mão iniciada: ${ev.round}`, "info");
        setShowdownReveals({});
      }

      if (ev.type === "SHOWDOWN_REVEAL") {
        const winners = ev.winners.map((w) => `#${w.seatNo} +${w.payout}`).join(", ");
        addToast(`Showdown! Pot ${ev.pot}. Winners: ${winners}`, "info");
        const m: Record<number, string[]> = {};
        for (const r of ev.reveal ?? []) m[r.seatNo] = r.cards ?? [];
        setShowdownReveals(m);

        setPayoutAnim({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          pot: ev.pot,
          winners: ev.winners ?? [],
        });
        window.setTimeout(() => setPayoutAnim(null), 5000);
      }

      if (ev.type === "HAND_ENDED") {
        if ((ev as any).winnerSeat != null) {
          addToast(`Mão finalizada. Vencedor: seat #${(ev as any).winnerSeat}`, "info");
        } else if ((ev as any).winners?.length) {
          const winners = (ev as any).winners.map((w: any) => `#${w.seatNo} +${w.payout}`).join(", ");
          addToast(`Mão finalizada. Winners: ${winners}`, "info");

          setPayoutAnim({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            pot: (ev as any).pot ?? 0,
            winners: (ev as any).winners ?? [],
          });
          window.setTimeout(() => setPayoutAnim(null), 5000);
        }
      }

      if (ev.type === "ERROR") {
        const code = (ev as any).code;
        const message = (ev as any).message;
        
        if (code === "RATE_LIMIT") {
          addToast("Muitas requisições. Aguarde um momento.", "error");
        } else {
          addToast(`${code}: ${message}`, "error");
        }
      }

      if (ev.type === "SIT_OUT_ACK") {
        setIsSittingOut((ev as any).isSittingOut);
        addToast((ev as any).isSittingOut ? "Você está em sit-out" : "Você voltou ao jogo", "info");
      }

      if (ev.type === "LEAVE_PENDING") {
        addToast((ev as any).message ?? "Você será removido ao fim da mão", "info");
      }
    }

    socket.emit("table:join", { tableId });
    socket.on("table:state", onState);
    socket.on("table:event", onEvent);
    socket.on("table:private_cards", (ev: any) => {
      if (ev?.tableId === tableId) setMyCards(ev.cards ?? []);
    });

    return () => {
      socket.off("table:state", onState);
      socket.off("table:event", onEvent);
      socket.off("table:private_cards");
    };
  }, [socket, tableId]);

  function mySeat() {
    if (!state || !me) return null;
    return state.seats.find((s) => s.user?.id === me.userId) ?? null;
  }

  // keep raiseTo inside valid range when hand changes
  useEffect(() => {
    if (!state) return;
    const ms = mySeat();
    if (!ms) return;
    if (!state.game.handId) return;

    const minTo = Math.max(0, (state.game.currentBet ?? 0) + (state.game.minRaise ?? 0));
    setRaiseTo((prev) => {
      const maxTo = (ms.bet ?? 0) + (ms.stack ?? 0);
      if (!prev || prev < minTo || prev > maxTo) return Math.min(minTo, maxTo);
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.game.handId, state?.game.currentBet, state?.game.minRaise]);

  function act(action: Action, amount?: number) {
    if (Boolean((state?.game as any)?.isDealingBoard)) {
      addToast("Aguarde: o dealer está distribuindo as cartas do board.", "error");
      return;
    }
    socket.emit("table:action", { tableId, action, amount }, (ack: any) => {
      if (!ack?.ok) {
        addToast(`${ack?.error?.code ?? "ACTION_FAILED"}: ${ack?.error?.message ?? "Falha ao executar ação."}`, "error");
      }
    });
  }

  async function wallet() {
    try {
      const data = await apiFetch<{ balance: number }>("/wallet", { method: "GET" });
      addToast(`Saldo: ${data.balance}`, "info");
    } catch (e: any) {
      addToast(e.message ?? "Falha ao buscar wallet.", "error");
    }
  }

  async function leave() {
    socket.emit("table:leave", { tableId });
  }

  async function sit() {
    if (seatNo == null) {
      addToast("Selecione um assento vazio para sentar.", "error");
      return;
    }

    // Validate buy-in range (20x-100x BB)
    if (state) {
      const minBuyIn = state.table.bigBlind * 20;
      const maxBuyIn = state.table.bigBlind * 100;

      if (buyIn < minBuyIn) {
        addToast(`Buy-in mínimo: ${minBuyIn}`, "error");
        return;
      }

      if (buyIn > maxBuyIn) {
        addToast(`Buy-in máximo: ${maxBuyIn}`, "error");
        return;
      }
    }

    socket.emit("table:sit", { tableId, seatNo: Number(seatNo), buyInAmount: Number(buyIn) });
    setSitOpen(false);
  }

  async function rebuy() {
    if (!state) return;
    
    const minRebuy = state.table.bigBlind;
    const maxStack = state.table.bigBlind * 100;
    const currentStack = ms?.stack ?? 0;
    
    if (rebuyAmount < minRebuy) {
      addToast(`Rebuy mínimo: ${minRebuy}`, "error");
      return;
    }
    
    if (currentStack + rebuyAmount > maxStack) {
      addToast(`Stack não pode exceder ${maxStack} (atual: ${currentStack})`, "error");
      return;
    }
    
    socket.emit("table:rebuy", { tableId, amount: rebuyAmount }, (ack: any) => {
      if (ack?.ok) {
        addToast(`Rebuy de ${rebuyAmount} realizado!`, "success");
        setRebuyOpen(false);
        setRebuyAmount(0);
      } else {
        addToast(ack?.error?.message ?? "Erro no rebuy", "error");
      }
    });
  }

  function toggleSitOut() {
    const event = isSittingOut ? "table:sit_in" : "table:sit_out";
    socket.emit(event, { tableId });
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  // derived values for action overlay
  const ms = state ? mySeat() : null;
  const inHand = Boolean(state?.game.handId);
  const myTurn = Boolean(ms?.isTurn);
  const turnSeat = state ? state.seats.find((s) => s.isTurn)?.seatNo ?? null : null;
  const isDealingBoard = Boolean((state?.game as any)?.isDealingBoard);

  const toCall = state && ms ? Math.max(0, (state.game.currentBet ?? 0) - (ms.bet ?? 0)) : 0;
  const canCheck = toCall === 0;

  const stack = ms ? (ms.stack ?? 0) : 0;
  const maxRaiseTo = ms ? ((ms.bet ?? 0) + stack) : 0;
  const minTo = state ? Math.max(0, (state.game.currentBet ?? 0) + (state.game.minRaise ?? 0)) : 0;
  const step = state ? Math.max(1, state.table.bigBlind ?? 1) : 1;

  const clampedRaiseTo =
    ms && state
      ? maxRaiseTo > 0
        ? Math.min(Math.max(raiseTo || minTo, minTo), maxRaiseTo)
        : 0
      : 0;

  const allInIsCall = toCall >= stack;
  const allInLabel = allInIsCall ? `All-in (Call ${stack})` : `All-in (Raise to ${maxRaiseTo})`;

  return (
    <div className="tablePage">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="grid" style={{ gap: 4 }}>
            <h2 style={{ margin: 0 }}>Mesa</h2>
            <div className="small">
              ID: <code>{tableId}</code>
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={wallet}>
              Ver wallet
            </button>
            {ms && !inHand && (
              <button className="btn" onClick={() => setRebuyOpen(true)}>
                Rebuy
              </button>
            )}
            {ms && inHand && (
              <button className="btn" onClick={toggleSitOut}>
                {isSittingOut ? "Sit In" : "Sit Out"}
              </button>
            )}
            <button className="btn" onClick={handleLogout}>
              Sair
            </button>
            <button className="btn" onClick={() => router.push("/lobby")}>
              Lobby
            </button>
          </div>
        </div>
      </div>

      {!state ? (
        <div className="card">Carregando estado da mesa...</div>
      ) : (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{state.table.name}</strong>
                <div className="small">
                  Blinds: {state.table.smallBlind}/{state.table.bigBlind} • Max: {state.table.maxPlayers} •{" "}
                  <span className="badge">{state.table.status}</span>
                </div>
              </div>
              <div className="row">
                <button className="btn" onClick={leave}>
                  Deixar mesa (cashout)
                </button>
              </div>
            </div>
          </div>

          <div className="tableStageCard card">
            <PokerTableView
              state={state}
              mySeatNo={ms?.seatNo ?? null}
              myCards={myCards}
              showdownReveals={showdownReveals}
              payoutAnim={payoutAnim}
              canSit={!ms}
              onEmptySeatClick={(sn) => {
                if (ms) {
                  addToast(`Você já está sentado no seat #${ms.seatNo}.`, "info");
                  return;
                }
                setSeatNo(sn);
                setSitOpen(true);
              }}
            />
          </div>

          {sitOpen && (
            <div className="modalOverlay" role="dialog" aria-modal="true" onClick={() => setSitOpen(false)}>
              <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>Sentar na mesa</strong>
                  <button className="btn" onClick={() => setSitOpen(false)}>
                    X
                  </button>
                </div>
                <div className="small" style={{ opacity: 0.9 }}>
                  Assento selecionado: <code>#{seatNo ?? "-"}</code>
                </div>
                {state && (
                  <div className="small" style={{ opacity: 0.8, marginTop: 4 }}>
                    Min: {state.table.bigBlind * 20} • Max: {state.table.bigBlind * 100}
                  </div>
                )}
                <div className="hr" />
                <label className="small">Buy-in</label>
                <input className="input" type="number" min={1} value={buyIn} onChange={(e) => setBuyIn(Number(e.target.value))} />
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => setSitOpen(false)}>
                    Cancelar
                  </button>
                  <button className="btn btnPrimary" onClick={sit}>
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}

          {rebuyOpen && (
            <div className="modalOverlay" role="dialog" aria-modal="true" onClick={() => setRebuyOpen(false)}>
              <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>Rebuy</strong>
                  <button className="btn" onClick={() => setRebuyOpen(false)}>
                    X
                  </button>
                </div>
                <div className="small" style={{ opacity: 0.9 }}>
                  Stack atual: <code>{ms?.stack ?? 0}</code>
                </div>
                {state && (
                  <div className="small" style={{ opacity: 0.8, marginTop: 4 }}>
                    Máximo total: {state.table.bigBlind * 100}
                  </div>
                )}
                <div className="hr" />
                <label className="small">Valor do rebuy</label>
                <input
                  className="input"
                  type="number"
                  min={state?.table.bigBlind ?? 1}
                  value={rebuyAmount}
                  onChange={(e) => setRebuyAmount(Number(e.target.value))}
                />
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => setRebuyOpen(false)}>
                    Cancelar
                  </button>
                  <button className="btn btnPrimary" onClick={rebuy}>
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Debug/Details (optional) */}
          <details className="card" style={{ opacity: 0.95 }}>
            <summary style={{ cursor: "pointer" }}>
              <strong>Detalhes</strong> <span className="small">(assentos + game)</span>
            </summary>
            <div className="hr" />
            <div className="grid" style={{ gap: 10 }}>
              <div>
                <strong>Assentos</strong>
                <div className="grid" style={{ gap: 8, marginTop: 10 }}>
                  {state.seats.map((s) => (
                    <div key={s.seatNo} className="row" style={{ justifyContent: "space-between" }}>
                      <div className="row">
                        <span className="badge">#{s.seatNo}</span>
                        <span>{s.user ? s.user.username : "vazio"}</span>
                        <span className="small">({s.state})</span>
                        {(s as any).isSittingOut && <span className="small" style={{ color: "orange" }}>[SIT-OUT]</span>}
                      </div>
                      <div className="row">
                        <span className="small">stack: {s.stack}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <strong>Game</strong>
                <div className="hr" />
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(state.game, null, 2)}</pre>
              </div>
            </div>
          </details>

          {/* WAITING HUD */}
          {ms && inHand && (!myTurn || isDealingBoard) && (
            <div className="turnToast small">
              {isDealingBoard ? (
                <>Dealer distribuindo o board…</>
              ) : (
                <>
                  Aguardando a vez do seat <code>{turnSeat ?? "-"}</code>…
                  {isSittingOut && <span style={{ color: "orange", marginLeft: 8 }}>(você está em sit-out)</span>}
                </>
              )}
            </div>
          )}

          {/* ACTION OVERLAY (PokerStars-style) */}
          {ms && inHand && myTurn && !isDealingBoard && (
            <div className="actionOverlay" role="region" aria-label="Ações da sua vez">
              <div className="actionHeader">
                <div className="small">
                  Sua vez • Seat <code>#{ms.seatNo}</code> • To call: <code>{toCall}</code> • Stack: <code>{stack}</code>
                </div>
                <div className="small" style={{ opacity: 0.85 }}>
                  Min: <code>{minTo}</code> • Max: <code>{maxRaiseTo}</code>
                </div>
              </div>

              <div className="actionRow">
                <button className="btn actionBtnDanger" onClick={() => act("FOLD")}>
                  Fold
                </button>

                <button className="btn" disabled={!canCheck} onClick={() => act("CHECK")}>
                  Check
                </button>

                <button className="btn" onClick={() => act("CALL")}>
                  {toCall === 0 ? "Call (0)" : `Call (${toCall})`}
                </button>

                <button
                  className="btn btnPrimary"
                  disabled={stack <= 0}
                  onClick={() => (allInIsCall ? act("CALL") : act("RAISE", maxRaiseTo))}
                  title={allInIsCall ? "Vai all-in pagando o call (se não tiver stack suficiente, paga parcial)." : "Vai all-in dando raise com todo o stack."}
                >
                  {allInLabel}
                </button>
              </div>

              <div className="actionRaise">
                <div className="actionRaiseTop">
                  <div className="small">
                    Raise to: <code>{clampedRaiseTo || "-"}</code>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn" onClick={() => setRaiseTo(minTo)} title="Menor raise permitido (currentBet + minRaise).">
                      Mín
                    </button>
                    <button
                      className="btn"
                      onClick={() => {
                        const potish = Math.max(0, (state.game.currentBet ?? 0) + (state.game.pot?.total ?? 0));
                        setRaiseTo(Math.min(potish, maxRaiseTo));
                      }}
                      title="Sugestão rápida: currentBet + pot (aproximação)."
                    >
                      Pote
                    </button>
                    <button className="btn" disabled={stack <= 0} onClick={() => setRaiseTo(maxRaiseTo)} title="Preenche com seu All-in.">
                      Máx
                    </button>
                  </div>
                </div>

                <input
                  className="range"
                  type="range"
                  min={minTo}
                  max={Math.max(minTo, maxRaiseTo)}
                  step={step}
                  value={clampedRaiseTo}
                  onChange={(e) => setRaiseTo(Number(e.target.value))}
                  disabled={maxRaiseTo <= 0 || minTo >= maxRaiseTo}
                />

                <div className="actionRaiseBottom">
                  <span className="small">
                    <span style={{ opacity: 0.8 }}>min</span>: <code>{minTo}</code>
                  </span>
                  <span className="small">
                    <span style={{ opacity: 0.8 }}>max</span>: <code>{maxRaiseTo}</code>
                  </span>

                  <button
                    className="btn btnPrimary"
                    disabled={!clampedRaiseTo || clampedRaiseTo < minTo || clampedRaiseTo > maxRaiseTo || clampedRaiseTo === (state.game.currentBet ?? 0)}
                    onClick={() => act("RAISE", clampedRaiseTo)}
                  >
                    Aumentar para {clampedRaiseTo}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <ToastManager toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
