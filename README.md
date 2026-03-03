# Poker Frontend

Interface web do sistema de poker online com Next.js 14 e React.

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev

# 3. Abrir navegador
# http://localhost:3000
```

## Build para Produção

```bash
npm run build
npm start
```

## Principais Páginas

- `/login` - Login e registro
- `/lobby` - Lobby principal (lista de mesas)
- `/table/[id]` - Mesa de poker
- `/profile` - Perfil do usuário
- `/history` - Histórico de mãos
- `/leaderboard` - Rankings e estatísticas
- `/stats` - Estatísticas detalhadas

## Variáveis de Ambiente (opcional)

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```
