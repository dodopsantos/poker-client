"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../src/components/RequireAuth";
import { apiFetch } from "../../src/lib/api";

type HandHistoryEntry = {
  id: string;
  handId: string;
  tableId: string;
  dealerSeat: number;
  smallBlind: number;
  bigBlind: number;
  players: any;
  board: string[];
  result: any;
  actions: any;
  createdAt: string;
};

export default function HistoryPage() {
  return (
    <RequireAuth>
      <HistoryInner />
    </RequireAuth>
  );
}

function HistoryInner() {
  const router = useRouter();
  const [history, setHistory] = useState<HandHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ history: HandHistoryEntry[] }>("/history/me?limit=50");
      setHistory(data.history);
    } catch (err: any) {
      setError(err.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const { logout } = await import("../../src/lib/auth");
    await logout();
    router.push("/login");
  }

  return (
    <div className="history-page">
      <div className="container">
        {/* Header */}
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h1 style={{ margin: 0, marginBottom: "var(--space-2)" }}>
                🃏 Histórico de Mãos
              </h1>
              <p className="text-muted">Revise todas as mãos que você jogou</p>
            </div>
            <div className="row gap-3">
              <button className="btn" onClick={() => router.push("/lobby")}>
                ← Lobby
              </button>
              <button className="btn" onClick={handleLogout}>
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
            <div className="loading" style={{ margin: "0 auto" }} />
            <p className="text-muted" style={{ marginTop: "var(--space-4)" }}>
              Carregando histórico...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="card"
            style={{
              background: "var(--danger)",
              borderColor: "var(--danger)",
              marginBottom: "var(--space-4)",
            }}
          >
            <strong>Erro:</strong> {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && history.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🎴</div>
            <h3 className="empty-state-title">Nenhuma mão jogada ainda</h3>
            <p className="empty-state-description">
              Jogue algumas mãos para ver o histórico aqui!
            </p>
            <button className="btn btn-success" onClick={() => router.push("/lobby")}>
              Ir para o Lobby
            </button>
          </div>
        )}

        {/* History List */}
        {!loading && !error && history.length > 0 && (
          <div className="history-list">
            {history.map((hand) => (
              <HandCard key={hand.id} hand={hand} router={router} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HandCard({ hand, router }: { hand: HandHistoryEntry; router: any }) {
  const players = Array.isArray(hand.players) ? hand.players : [];
  const board = Array.isArray(hand.board) ? hand.board : [];
  const winners = hand.result?.winners || [];
  
  const date = new Date(hand.createdAt);
  const formattedDate = date.toLocaleDateString("pt-BR");
  const formattedTime = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalPot = players.reduce((sum: number, p: any) => {
    return sum + (p.committed || 0);
  }, 0);

  return (
    <div className="hand-card card card-hover" onClick={() => router.push(`/hands/${hand.handId}`)}>
      {/* Header */}
      <div className="hand-card-header">
        <div>
          <div className="hand-id">Mão #{hand.handId.slice(0, 8)}</div>
          <div className="hand-date">
            {formattedDate} às {formattedTime}
          </div>
        </div>
        <div className="hand-pot">
          <div className="text-sm text-muted">Pot</div>
          <div className="text-lg mono" style={{ fontWeight: 700, color: "var(--accent-gold)" }}>
            {totalPot.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Blinds */}
      <div className="hand-blinds">
        <span className="badge">SB: {hand.smallBlind}</span>
        <span className="badge">BB: {hand.bigBlind}</span>
        <span className="badge">{players.length} jogadores</span>
      </div>

      {/* Board */}
      {board.length > 0 && (
        <div className="hand-board">
          <div className="text-sm text-muted" style={{ marginBottom: "var(--space-2)" }}>
            Board:
          </div>
          <div className="row gap-2">
            {board.map((card, idx) => (
              <div key={idx} className="mini-card">
                {card}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Winners */}
      {winners.length > 0 && (
        <div className="hand-winners">
          <div className="text-sm text-muted" style={{ marginBottom: "var(--space-2)" }}>
            Vencedor{winners.length > 1 ? "es" : ""}:
          </div>
          <div className="row gap-2">
            {winners.map((w: any, idx: number) => (
              <div key={idx} className="winner-badge">
                🏆 {players.find((p: any) => p.userId === w.userId)?.username || "Player"} (+
                {w.payout.toLocaleString()})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Details */}
      <div className="hand-card-footer">
        <button className="btn-link">Ver detalhes →</button>
      </div>
    </div>
  );
}
