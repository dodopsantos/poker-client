import "./globals.css";
import "./design-system.css";
import "./lobby.css";
import "./action-overlay-fix.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Poker Pro - Texas Hold'em Online",
  description: "Jogue poker online em tempo real com amigos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
