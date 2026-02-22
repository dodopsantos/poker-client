"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../src/components/RequireAuth";
import { TableCard } from "../../src/components/TableCard";
import { StatsWidget } from "../../src/components/StatsWidget";
import { getSocket } from "../../src/lib/socket";
import { apiFetch } from "../../src/lib/api";
import { logout } from "../../src/lib/auth";

type LobbyTable = {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;
  status: "OPEN" | "RUNNING" | "CLOSED";
  players: number;
};

export default function LobbyPage() {
  return (
    <RequireAuth>
      <LobbyInner />
    </RequireAuth>
  );
}

function LobbyInner() {
  const router = useRouter();
  const [tables, setTables] = useState<LobbyTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    function onTables(payload: LobbyTable[]) {
      setTables(payload);
      setLoading(false);
    }

    async function refreshViaHttpIfNeeded() {
      try {
        const data = await apiFetch<any>("/tables", { method: "GET" });
        if (Array.isArray(data)) {
          setTables(data);
          setLoading(false);
        }
      } catch {
        // ignore
      }
    }

    socket.emit("lobby:join");
    socket.on("lobby:tables", onTables);

    socket.on("lobby:table_updated", () => {
      socket.emit("lobby:join");
      refreshViaHttpIfNeeded();
    });

    return () => {
      socket.off("lobby:tables", onTables);
      socket.off("lobby:table_updated");
    };
  }, [socket]);

  async function createTable() {
    setError(null);
    try {
      const body = {
        name: `Mesa ${Math.floor(Math.random() * 9999)}`,
        smallBlind: 50,
        bigBlind: 100,
        maxPlayers: 6,
      };
      await apiFetch("/tables", { method: "POST", body: JSON.stringify(body) });
      socket.emit("lobby:join");
    } catch (e: any) {
      setError(e.message ?? "Falha ao criar mesa.");
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const activeTables = tables.filter(t => t.status !== "CLOSED");
  const runningTables = tables.filter(t => t.status === "RUNNING").length;
  const totalPlayers = tables.reduce((sum, t) => sum + t.players, 0);

  return (
    <div className="lobby-page">
      <div className="container">
        <div className="lobby-header">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <div>
              <h1 className="lobby-title">Lobby</h1>
              <p className="lobby-subtitle">Escolha sua mesa e comece a jogar</p>
            </div>
            <div className="row gap-3">
              <button className="btn" onClick={() => router.push("/leaderboard")}>
                🏆 Rankings
              </button>
              <button className="btn btn-success" onClick={createTable}>
                + Criar Mesa
              </button>
              <button className="btn" onClick={handleLogout}>
                Sair
              </button>
            </div>
          </div>

          {/* Stats Widget */}
        <StatsWidget />

        <div className="lobby-stats">
            <div className="stat-item">
              <div className="stat-label">Mesas Ativas</div>
              <div className="stat-value">{activeTables.length}</div>
            </div>
            <div className="divider-v" />
            <div className="stat-item">
              <div className="stat-label">Jogadores Online</div>
              <div className="stat-value">{totalPlayers}</div>
            </div>
            <div className="divider-v" />
            <div className="stat-item">
              <div className="stat-label">Mesas em Jogo</div>
              <div className="stat-value">{runningTables}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="card" style={{ background: "var(--danger)", borderColor: "var(--danger)", marginBottom: "var(--space-4)" }}>
            <strong>Erro:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="grid-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: "280px" }} />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🃏</div>
            <h3 className="empty-state-title">Nenhuma mesa disponível</h3>
            <p className="empty-state-description">
              Seja o primeiro a criar uma mesa e começar a jogar!
            </p>
            <button className="btn btn-primary btn-lg" onClick={createTable}>
              Criar Primeira Mesa
            </button>
          </div>
        ) : (
          <div className="tables-grid">
            {tables.map((t) => (
              <TableCard
                key={t.id}
                id={t.id}
                name={t.name}
                smallBlind={t.smallBlind}
                bigBlind={t.bigBlind}
                maxPlayers={t.maxPlayers}
                status={t.status}
                players={t.players}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
