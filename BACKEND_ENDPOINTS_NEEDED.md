# Backend Endpoints Necessários para Hand History

O frontend está pronto, mas o backend precisa dos seguintes endpoints:

---

## 1. GET /history/me

**Descrição:** Retorna o histórico de mãos do usuário logado

**Auth:** requireAuth

**Query params:**
- `limit` (opcional): número de mãos (default: 50, max: 100)
- `offset` (opcional): paginação (default: 0)

**Response:**
```json
{
  "history": [
    {
      "id": "uuid",
      "handId": "timestamp-based",
      "tableId": "uuid",
      "dealerSeat": 1,
      "smallBlind": 10,
      "bigBlind": 20,
      "players": [
        {
          "seatNo": 1,
          "userId": "uuid",
          "username": "Player1",
          "startStack": 1000,
          "endStack": 1200,
          "committed": 200,
          "payout": 400
        }
      ],
      "board": ["AS", "KH", "QD", "JC", "TS"],
      "result": {
        "winners": [
          {
            "seatNo": 1,
            "userId": "uuid",
            "payout": 400,
            "handRank": "Royal Flush"
          }
        ]
      },
      "actions": [
        {
          "round": "PREFLOP",
          "seatNo": 1,
          "action": "raise",
          "amount": 40
        }
      ],
      "createdAt": "2026-02-24T10:30:00Z"
    }
  ]
}
```

**Implementação:**
```typescript
// index.ts
app.get("/history/me", requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).user.userId;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  const history = await prisma.handHistory.findMany({
    where: {
      players: {
        path: '$[*].userId',
        array_contains: userId
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });

  res.json({ history });
});
```

---

## 2. GET /hands/:handId

**Descrição:** Retorna detalhes de uma mão específica

**Auth:** requireAuth

**Response:**
```json
{
  "hand": {
    "id": "uuid",
    "handId": "timestamp-based",
    "tableId": "uuid",
    "dealerSeat": 1,
    "smallBlind": 10,
    "bigBlind": 20,
    "players": [...],
    "board": [...],
    "result": {...},
    "actions": [...],
    "createdAt": "2026-02-24T10:30:00Z"
  }
}
```

**Implementação:**
```typescript
// index.ts
app.get("/hands/:handId", requireAuth, async (req: express.Request, res: express.Response) => {
  const { handId } = req.params;
  
  const hand = await prisma.handHistory.findUnique({
    where: { handId }
  });
  
  if (!hand) {
    return res.status(404).json({ error: "Hand not found" });
  }
  
  res.json({ hand });
});
```

---

## 3. GET /tables/:tableId/history (Opcional - Futuro)

**Descrição:** Retorna histórico de uma mesa específica

**Auth:** requireAuth

**Query params:**
- `limit` (opcional): default 20, max 100
- `offset` (opcional): default 0

**Response:**
```json
{
  "history": [...]
}
```

**Implementação:**
```typescript
// index.ts
app.get("/tables/:tableId/history", requireAuth, async (req: express.Request, res: express.Response) => {
  const { tableId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const history = await getTableHandHistory({ tableId, limit, offset });
  
  res.json({ history });
});
```

---

## Como Adicionar ao Backend

### 1. Abrir `src/index.ts`

### 2. Adicionar após as rotas existentes (antes do Socket.IO):

```typescript
// Hand History routes
app.get("/history/me", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const history = await prisma.handHistory.findMany({
      where: {
        players: {
          path: '$[*].userId',
          array_contains: userId
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    res.json({ history });
  } catch (err: any) {
    console.error('[hand-history] Error:', err);
    res.status(500).json({ error: 'Failed to fetch hand history' });
  }
});

app.get("/hands/:handId", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { handId } = req.params;
    
    const hand = await prisma.handHistory.findUnique({
      where: { handId }
    });
    
    if (!hand) {
      return res.status(404).json({ error: 'Hand not found' });
    }
    
    res.json({ hand });
  } catch (err: any) {
    console.error('[hand-details] Error:', err);
    res.status(500).json({ error: 'Failed to fetch hand details' });
  }
});

app.get("/tables/:tableId/history", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { tableId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;

    const { getTableHandHistory } = await import('./services/hand-history.service');
    const history = await getTableHandHistory({ tableId, limit, offset });
    
    res.json({ history });
  } catch (err: any) {
    console.error('[table-history] Error:', err);
    res.status(500).json({ error: 'Failed to fetch table history' });
  }
});
```

### 3. Testar

```bash
# Restart backend
npm run dev

# Test endpoints
curl http://localhost:3001/history/me \
  -H "Authorization: Bearer YOUR_TOKEN"

curl http://localhost:3001/hands/HAND_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Verificação

Após adicionar os endpoints no backend:

1. ✅ Restart backend
2. ✅ Jogar algumas mãos
3. ✅ Ir para `/history` no frontend
4. ✅ Clicar em uma mão para ver detalhes
5. ✅ Verificar que tudo funciona

---

**Status:** Frontend pronto, backend precisa de 3 endpoints (30 min de trabalho)
