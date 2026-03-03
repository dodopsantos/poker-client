"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../../src/components/RequireAuth";
import { apiFetch } from "../../../src/lib/api";

type HandDetails = {
  id: string;
  handId: string;
  tableId: string;
  dealerSeat: number;
  smallBlind: number;
  bigBlind: number;
  players: any[];
  board: string[];
  result: any;
  actions: any[];
  createdAt: string;
};

export default function HandDetailsPage({ params }: { params: { handId: string } }) {
  return (
    <RequireAuth>
      <HandDetailsInner handId={params.handId} />
    </RequireAuth>
  );
}

function HandDetailsInner({ handId }: { handId: string }) {
  const router = useRouter();
  const [hand, setHand] = useState<HandDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handId]);

  async function fetchHand() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ hand: HandDetails }>(`/hands/${handId}`);
      setHand(data.hand);
    } catch (err: any) {
      setError(err.message || "Failed to load hand details");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: "center", paddingTop: "var(--space-12)" }}>
        <div className="loading" style={{ margin: "0 auto" }} />
        <p className="text-muted" style={{ marginTop: "var(--space-4)" }}>
          Carregando detalhes...
        </p>
      </div>
    );
  }

  if (error || !hand) {
    return (
      <div className="container" style={{ paddingTop: "var(--space-6)" }}>
        <div className="card" style={{ background: "var(--danger)", borderColor: "var(--danger)" }}>
          <strong>Erro:</strong> {error || "Mão não encontrada"}
        </div>
        <button className="btn" onClick={() => router.push("/history")} style={{ marginTop: "var(--space-4)" }}>
          ← Voltar ao Histórico
        </button>
      </div>
    );
  }

  const players = Array.isArray(hand.players) ? hand.players : [];
  const board = Array.isArray(hand.board) ? hand.board : [];
  const actions = Array.isArray(hand.actions) ? hand.actions : [];
  const winners = hand.result?.winners || [];
  const reveal = hand.result?.reveal || [];

  const date = new Date(hand.createdAt);
  const formattedDate = date.toLocaleDateString("pt-BR", { 
    day: "2-digit", 
    month: "long", 
    year: "numeric" 
  });
  const formattedTime = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalPot = players.reduce((sum, p) => sum + (p.committed || 0), 0);

  return (
    <div className="hand-details-page">
      <div className="container">
        {/* Header */}
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
            <div>
              <h1 style={{ margin: 0, marginBottom: "var(--space-2)" }}>
                🃏 Mão #{hand.handId.slice(0, 12)}
              </h1>
              <p className="text-muted">
                {formattedDate} às {formattedTime}
              </p>
            </div>
            <button className="btn" onClick={() => router.push("/history")}>
              ← Voltar
            </button>
          </div>

          {/* Info básica */}
          <div className="row gap-3">
            <div className="badge-lg">SB: {hand.smallBlind}</div>
            <div className="badge-lg">BB: {hand.bigBlind}</div>
            <div className="badge-lg">{players.length} jogadores</div>
            <div className="badge-lg" style={{ background: "var(--accent-gold)", color: "var(--bg-primary)" }}>
              Pot: {totalPot.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Left Column - Players */}
          <div>
            <div className="card" style={{ marginBottom: "var(--space-4)" }}>
              <h3 style={{ marginBottom: "var(--space-4)" }}>Jogadores</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {players.map((player) => {
                  const isDealer = player.seatNo === hand.dealerSeat;
                  const winner = winners.find((w: any) => w.userId === player.userId);
                  const playerReveal = reveal.find((r: any) => r.userId === player.userId);

                  return (
                    <div key={player.seatNo} className="player-row">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div>
                          <div className="row gap-2" style={{ alignItems: "center" }}>
                            <span style={{ fontWeight: 600 }}>Seat {player.seatNo}</span>
                            {isDealer && <span className="dealer-badge">D</span>}
                            <span>{player.username}</span>
                          </div>
                          {playerReveal && (
                            <div className="row gap-2" style={{ marginTop: "var(--space-2)" }}>
                              {playerReveal.cards.map((card: string, idx: number) => (
                                <div key={idx} className="mini-card">
                                  {card}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="text-sm text-muted">Stack inicial</div>
                          <div className="mono">{player.startStack?.toLocaleString() || player.stack?.toLocaleString()}</div>
                          {winner && (
                            <div className="winner-label" style={{ marginTop: "var(--space-2)" }}>
                              🏆 +{winner.payout.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Board */}
            {board.length > 0 && (
              <div className="card">
                <h3 style={{ marginBottom: "var(--space-4)" }}>Board</h3>
                <div className="row gap-3">
                  {board.map((card, idx) => (
                    <div key={idx} className="card-display">
                      {card}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="card">
            <h3 style={{ marginBottom: "var(--space-4)" }}>Ações</h3>
            <div className="action-timeline">
              {actions.length === 0 ? (
                <p className="text-muted">Nenhuma ação registrada</p>
              ) : (
                actions.map((action, idx) => {
                  const player = players.find((p) => p.seatNo === action.seatNo);
                  
                  return (
                    <div key={idx} className="action-item">
                      <div className="action-round">{action.round}</div>
                      <div className="action-content">
                        <span className="action-player">{player?.username || `Seat ${action.seatNo}`}</span>
                        <span className="action-type">{action.action.toUpperCase()}</span>
                        {action.amount !== undefined && action.amount > 0 && (
                          <span className="action-amount mono">{action.amount.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
