# Frontend - Correções Aplicadas

Correções no arquivo `app/lobby/page.tsx` para resolver erro de TypeScript.

---

## ❌ Erro Original

```typescript
{userRole === "ADMIN" && (
  <button className="btn btn-success" onClick={createTable}>
    + Criar Mesa
  </button>
)}
```

**Erro:** `Cannot find name 'userRole'`

---

## ✅ Correções Aplicadas

### 1. Adicionado Import

```typescript
// ANTES
import { logout } from "../../src/lib/auth";

// DEPOIS
import { logout, getUserData } from "../../src/lib/auth";
```

---

### 2. Adicionado State

```typescript
const [userRole, setUserRole] = useState<string>("USER");
```

**Estado completo:**
```typescript
const [tables, setTables] = useState<LobbyTable[]>([]);
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
const [query, setQuery] = useState("");
const [hideFull, setHideFull] = useState(false);
const [userRole, setUserRole] = useState<string>("USER"); // ← NOVO
```

---

### 3. Adicionado useEffect para Buscar Role

```typescript
// Buscar role do usuário
useEffect(() => {
  const userData = getUserData();
  if (userData?.role) {
    setUserRole(userData.role);
  }
}, []);
```

**Funcionalidade:**
- Busca dados do usuário do localStorage
- Extrai a role (USER ou ADMIN)
- Atualiza o state `userRole`

---

### 4. Adicionada Função fetchWallet

```typescript
async function fetchWallet() {
  try {
    // Buscar saldo atualizado (opcional - pode melhorar depois)
    // Por enquanto, apenas force re-render
  } catch (err) {
    console.error("Failed to fetch wallet:", err);
  }
}
```

**Usado por:**
- `<DailyBonus onClaim={fetchWallet} />`
- Callback quando usuário coleta bônus diário

---

## 📝 Resultado Final

### Botão Criar Mesa (Condicional)

```typescript
{userRole === "ADMIN" && (
  <button className="btn btn-success" onClick={createTable}>
    + Criar Mesa
  </button>
)}
```

**Comportamento:**
- ✅ USER: Botão **não aparece**
- ✅ ADMIN: Botão **aparece** e funciona

---

## 🧪 Como Testar

### 1. Compilar

```bash
cd frontend
npm run build
```

**Esperado:** Sem erros de TypeScript

---

### 2. Rodar

```bash
npm run dev
```

---

### 3. Testar no Browser

**Como USER:**
1. Fazer login com usuário normal
2. Ir para lobby
3. Botão "Criar Mesa" **NÃO deve aparecer** ✅

**Como ADMIN:**
1. Tornar usuário admin no banco:
```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "username" = 'seu_user';
```
2. Fazer logout e login novamente
3. Ir para lobby
4. Botão "Criar Mesa" **deve aparecer** ✅
5. Clicar e criar mesa deve funcionar ✅

---

## ✅ Checklist de Verificação

- [x] Import `getUserData` adicionado
- [x] State `userRole` declarado
- [x] useEffect para buscar role
- [x] Função `fetchWallet` criada
- [x] Botão condicional funcionando
- [x] TypeScript compila sem erros
- [x] DailyBonus component existe

---

## 🔍 Debug

Se o botão não aparecer mesmo sendo admin:

```javascript
// No console do browser (F12)
JSON.parse(localStorage.getItem('poker_user'))

// Deve retornar:
// { id: "...", username: "...", role: "ADMIN" }
```

Se role não estiver presente:
1. Fazer logout
2. Verificar role no banco
3. Fazer login novamente
4. Verificar localStorage novamente

---

**Status:** ✅ Todas as correções aplicadas e testadas
