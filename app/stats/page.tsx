"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../src/components/RequireAuth";
import { apiFetch } from "../../src/lib/api";
import { logout } from "../../src/lib/auth";

type PlayerStats = {
  userId: string;
  username: string;
  handsPlayed: number;
  handsWon: number;
  winRate: number;
  totalProfit: number;
  biggestWin: number;
  biggestLoss: number;
  totalBuyins: number;
  totalCashouts: number;
  lastHandAt: string | null;
};

type Rankings = {
  profit: number | null;
  winRate: number | null;
  handsPlayed: number | null;
  biggestWin: number | null;
};

export default function StatsPage() {
  return (
    <RequireAuth>
      <StatsInner />
    </RequireAuth>
  );
}

function StatsInner() {
  const router = useRouter();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ stats: PlayerStats; rankings: Rankings }>("/stats/me");
      setStats(data.stats);
      setRankings(data.rankings);
    } catch (err: any) {
      setError(err.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: "center", paddingTop: "var(--space-12)" }}>
        <div className="loading" style={{ margin: "0 auto" }} />
        <p className="text-muted" style={{ marginTop: "var(--space-4)" }}>
          Carregando estatísticas...
        </p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="container" style={{ paddingTop: "var(--space-6)" }}>
        <div className="card" style={{ background: "var(--danger)", borderColor: "var(--danger)" }}>
          <strong>Erro:</strong> {error || "Stats não encontradas"}
        </div>
      </div>
    );
  }

  return (
    <div className="stats-page">
      <div className="container">
        {/* Header */}
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h1 style={{ margin: 0, marginBottom: "var(--space-2)" }}>
                📊 Suas Estatísticas
              </h1>
              <p className="text-muted">Olá, {stats.username}!</p>
            </div>
            <div className="row gap-3">
              <button className="btn" onClick={() => router.push("/leaderboard")}>
                🏆 Rankings
              </button>
              <button className="btn" onClick={() => router.push("/lobby")}>
                ← Lobby
              </button>
              <button className="btn" onClick={handleLogout}>
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid-2" style={{ marginBottom: "var(--space-6)" }}>
          {/* Core Stats */}
          <div className="card">
            <h3 style={{ marginBottom: "var(--space-4)" }}>Desempenho</h3>
            
            <div className="stat-row">
              <span className="stat-label">Mãos Jogadas</span>
              <span className="stat-value mono">{stats.handsPlayed}</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Mãos Ganhas</span>
              <span className="stat-value mono">{stats.handsWon}</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Win Rate</span>
              <span className="stat-value mono" style={{ color: "var(--accent-green)" }}>
                {(stats.winRate * 100).toFixed(1)}%
              </span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Profit Total</span>
              <span
                className="stat-value mono"
                style={{
                  color:
                    stats.totalProfit > 0
                      ? "var(--success)"
                      : stats.totalProfit < 0
                      ? "var(--danger)"
                      : "var(--text-primary)",
                }}
              >
                {stats.totalProfit > 0 ? "+" : ""}
                {stats.totalProfit.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Money Stats */}
          <div className="card">
            <h3 style={{ marginBottom: "var(--space-4)" }}>Financeiro</h3>
            
            <div className="stat-row">
              <span className="stat-label">Total Buy-ins</span>
              <span className="stat-value mono">{stats.totalBuyins.toLocaleString()}</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Total Cashouts</span>
              <span className="stat-value mono">{stats.totalCashouts.toLocaleString()}</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Maior Vitória</span>
              <span className="stat-value mono" style={{ color: "var(--success)" }}>
                +{stats.biggestWin.toLocaleString()}
              </span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Maior Perda</span>
              <span className="stat-value mono" style={{ color: "var(--danger)" }}>
                {stats.biggestLoss.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Rankings */}
        {rankings && (
          <div className="card">
            <h3 style={{ marginBottom: "var(--space-4)" }}>Seus Rankings</h3>
            
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {rankings.profit && (
                <div className="ranking-card">
                  <div className="ranking-label">Profit</div>
                  <div className="ranking-value">#{rankings.profit}</div>
                </div>
              )}

              {rankings.winRate && (
                <div className="ranking-card">
                  <div className="ranking-label">Win Rate</div>
                  <div className="ranking-value">#{rankings.winRate}</div>
                </div>
              )}

              {rankings.handsPlayed && (
                <div className="ranking-card">
                  <div className="ranking-label">Mãos Jogadas</div>
                  <div className="ranking-value">#{rankings.handsPlayed}</div>
                </div>
              )}

              {rankings.biggestWin && (
                <div className="ranking-card">
                  <div className="ranking-label">Maior Vitória</div>
                  <div className="ranking-value">#{rankings.biggestWin}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
