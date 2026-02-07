# Poker Web Client (Next.js + TS)

Cliente mínimo para o backend (Express + Socket.IO) do seu MVP de Poker.

## Requisitos
- Node 18+
- Backend rodando (ex.: http://localhost:3001)

## Setup
```bash
npm i
cp .env.example .env.local
npm run dev
```

Abra: http://localhost:3000

## Fluxo
1) /login -> registrar ou logar (salva token no localStorage)
2) /lobby -> cria mesa + entra
3) /table/:tableId -> senta com buy-in e sai com cashout

## Observações
- O Socket.IO usa o token do localStorage no handshake.
- Após login/logout o socket é desconectado para reconectar com token novo.
# poker-client
