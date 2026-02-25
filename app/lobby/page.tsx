"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../src/components/RequireAuth";
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
  const [query, setQuery] = useState("");
  const [hideFull, setHideFull] = useState(false);

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

  const filteredTables = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tables
      .filter(t => (hideFull ? t.players < t.maxPlayers && t.status !== "CLOSED" : true))
      .filter(t => (q ? t.name.toLowerCase().includes(q) : true))
      // Mildly opinionated ordering: running first, then open; lower blinds first
      .slice()
      .sort((a, b) => {
        const w = (s: LobbyTable["status"]) => (s === "RUNNING" ? 0 : s === "OPEN" ? 1 : 2);
        const d = w(a.status) - w(b.status);
        if (d !== 0) return d;
        return a.bigBlind - b.bigBlind;
      });
  }, [tables, query, hideFull]);

  function canJoin(t: LobbyTable) {
    const isFull = t.players >= t.maxPlayers;
    return t.status !== "CLOSED" && !isFull;
  }

  function statusLabel(status: LobbyTable["status"]) {
    if (status === "RUNNING") return { label: "Em jogo", className: "status-running" };
    if (status === "OPEN") return { label: "Disponível", className: "status-open" };
    return { label: "Fechada", className: "status-full" };
  }

  return (
    <div className="lobby-page">
      <div className="container">
        <div className="lobby-header">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <div>
              <h1 className="lobby-title"><span>Lobby</span><span className="lobby-premium-badge">Elite</span></h1>
              <p className="lobby-subtitle">Escolha sua mesa e comece a jogar</p>
            </div>
            <div className="row gap-3">
              <button className="btn" onClick={() => router.push("/history")}>
                🃏 Histórico
              </button>
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
          <div className="lobby-list card">
            <div className="lobby-toolbar">
              <div className="lobby-search">
                <span className="lobby-search-icon">⌕</span>
                <input
                  className="lobby-search-input"
                  placeholder="Buscar mesa..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <label className="lobby-toggle">
                <input
                  type="checkbox"
                  checked={hideFull}
                  onChange={(e) => setHideFull(e.target.checked)}
                />
                <span>Somente disponíveis</span>
              </label>
            </div>

            <div className="lobby-table-wrap" role="region" aria-label="Lista de mesas">
              <table className="lobby-table">
                <thead>
                  <tr>
                    <th>Mesa</th>
                    <th className="col-stakes">Blinds</th>
                    <th className="col-players">Jogadores</th>
                    <th className="col-status">Status</th>
                    <th className="col-cta" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTables.map((t) => {
                    const joinable = canJoin(t);
                    const st = statusLabel(t.status);

                    return (
                      <tr
                        key={t.id}
                        className={joinable ? "row-clickable" : "row-disabled"}
                        onClick={() => joinable && router.push(`/table/${t.id}`)}
                      >
                        <td className="cell-name">
                          <div className="name-main">{t.name}</div>
                          <div className="name-sub">Max {t.maxPlayers} • ID {t.id.slice(0, 6)}</div>
                        </td>

                        <td className="col-stakes">
                          <span className="stakes-pill">{t.smallBlind} / {t.bigBlind}</span>
                        </td>

                        <td className="col-players">
                          <span className={t.players >= t.maxPlayers ? "players-full" : "players-ok"}>
                            {t.players}/{t.maxPlayers}
                          </span>
                        </td>

                        <td className="col-status">
                          <span className={`table-status-badge ${st.className}`}>{st.label}</span>
                        </td>

                        <td className="col-cta">
                          <button
                            className="btn btn-primary btn-join"
                            disabled={!joinable}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (joinable) router.push(`/table/${t.id}`);
                            }}
                          >
                            Entrar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredTables.length === 0 && (
              <div className="lobby-empty-inline">Nenhuma mesa encontrada com esses filtros.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
