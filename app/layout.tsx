import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Poker (MVP)",
  description: "Lobby + Mesa em tempo real (Socket.IO) - MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="container">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <div className="row">
              <strong>Poker MVP</strong>
              <span className="badge">Next.js + Socket.IO</span>
            </div>
            <div className="row">
              <a className="btn" href="/lobby">Lobby</a>
              <a className="btn" href="/login">Login</a>
            </div>
          </div>
          {children}
          <div className="hr" />
          <div className="small">Dica: abra 2 abas com usuários diferentes para testar tempo real.</div>
        </div>
      </body>
    </html>
  );
}
