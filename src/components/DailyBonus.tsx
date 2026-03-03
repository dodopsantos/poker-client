"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

export function DailyBonus({ onClaim }: { onClaim?: () => void }) {
  const [status, setStatus] = useState<{
    canClaim: boolean;
    hoursRemaining: number;
    bonusAmount: number;
  } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const data = await apiFetch<{
        canClaim: boolean;
        hoursRemaining: number;
        bonusAmount: number;
      }>("/wallet/daily-bonus/status");
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch bonus status:", err);
    }
  }

  async function claimBonus() {
    setClaiming(true);
    setError(null);

    try {
      await apiFetch("/wallet/daily-bonus", { method: "POST" });
      setSuccess(true);
      
      // Atualizar status
      await fetchStatus();
      
      // Callback para atualizar saldo
      if (onClaim) onClaim();
      
      // Reset success após 3s
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to claim bonus");
    } finally {
      setClaiming(false);
    }
  }

  if (!status) {
    return null;
  }

  return (
    <div className="daily-bonus-widget card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h4 style={{ margin: 0, marginBottom: 4 }}>🎁 Bônus Diário</h4>
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            {status.canClaim
              ? `Ganhe ${status.bonusAmount.toLocaleString()} moedas grátis!`
              : `Próximo bônus em ${status.hoursRemaining}h`}
          </p>
        </div>

        <button
          className={`btn ${status.canClaim ? "btn-success" : ""}`}
          onClick={claimBonus}
          disabled={!status.canClaim || claiming}
          style={{ minWidth: 120 }}
        >
          {claiming ? "..." : status.canClaim ? "Coletar" : `${status.hoursRemaining}h`}
        </button>
      </div>

      {success && (
        <div
          className="success-message"
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--success)",
            borderRadius: "var(--radius-md)",
            color: "white",
            fontWeight: 600,
          }}
        >
          ✅ +{status.bonusAmount} moedas coletadas!
        </div>
      )}

      {error && (
        <div
          className="error-message"
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--danger)",
            borderRadius: "var(--radius-md)",
            color: "white",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
