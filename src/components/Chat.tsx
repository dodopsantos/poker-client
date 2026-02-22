"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

type ChatMessage = {
  id: string;
  tableId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
};

interface ChatProps {
  socket: Socket;
  tableId: string;
  myUserId: string;
  /**
   * floating: botão flutuante (padrão)
   * docked: painel fixo/dockado (PokerStars-like)
   */
  variant?: "floating" | "docked";
  className?: string;
}

export function Chat({ socket, tableId, myUserId, variant = "floating", className }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  // No modo docked o chat fica sempre aberto
  const [isOpen, setIsOpen] = useState(variant === "docked");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Buscar histórico ao montar
    socket.emit("table:chat:history", { tableId, limit: 50 });

    function onMessage(msg: ChatMessage) {
      setMessages(prev => [...prev, msg]);
      setError(null);
    }

    function onHistory(data: { messages: ChatMessage[] }) {
      setMessages(data.messages);
    }

    function onError(data: { error: string }) {
      setError(data.error);
      setTimeout(() => setError(null), 5000);
    }

    socket.on("table:chat:message", onMessage);
    socket.on("table:chat:history", onHistory);
    socket.on("table:chat:error", onError);

    return () => {
      socket.off("table:chat:message", onMessage);
      socket.off("table:chat:history", onHistory);
      socket.off("table:chat:error", onError);
    };
  }, [socket, tableId]);

  // Auto-scroll ao receber nova mensagem
  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Se estiver dockado, sempre aberto
  useEffect(() => {
    if (variant === "docked") setIsOpen(true);
  }, [variant]);

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    socket.emit("table:chat:message", { tableId, message: input });
    setInput("");
  }

  const unreadCount = messages.length > 0 ? messages.filter(m => m.userId !== myUserId).length : 0;

  return (
    <>
      {/* Toggle button (somente no modo floating) */}
      {variant === "floating" && (
        <button
          className="chat-toggle"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "var(--accent-blue)",
            border: "none",
            color: "white",
            fontSize: "24px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            zIndex: 110,
            transition: "all 0.2s ease",
          }}
        >
          {isOpen ? "✕" : "💬"}
          {!isOpen && unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                background: "var(--danger)",
                color: "white",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                fontSize: "12px",
                display: "grid",
                placeItems: "center",
                fontWeight: "bold",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className={["chat-panel", className].filter(Boolean).join(" ")}
          style={
            variant === "floating"
              ? {
                  position: "fixed",
                  bottom: "90px",
                  right: "20px",
                  width: "340px",
                  height: "480px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-xl)",
                  display: "flex",
                  flexDirection: "column",
                  zIndex: 109,
                  animation: "slideUp 0.2s ease-out",
                }
              : {
                  width: "100%",
                  height: "100%",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-lg)",
                  display: "flex",
                  flexDirection: "column",
                }
          }
        >
          {/* Header */}
          <div
            style={{
              padding: "var(--space-4)",
              borderBottom: "1px solid var(--border-default)",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
            }}
          >
            <strong>Chat da Mesa</strong>
            <div className="text-sm text-muted" style={{ marginTop: "4px" }}>
              {messages.length} mensagens
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "var(--space-3)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            {messages.length === 0 ? (
              <div
                className="text-sm text-muted"
                style={{
                  textAlign: "center",
                  padding: "var(--space-10) var(--space-4)",
                }}
              >
                Nenhuma mensagem ainda. Seja o primeiro a conversar!
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.userId === myUserId;
                const time = new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isMe ? "flex-end" : "flex-start",
                      maxWidth: "80%",
                    }}
                  >
                    {!isMe && (
                      <div
                        className="text-sm"
                        style={{
                          color: "var(--accent-blue)",
                          marginBottom: "2px",
                          fontWeight: 600,
                        }}
                      >
                        {msg.username}
                      </div>
                    )}
                    <div
                      style={{
                        background: isMe ? "var(--accent-blue)" : "var(--bg-tertiary)",
                        color: isMe ? "white" : "var(--text-primary)",
                        padding: "8px 12px",
                        borderRadius: "12px",
                        wordBreak: "break-word",
                      }}
                    >
                      <div style={{ fontSize: "14px" }}>{msg.message}</div>
                      <div
                        className="text-sm"
                        style={{
                          marginTop: "4px",
                          opacity: 0.7,
                          fontSize: "11px",
                        }}
                      >
                        {time}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "var(--space-2) var(--space-3)",
                background: "var(--danger)",
                color: "white",
                fontSize: "13px",
                borderRadius: "0",
              }}
            >
              {error}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={sendMessage}
            style={{
              padding: "var(--space-3)",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              gap: "var(--space-2)",
            }}
          >
            <input
              className="input"
              type="text"
              placeholder="Digite uma mensagem..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              style={{
                flex: 1,
                fontSize: "14px",
                padding: "10px 12px",
              }}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!input.trim()}
              style={{
                padding: "10px 16px",
              }}
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  );
}
