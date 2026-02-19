"use client";

import { useRouter } from "next/navigation";

interface TableCardProps {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;
  status: "OPEN" | "RUNNING" | "CLOSED";
  players: number;
}

export function TableCard({ id, name, smallBlind, bigBlind, maxPlayers, status, players }: TableCardProps) {
  const router = useRouter();
  
  const isFull = players >= maxPlayers;
  const canJoin = status !== "CLOSED" && !isFull;
  
  const statusConfig = {
    OPEN: { label: "Disponível", className: "status-open" },
    RUNNING: { label: "Em jogo", className: "status-running" },
    CLOSED: { label: "Fechada", className: "status-full" },
  };
  
  const currentStatus = statusConfig[status];
  
  return (
    <div className="table-card" onClick={() => canJoin && router.push(`/table/${id}`)}>
      <div className="table-card-header">
        <h3 className="table-name">{name}</h3>
        <div className="table-stakes">
          <span>💰</span>
          <span>{smallBlind}/{bigBlind}</span>
        </div>
      </div>
      
      <div className="table-card-body">
        <div className="table-stats">
          <div className="table-stat">
            <div className="table-stat-label">Jogadores</div>
            <div className="table-stat-value">{players}/{maxPlayers}</div>
          </div>
          
          <div className="table-stat">
            <div className="table-stat-label">Status</div>
            <div className={`table-status-badge ${currentStatus.className}`}>
              {currentStatus.label}
            </div>
          </div>
        </div>
        
        <div className="players-indicator">
          <div className="players-dots">
            {Array.from({ length: maxPlayers }).map((_, i) => (
              <div
                key={i}
                className={i < players ? "player-dot" : "player-dot player-dot-empty"}
              />
            ))}
          </div>
        </div>
      </div>
      
      <div className="table-card-footer">
        <button
          className="join-table-btn"
          disabled={!canJoin}
          onClick={(e) => {
            e.stopPropagation();
            if (canJoin) router.push(`/table/${id}`);
          }}
        >
          {isFull ? "Mesa cheia" : status === "CLOSED" ? "Mesa fechada" : "Entrar na mesa"}
        </button>
      </div>
    </div>
  );
}
