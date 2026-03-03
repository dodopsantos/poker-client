"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../src/components/RequireAuth";
import { apiFetch } from "../../src/lib/api";
import { logout } from "../../src/lib/auth";

type UserProfile = {
  id: string;
  username: string;
  role: string;
  balance: number;
  createdAt: string;
  lastDailyBonus: string | null;
  stats: {
    handsPlayed: number;
    handsWon: number;
    totalProfit: number;
    biggestWin: number;
    biggestLoss: number;
  };
};

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}

function ProfileInner() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Recharge states
  const [rechargeAmount, setRechargeAmount] = useState("1000");
  const [recharging, setRecharging] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState(false);
  const [rechargeError, setRechargeError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ user: UserProfile }>("/profile/me");
      setProfile(data.user);
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecharge() {
    const amount = parseInt(rechargeAmount);
    
    if (isNaN(amount) || amount <= 0 || amount > 100000) {
      setRechargeError("Amount must be between 1 and 100,000");
      return;
    }

    setRecharging(true);
    setRechargeError(null);
    setRechargeSuccess(false);

    try {
      const data = await apiFetch<{ success: boolean; amount: number; newBalance: number }>(
        "/wallet/recharge",
        {
          method: "POST",
          body: JSON.stringify({ amount })
        }
      );

      // Atualizar saldo local
      if (profile) {
        setProfile({
          ...profile,
          balance: data.newBalance
        });
      }

      setRechargeSuccess(true);
      setTimeout(() => setRechargeSuccess(false), 3000);
    } catch (err: any) {
      if (err.message.includes("COOLDOWN")) {
        setRechargeError(err.message);
      } else {
        setRechargeError(err.message || "Failed to recharge");
      }
    } finally {
      setRecharging(false);
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
          Carregando perfil...
        </p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container" style={{ paddingTop: "var(--space-6)" }}>
        <div className="card" style={{ background: "var(--danger)", borderColor: "var(--danger)" }}>
          <strong>Erro:</strong> {error || "Profile not found"}
        </div>
        <button className="btn" onClick={() => router.push("/lobby")} style={{ marginTop: "var(--space-4)" }}>
          ← Voltar ao Lobby
        </button>
      </div>
    );
  }

  const winRate = profile.stats.handsPlayed > 0 
    ? ((profile.stats.handsWon / profile.stats.handsPlayed) * 100).toFixed(1)
    : "0.0";

  const memberSince = new Date(profile.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="profile-page">
      <div className="container">
        {/* Header */}
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
            <div>
              <h1 style={{ margin: 0, marginBottom: "var(--space-2)" }}>
                👤 Meu Perfil
              </h1>
              <p className="text-muted">{profile.username}</p>
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

          {/* Role Badge */}
          <div style={{ marginTop: "var(--space-3)" }}>
            <span className={`badge-lg ${profile.role === "ADMIN" ? "badge-admin" : ""}`}>
              {profile.role === "ADMIN" ? "👑 Admin" : "🎮 Jogador"}
            </span>
            <span className="text-sm text-muted" style={{ marginLeft: "var(--space-3)" }}>
              Membro desde {memberSince}
            </span>
          </div>
        </div>

        <div className="grid-2">
          {/* Left Column - Wallet */}
          <div>
            {/* Saldo Atual */}
            <div className="card wallet-card" style={{ marginBottom: "var(--space-4)" }}>
              <h3 style={{ marginBottom: "var(--space-4)" }}>💰 Carteira</h3>
              
              <div className="balance-display">
                <div className="text-sm text-muted">Saldo Atual</div>
                <div className="balance-amount">
                  {profile.balance.toLocaleString()}
                </div>
                <div className="text-sm text-muted">moedas ficticias</div>
              </div>
            </div>

            {/* Recarregar Saldo */}
            <div className="card recharge-card">
              <h3 style={{ marginBottom: "var(--space-4)" }}>🔋 Recarregar Saldo</h3>
              
              <div style={{ marginBottom: "var(--space-3)" }}>
                <label className="text-sm text-muted" style={{ marginBottom: "var(--space-2)", display: "block" }}>
                  Quantidade (1 - 100.000)
                </label>
                <input
                  type="number"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  min="1"
                  max="100000"
                  className="input"
                  style={{ width: "100%", marginBottom: "var(--space-3)" }}
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="row gap-2" style={{ marginBottom: "var(--space-3)" }}>
                <button className="btn-quick" onClick={() => setRechargeAmount("1000")}>
                  +1K
                </button>
                <button className="btn-quick" onClick={() => setRechargeAmount("5000")}>
                  +5K
                </button>
                <button className="btn-quick" onClick={() => setRechargeAmount("10000")}>
                  +10K
                </button>
                <button className="btn-quick" onClick={() => setRechargeAmount("50000")}>
                  +50K
                </button>
              </div>

              <button
                className="btn btn-success"
                onClick={handleRecharge}
                disabled={recharging}
                style={{ width: "100%" }}
              >
                {recharging ? "Recarregando..." : "Recarregar"}
              </button>

              {rechargeSuccess && (
                <div className="success-message" style={{ marginTop: "var(--space-3)" }}>
                  ✅ Saldo recarregado com sucesso!
                </div>
              )}

              {rechargeError && (
                <div className="error-message" style={{ marginTop: "var(--space-3)" }}>
                  {rechargeError}
                </div>
              )}

              <div className="text-xs text-muted" style={{ marginTop: "var(--space-3)", textAlign: "center" }}>
                ⏱️ Cooldown: 1 minuto entre recargas
              </div>
            </div>
          </div>

          {/* Right Column - Stats */}
          <div className="card">
            <h3 style={{ marginBottom: "var(--space-4)" }}>📊 Estatísticas</h3>
            
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Mãos Jogadas</div>
                <div className="stat-value">{profile.stats.handsPlayed.toLocaleString()}</div>
              </div>

              <div className="stat-item">
                <div className="stat-label">Mãos Ganhas</div>
                <div className="stat-value stat-success">{profile.stats.handsWon.toLocaleString()}</div>
              </div>

              <div className="stat-item">
                <div className="stat-label">Win Rate</div>
                <div className="stat-value">{winRate}%</div>
              </div>

              <div className="stat-item">
                <div className="stat-label">Profit Total</div>
                <div className={`stat-value ${profile.stats.totalProfit >= 0 ? "stat-success" : "stat-danger"}`}>
                  {profile.stats.totalProfit >= 0 ? "+" : ""}
                  {profile.stats.totalProfit.toLocaleString()}
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-label">Maior Vitória</div>
                <div className="stat-value stat-success">
                  +{profile.stats.biggestWin.toLocaleString()}
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-label">Maior Perda</div>
                <div className="stat-value stat-danger">
                  {profile.stats.biggestLoss.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
