"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../src/components/RequireAuth";
import { apiFetch } from "../../src/lib/api";
import { getToken, logout } from "../../src/lib/auth";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  value: number;
  handsPlayed: number;
  winRate: number;
  totalProfit: number;
};

type Metric = "profit" | "winRate" | "handsPlayed" | "biggestWin";
type Period = "all" | "30d" | "7d" | "today";

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

export default function LeaderboardPage() {
  return (
    <RequireAuth>
      <LeaderboardInner />
    </RequireAuth>
  );
}

function LeaderboardInner() {
  const router = useRouter();
  const [metric, setMetric] = useState<Metric>("profit");
  const [period, setPeriod] = useState<Period>("all");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const me = decodeJwt(getToken());

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, period]);

  async function fetchLeaderboard() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{
        leaderboard: LeaderboardEntry[];
        myRank: number | null;
      }>(`/leaderboard?metric=${metric}&period=${period}&limit=100`);

      setLeaderboard(data.leaderboard);
      setMyRank(data.myRank);
    } catch (err: any) {
      setError(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const metricLabels: Record<Metric, string> = {
    profit: "Top Profit",
    winRate: "Top Win Rate",
    handsPlayed: "Most Active",
    biggestWin: "Biggest Winner",
  };

  const periodLabels: Record<Period, string> = {
    all: "All-time",
    "30d": "Last 30 days",
    "7d": "Last 7 days",
    today: "Today",
  };

  function formatValue(value: number, m: Metric): string {
    if (m === "winRate") {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString();
  }

  return (
    <div className="leaderboard-page">
      <div className="container">
        {/* Header */}
        <div className="leaderboard-header">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <div>
              <h1 className="leaderboard-title">🏆 Leaderboards</h1>
              <p className="leaderboard-subtitle">Compete com os melhores jogadores</p>
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

          {/* My Rank Badge */}
          {myRank && (
            <div className="my-rank-badge">
              <div className="my-rank-label">Seu Rank</div>
              <div className="my-rank-value">#{myRank}</div>
            </div>
          )}
        </div>

        {/* Metric Tabs */}
        <div className="metric-tabs">
          {(Object.keys(metricLabels) as Metric[]).map((m) => (
            <button
              key={m}
              className={`metric-tab ${metric === m ? "metric-tab-active" : ""}`}
              onClick={() => setMetric(m)}
            >
              {metricLabels[m]}
            </button>
          ))}
        </div>

        {/* Period Selector */}
        <div className="period-selector">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              className={`period-btn ${period === p ? "period-btn-active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Leaderboard Table */}
        {error && (
          <div className="card" style={{ background: "var(--danger)", borderColor: "var(--danger)", marginTop: "var(--space-4)" }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="leaderboard-loading">
            <div className="loading" />
            <p className="text-muted" style={{ marginTop: "var(--space-4)" }}>
              Carregando rankings...
            </p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3 className="empty-state-title">Nenhum dado disponível</h3>
            <p className="empty-state-description">
              Jogue algumas mãos para aparecer no leaderboard!
            </p>
          </div>
        ) : (
          <div className="leaderboard-table-container">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="rank-col">Rank</th>
                  <th className="player-col">Jogador</th>
                  <th className="value-col">{metricLabels[metric]}</th>
                  <th className="hands-col">Mãos</th>
                  <th className="winrate-col">Win Rate</th>
                  {metric !== "profit" && <th className="profit-col">Profit</th>}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => {
                  const isMe = me && entry.userId === me.userId;

                  return (
                    <tr
                      key={entry.userId}
                      className={`leaderboard-row ${isMe ? "leaderboard-row-me" : ""}`}
                    >
                      <td className="rank-col">
                        <div className="rank-badge">
                          {entry.rank <= 3 && (
                            <span className="rank-icon">
                              {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                            </span>
                          )}
                          #{entry.rank}
                        </div>
                      </td>
                      <td className="player-col">
                        <div className="player-info">
                          <div className="player-name">
                            {entry.username}
                            {isMe && <span className="you-badge">você</span>}
                          </div>
                        </div>
                      </td>
                      <td className="value-col">
                        <div className="value-display">
                          {formatValue(entry.value, metric)}
                        </div>
                      </td>
                      <td className="hands-col">
                        <span className="text-muted">{entry.handsPlayed}</span>
                      </td>
                      <td className="winrate-col">
                        <span className="text-muted">
                          {(entry.winRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      {metric !== "profit" && (
                        <td className="profit-col">
                          <span
                            className="mono"
                            style={{
                              color:
                                entry.totalProfit > 0
                                  ? "var(--success)"
                                  : entry.totalProfit < 0
                                  ? "var(--danger)"
                                  : "var(--text-muted)",
                            }}
                          >
                            {entry.totalProfit > 0 ? "+" : ""}
                            {entry.totalProfit.toLocaleString()}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
