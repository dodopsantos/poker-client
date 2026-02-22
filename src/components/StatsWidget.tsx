"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";

type QuickStats = {
  handsPlayed: number;
  winRate: number;
  totalProfit: number;
};

export function StatsWidget() {
  const router = useRouter();
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const data = await apiFetch<{ stats: QuickStats }>("/stats/me");
      setStats(data.stats);
    } catch (err) {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  if (loading || !stats) {
    return null; // Don't show if loading or no stats
  }

  return (
    <div
      className="card card-hover card-interactive"
      onClick={() => router.push("/stats")}
      style={{ cursor: "pointer" }}
    >
      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <strong>📊 Suas Stats</strong>
        <span className="text-sm text-muted">Ver detalhes →</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)" }}>
        <div>
          <div className="text-sm text-muted">Mãos</div>
          <div className="text-lg mono" style={{ fontWeight: 600 }}>
            {stats.handsPlayed}
          </div>
        </div>

        <div>
          <div className="text-sm text-muted">Win Rate</div>
          <div className="text-lg mono" style={{ fontWeight: 600, color: "var(--accent-green)" }}>
            {(stats.winRate * 100).toFixed(1)}%
          </div>
        </div>

        <div>
          <div className="text-sm text-muted">Profit</div>
          <div
            className="text-lg mono"
            style={{
              fontWeight: 600,
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
          </div>
        </div>
      </div>
    </div>
  );
}
