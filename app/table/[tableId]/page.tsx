"use client";
import { Chat } from "../../../src/components/Chat";

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

type AutoAction = "CHECK_FOLD" | "FOLD" | "CALL_ANY" | null;

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
  const [autoAction, setAutoAction] = useState<AutoAction>(null);

  const me = useMemo(() => decodeJwt(getToken()) as { userId: string; username: string } | null, []);

  const [buyIn, setBuyIn] = useState(1000);
  const [seatNo, setSeatNo] = useState<number | null>(null);
  const [sitOpen, setSitOpen] = useState(false);
  
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState(0);
  
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

  // Executa auto-actions quando virar a sua vez (PokerStars-like)
  useEffect(() => {
    if (!state || !me) return;
    const ms = state.seats.find((s) => s.user?.id === me.userId) ?? null;
    if (!ms) return;
    const inHand = Boolean(state.game.handId);
    const myTurn = inHand && Boolean(ms.isTurn);
    const isDealingBoard = Boolean((state.game as any)?.isDealingBoard);
    if (!myTurn || isDealingBoard) return;
    if (!autoAction) return;

    const currentBet = state.game.currentBet ?? 0;
    const myBet = ms.bet ?? 0;
    const toCall = Math.max(0, currentBet - myBet);
    const canCheck = toCall === 0;
    const stack = ms.stack ?? 0;

    // Nota: para segurança, só dispara ações que são válidas no momento.
    if (autoAction === "CHECK_FOLD") {
      if (canCheck) act("CHECK");
      else act("FOLD");
      setAutoAction(null);
      return;
    }
    if (autoAction === "FOLD") {
      act("FOLD");
      setAutoAction(null);
      return;
    }
    if (autoAction === "CALL_ANY") {
      if (canCheck) act("CHECK");
      else if (toCall > 0 && stack >= toCall) act("CALL");
      else act("FOLD");
      setAutoAction(null);
      return;
    }
  }, [autoAction, state, me]);

  function mySeat() {
    if (!state || !me) return null;
    return state.seats.find((s) => s.user?.id === me.userId) ?? null;
  }

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

  // Só exibe ações que fazem sentido no momento (ex.: se existe aposta, não mostra Check)
  const canCall = toCall > 0 && stack > 0;
  const callAmount = Math.min(toCall, stack);
  const canRaise =
    Boolean(state) &&
    stack > toCall &&
    maxRaiseTo > (state?.game.currentBet ?? 0) &&
    minTo > 0 &&
    minTo <= maxRaiseTo;

  const clampedRaiseTo =
    ms && state
      ? maxRaiseTo > 0
        ? Math.min(Math.max(raiseTo || minTo, minTo), maxRaiseTo)
        : 0
      : 0;

  return (
    <div className="table-page">
      {/* Header */}
      <div className="container">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0, marginBottom: "var(--space-2)" }}>{state?.table.name ?? "Carregando..."}</h2>
              {state && (
                <div className="text-sm text-secondary">
                  Blinds: <span className="mono">{state.table.smallBlind}/{state.table.bigBlind}</span> •{" "}
                  Max: {state.table.maxPlayers} •{" "}
                  <span className={`badge ${state.table.status === "RUNNING" ? "badge-success" : "badge-info"}`}>
                    {state.table.status}
                  </span>
                </div>
              )}
            </div>
            
            <div className="row gap-2">
              <button className="btn btn-sm" onClick={wallet}>
                💰 Wallet
              </button>
              {ms && !inHand && (
                <button className="btn btn-sm btn-success" onClick={() => setRebuyOpen(true)}>
                  + Rebuy
                </button>
              )}
              {ms && inHand && (
                <button className="btn btn-sm" onClick={toggleSitOut}>
                  {isSittingOut ? "▶️ Sit In" : "⏸️ Sit Out"}
                </button>
              )}
              {ms && (
                <button className="btn btn-sm btn-danger" onClick={leave}>
                  Sair da mesa
                </button>
              )}
              <button className="btn btn-sm" onClick={handleLogout}>
                🚪 Logout
              </button>
              <button className="btn btn-sm" onClick={() => router.push("/lobby")}>
                ← Lobby
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Poker Table */}
      {!state ? (
        <div className="container">
          <div className="card">
            <div className="loading" style={{ margin: "var(--space-10) auto" }} />
            <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "var(--space-4)" }}>
              Carregando mesa...
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ margin: "0 var(--space-4)", padding: "var(--space-3)" }}>
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
      )}

      {/* Modals */}
      {sitOpen && (
        <div className="modal-overlay" onClick={() => setSitOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0 }}>Sentar na mesa</h3>
              <button className="btn btn-sm" onClick={() => setSitOpen(false)}>✕</button>
            </div>
            
            <div className="text-sm text-muted mb-2">
              Assento selecionado: <span className="mono">#{seatNo ?? "-"}</span>
            </div>
            
            {state && (
              <div className="text-sm text-muted mb-3">
                Min: <span className="mono">{state.table.bigBlind * 20}</span> •{" "}
                Max: <span className="mono">{state.table.bigBlind * 100}</span>
              </div>
            )}
            
            <div className="hr" />
            
            <label className="label">Buy-in</label>
            <input 
              className="input" 
              type="number" 
              min={1} 
              value={buyIn} 
              onChange={(e) => setBuyIn(Number(e.target.value))} 
            />
            
            <div className="row gap-2" style={{ justifyContent: "flex-end", marginTop: "var(--space-4)" }}>
              <button className="btn" onClick={() => setSitOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={sit}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {rebuyOpen && (
        <div className="modal-overlay" onClick={() => setRebuyOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0 }}>Rebuy</h3>
              <button className="btn btn-sm" onClick={() => setRebuyOpen(false)}>✕</button>
            </div>
            
            <div className="text-sm text-muted mb-2">
              Stack atual: <span className="mono">{ms?.stack ?? 0}</span>
            </div>
            
            {state && (
              <div className="text-sm text-muted mb-3">
                Máximo total: <span className="mono">{state.table.bigBlind * 100}</span>
              </div>
            )}
            
            <div className="hr" />
            
            <label className="label">Valor do rebuy</label>
            <input
              className="input"
              type="number"
              min={state?.table.bigBlind ?? 1}
              value={rebuyAmount}
              onChange={(e) => setRebuyAmount(Number(e.target.value))}
            />
            
            <div className="row gap-2" style={{ justifyContent: "flex-end", marginTop: "var(--space-4)" }}>
              <button className="btn" onClick={() => setRebuyOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={rebuy}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting Toast */}
      {ms && inHand && (!myTurn || isDealingBoard) && (
        <div className="waiting-toast">
          <div className="text-sm">
            {isDealingBoard ? (
              <>🎴 Dealer distribuindo o board...</>
            ) : (
              <>
                ⏳ Aguardando seat <span className="mono">#{turnSeat ?? "-"}</span>
                {isSittingOut && <span style={{ color: "var(--warning)", marginLeft: "var(--space-2)" }}>(sit-out)</span>}
              </>
            )}
          </div>
        </div>
      )}

      {/* HUD (Chat + Actions) */}
      {state && me && (
        <div className="table-hud">
          <div className="table-hud-inner">
            <div className="hud-left">
              <Chat socket={socket} tableId={tableId} myUserId={me.userId} variant="docked" />
            </div>

            <div className="hud-right">
              {/* Quando NÃO é sua vez: opções de auto-ação */}
              {ms && inHand && !myTurn && !isDealingBoard && (
                <div className="preaction-panel">
                  <div className="preaction-title">Pré-ação</div>
                  <div className="preaction-actions">
                    <button
                      className={"preaction-btn" + (autoAction === "CHECK_FOLD" ? " active" : "")}
                      onClick={() => setAutoAction(autoAction === "CHECK_FOLD" ? null : "CHECK_FOLD")}
                    >
                      Check/Fold
                    </button>
                    <button
                      className={"preaction-btn" + (autoAction === "CALL_ANY" ? " active" : "")}
                      onClick={() => setAutoAction(autoAction === "CALL_ANY" ? null : "CALL_ANY")}
                    >
                      Call any
                    </button>
                    <button
                      className={"preaction-btn" + (autoAction === "FOLD" ? " active" : "")}
                      onClick={() => setAutoAction(autoAction === "FOLD" ? null : "FOLD")}
                    >
                      Auto-fold
                    </button>
                  </div>
                  <div className="preaction-hint text-sm text-muted">
                    A ação escolhida será executada automaticamente quando for sua vez.
                  </div>
                </div>
              )}

              {/* Quando é sua vez: ações normais */}
              {ms && inHand && myTurn && !isDealingBoard && (
                <div className="action-panel">
                  <div className="action-header">
                    <div>
                      <div className="text-base">
                        <strong>Sua vez</strong> • Seat <span className="mono">#{ms.seatNo}</span>
                      </div>
                      <div className="text-sm text-muted mt-1">
                        To call: <span className="mono">{toCall}</span> • Stack: <span className="mono">{stack}</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted">
                      Min: <span className="mono">{minTo}</span> • Max: <span className="mono">{maxRaiseTo}</span>
                    </div>
                  </div>

                  <div className="action-buttons">
                    <button className="action-btn action-btn-fold" onClick={() => act("FOLD")}>
                      Fold
                    </button>

                    {canCheck && (
                      <button className="action-btn action-btn-check" onClick={() => act("CHECK")}>
                        Check
                      </button>
                    )}

                    {!canCheck && (
                      <button className="action-btn action-btn-call" disabled={!canCall} onClick={() => act("CALL")}>
                        {toCall > stack ? `Call ${callAmount} (All-in)` : `Call ${toCall}`}
                      </button>
                    )}

                    {/* All-in só aparece quando for um raise (evita duplicar com Call all-in) */}
                    {canRaise && (
                      <button className="action-btn action-btn-raise" onClick={() => act("RAISE", maxRaiseTo)}>
                        All-in ({maxRaiseTo})
                      </button>
                    )}
                  </div>

                  {canRaise && (
                    <div className="action-slider-section">
                      <div className="action-slider-header">
                        <div className="text-sm">
                          Raise para: <span className="mono" style={{ color: "var(--accent-blue)" }}>{clampedRaiseTo || "-"}</span>
                        </div>
                        <div className="action-slider-presets">
                          <button className="btn btn-sm" onClick={() => setRaiseTo(minTo)}>Mín</button>
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              const potish = Math.max(0, (state.game.currentBet ?? 0) + (state.game.pot?.total ?? 0));
                              setRaiseTo(Math.min(potish, maxRaiseTo));
                            }}
                          >
                            Pote
                          </button>
                          <button className="btn btn-sm" onClick={() => setRaiseTo(maxRaiseTo)}>
                            Máx
                          </button>
                        </div>
                      </div>

                      <input
                        className="action-slider"
                        type="range"
                        min={minTo}
                        max={Math.max(minTo, maxRaiseTo)}
                        step={step}
                        value={clampedRaiseTo}
                        onChange={(e) => setRaiseTo(Number(e.target.value))}
                        disabled={maxRaiseTo <= 0 || minTo >= maxRaiseTo}
                      />

                      <div className="action-slider-footer">
                        <span className="text-sm text-muted">
                          <span style={{ opacity: 0.6 }}>min</span>: <span className="mono">{minTo}</span>
                        </span>
                        <button
                          className="btn btn-primary"
                          disabled={!clampedRaiseTo || clampedRaiseTo < minTo || clampedRaiseTo > maxRaiseTo || clampedRaiseTo === (state.game.currentBet ?? 0)}
                          onClick={() => act("RAISE", clampedRaiseTo)}
                        >
                          Raise para {clampedRaiseTo}
                        </button>
                        <span className="text-sm text-muted">
                          <span style={{ opacity: 0.6 }}>max</span>: <span className="mono">{maxRaiseTo}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      <ToastManager toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
