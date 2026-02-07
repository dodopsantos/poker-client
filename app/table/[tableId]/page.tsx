"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "../../../src/components/RequireAuth";
import { getSocket } from "../../../src/lib/socket";
import type { TableEvent, TableState } from "../../../src/contracts/table";
import { apiFetch } from "../../../src/lib/api";
import { PokerTableView } from "../../../src/components/PokerTableView";

export default function TablePage() {
  return (
    <RequireAuth>
      <TableInner />
    </RequireAuth>
  );
}

function TableInner() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const socket = useMemo(() => getSocket(), []);
  const [state, setState] = useState<TableState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [buyIn, setBuyIn] = useState(1000);
  const [seatNo, setSeatNo] = useState(1);

  useEffect(() => {
    setError(null);

    function onState(s: TableState) {
      setState(s);
    }
    function onEvent(ev: TableEvent) {
      if (ev.type === "STATE_SNAPSHOT") setState(ev.state);
      if (ev.type === "ERROR") setError(`${ev.code}: ${ev.message}`);
    }

    socket.emit("table:join", { tableId });
    socket.on("table:state", onState);
    socket.on("table:event", onEvent);

    return () => {
      socket.off("table:state", onState);
      socket.off("table:event", onEvent);
    };
  }, [socket, tableId]);

  async function sit() {
    setError(null);
    socket.emit("table:sit", { tableId, seatNo: Number(seatNo), buyInAmount: Number(buyIn) });
  }

  async function leave() {
    setError(null);
    socket.emit("table:leave", { tableId });
  }

  async function wallet() {
    setError(null);
    try {
      const data = await apiFetch<{ balance: number }>("/wallet", { method: "GET" });
      alert(`Saldo (wallet): ${data.balance}`);
    } catch (e: any) {
      setError(e.message ?? "Falha ao buscar wallet.");
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="grid" style={{ gap: 4 }}>
            <h2 style={{ margin: 0 }}>Mesa</h2>
            <div className="small">ID: <code>{tableId}</code></div>
          </div>
          <div className="row">
            <button className="btn" onClick={wallet}>Ver wallet</button>
            <button className="btn" onClick={() => router.push("/lobby")}>Voltar</button>
          </div>
        </div>
        {error && <p style={{ color: "salmon" }}>{error}</p>}
      </div>

      {!state ? (
        <div className="card">Carregando estado da mesa...</div>
      ) : (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{state.table.name}</strong>
                <div className="small">
                  Blinds: {state.table.smallBlind}/{state.table.bigBlind} • Max: {state.table.maxPlayers} •{" "}
                  <span className="badge">{state.table.status}</span>
                </div>
              </div>
              <div className="row">
                <button className="btn" onClick={leave}>Sair (cashout)</button>
              </div>
            </div>
          </div>

          <div className="grid grid2">
            <div className="card" style={{ padding: 12 }}>
              <PokerTableView state={state} />
            </div>

            <div className="card">
              <strong>Ações (MVP)</strong>
              <div className="hr" />
              <div className="grid" style={{ gap: 10 }}>
                <label className="small">Seat No</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={state.table.maxPlayers}
                  value={seatNo}
                  onChange={(e) => setSeatNo(Number(e.target.value))}
                />

                <label className="small">Buy-in</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={buyIn}
                  onChange={(e) => setBuyIn(Number(e.target.value))}
                />

                <button className="btn btnPrimary" onClick={sit}>
                  Sentar (buy-in)
                </button>

                <div className="hr" />
                <strong>Assentos</strong>
                <div className="grid" style={{ gap: 8 }}>
                  {state.seats.map((s) => (
                    <div key={s.seatNo} className="row" style={{ justifyContent: "space-between" }}>
                      <div className="row">
                        <span className="badge">#{s.seatNo}</span>
                        <span>{s.user ? s.user.username : "vazio"}</span>
                        <span className="small">({s.state})</span>
                      </div>
                      <div className="row">
                        <span className="small">stack: {s.stack}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="small">
                  O servidor é autoridade. Aqui estamos só testando sentar/sair/estado. Próximo passo: <code>table:action</code>.
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <strong>Game (placeholder)</strong>
            <div className="hr" />
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(state.game, null, 2)}</pre>
          </div>
        </>
      )}
    </div>
  );
}
