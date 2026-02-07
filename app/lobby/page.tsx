"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../src/components/RequireAuth";
import { getSocket } from "../../src/lib/socket";
import { apiFetch } from "../../src/lib/api";

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

  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    function onTables(payload: LobbyTable[]) {
      setTables(payload);
    }

    async function refreshViaHttpIfNeeded() {
      // opcional: se você tiver GET /tables no backend no futuro
      // Aqui fica só como fallback, ignorado se não existir
      try {
        const data = await apiFetch<any>("/tables", { method: "GET" });
        if (Array.isArray(data)) setTables(data);
      } catch {
        // ignora
      }
    }

    socket.emit("lobby:join");
    socket.on("lobby:tables", onTables);

    socket.on("lobby:table_updated", () => {
      // MVP: backend emite só {tableId}; então pedimos lista de novo
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
      // endpoint do backend corrigido: POST /tables
      const body = {
        name: `Mesa ${Math.floor(Math.random() * 9999)}`,
        smallBlind: 50,
        bigBlind: 100,
        maxPlayers: 6,
      };
      await apiFetch("/tables", { method: "POST", body: JSON.stringify(body) });
      // backend não emite lobby:table_created no MVP, então re-join
      socket.emit("lobby:join");
    } catch (e: any) {
      setError(e.message ?? "Falha ao criar mesa.");
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>Lobby</h2>
            <div className="small">Mesas em tempo real via Socket.IO</div>
          </div>
          <button className="btn btnPrimary" onClick={createTable}>Criar mesa</button>
        </div>
        {error && <p style={{ color: "salmon" }}>{error}</p>}
      </div>

      <div className="grid">
        {tables.length === 0 ? (
          <div className="card">Nenhuma mesa (ainda). Crie uma.</div>
        ) : (
          tables.map((t) => (
            <div className="card" key={t.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="grid" style={{ gap: 4 }}>
                  <strong>{t.name}</strong>
                  <div className="small">
                    Blinds: {t.smallBlind}/{t.bigBlind} • Jogadores: {t.players}/{t.maxPlayers} • Status:{" "}
                    <span className="badge">{t.status}</span>
                  </div>
                </div>
                <button className="btn btnPrimary" onClick={() => router.push(`/table/${t.id}`)}>
                  Entrar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
