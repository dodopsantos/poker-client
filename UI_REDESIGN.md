# Frontend - UI/UX Premium

Redesign completo do frontend com design system profissional, animações suaves e experiência de usuário polida.

---

## 🎨 Design System

### Cores
- **Background**: Tema dark com gradientes sutis (#0a0e13 → #1e2730)
- **Felt green**: Mesa de poker realista (#0d5c3a com gradiente radial)
- **Accents**: Blue (#3b82f6), Green (#22c55e), Gold (#f59e0b)
- **States**: Success, Warning, Danger, Info

### Tipografia
- **Font**: System fonts (SF Pro, Segoe UI, Roboto)
- **Weights**: 500 (medium), 600 (semibold), 700 (bold)
- **Sizes**: 12px → 32px com escala consistente

### Espaçamento
- Sistema de 4px base (--space-1 a --space-12)
- Grid responsivo com auto-fit

### Animações
- **Transitions**: Fast (150ms), Base (250ms), Slow (350ms)
- **Curves**: Cubic-bezier easing para suavidade
- **Keyframes**: fadeIn, slideUp, slideDown, pulse, glow

---

## 🏠 Lobby Redesign

### Header Premium
- Gradient background
- Stats em tempo real (Mesas Ativas, Jogadores Online, Mesas em Jogo)
- Botões de ação destacados

### Table Cards
- **Visual hierárquico**: Header verde com gradiente (felt), body com stats, footer com CTA
- **Stakes badge**: Destaque visual para blinds
- **Status indicator**: Badge animado com pulse (verde/azul/amarelo)
- **Players dots**: Indicador visual de ocupação
- **Hover states**: Elevação com shadow, transform translateY
- **Estados**: Disponível, Em jogo, Mesa cheia

### Empty State
- Ilustração com ícone grande
- Call-to-action clara para criar primeira mesa
- Design amigável e convidativo

### Loading States
- Skeleton screens durante carregamento
- Shimmer animation

---

## 🃏 Poker Table Redesign

### Mesa
- **Felt realista**: Gradiente radial verde escuro → claro
- **Bordas**: Border dupla com efeito 3D
- **Sombras**: Inset + drop shadow para profundidade
- **Proporção**: Aspect ratio 16:10 (oval profissional)

### Seats
- **Tamanhos variados**: Hero (140px), Top (120px), Corner/Bottom (120-130px)
- **Estados visuais**:
  - Empty: Opacity 0.4, hover scale 1.05
  - Active: Border verde
  - Turn: Border azul com glow animation pulsante
  - Dealer: Badge "D" dourado posicionado top-right
- **Timer visual**: Progress bar de 4px com cores (azul → amarelo → vermelho)
- **Bets**: Floating badges com chip icon, background escuro

### Board & Pot
- **Board area**: Centralizado, flexbox com gap
- **Pot display**: Badge dourado com pulse animation, shadow colorida
- **Positioning**: Absolute dentro do felt

### Action Overlay
- **Posição**: Fixed bottom, gradient fade-in no topo
- **Animação**: slideUpFade ao aparecer
- **Botões principais**: Fold (vermelho), Check (neutro), Call (azul), All-in (verde)
- **Slider de raise**:
  - Track de 8px com thumb de 24px
  - Presets buttons (Mín, Pote, Máx)
  - Hover states no thumb (scale 1.1)
- **Responsivo**: Wrap em mobile, mantém usabilidade

### Waiting Toast
- **Posição**: Fixed top-center
- **Animação**: slideDown
- **Info**: "Aguardando seat X" ou "Dealer distribuindo board"
- **Sit-out indicator**: Badge laranja quando aplicável

---

## 📱 Responsividade

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Mobile Adaptations
- **Lobby**: Grid de 1 coluna
- **Table**: Min-height reduzido (500px)
- **Actions**: Botões em 2 colunas (50% width cada)
- **Stats**: Flex-wrap com gap reduzido

---

## ✨ Micro-interações

### Hover States
- **Cards**: translateY(-4px) + shadow-xl
- **Buttons**: translateY(-1px), escurecimento
- **Seats**: scale(1.05) quando vazio

### Active States
- **Buttons**: scale(0.95) no click
- **Inputs**: Border accent-blue no focus

### Loading
- **Skeleton**: Shimmer gradient animation
- **Spinner**: Rotate 360deg contínuo

### Feedback Visual
- **Toast**: Auto-dismiss 4s, slide animations
- **Modal**: Backdrop blur + scale animation
- **Turn timer**: Color transition (blue → yellow → red)
- **Pot**: Pulse animation contínua

---

## 🎯 Componentes Novos

### TableCard
- Props: id, name, blinds, maxPlayers, status, players
- Render: Header verde, stats grid, players dots, join button
- Estados: disponível, em jogo, cheia

### Toast (já existente, melhorado)
- Tipos: error, info, success
- Auto-dismiss configurável
- Posição: fixed top-right
- Animação: slideIn

---

## 🚀 Performance

### Otimizações CSS
- Custom properties (CSS variables) para temas
- Transitions apenas em propriedades baratas (transform, opacity)
- Will-change evitado (só quando necessário)
- Animações GPU-accelerated

### Bundle Size
- Design system modular (3 arquivos CSS separados)
- Remoção de globals.css antigo (883 linhas → ~600 linhas otimizadas)

---

## 📦 Arquivos

### CSS
- `app/design-system.css` — Core design tokens
- `app/lobby.css` — Lobby-specific styles
- `app/poker-table.css` — Table-specific styles

### Componentes
- `src/components/TableCard.tsx` — Card de mesa premium
- `src/components/Toast.tsx` — Sistema de notificações

### Pages
- `app/lobby/page.tsx` — Lobby redesenhado
- `app/table/[tableId]/page.tsx` — Mesa com novo design (já atualizado anteriormente)

---

## 🎨 Paleta de Cores

```css
--bg-primary: #0a0e13 (Background principal)
--bg-card: #1a2028 (Cards)
--felt-green: #0d5c3a (Mesa de poker)
--accent-blue: #3b82f6 (Ações, turn)
--accent-green: #22c55e (Success)
--accent-gold: #f59e0b (Pot, stakes)
--danger: #ef4444 (Fold)
--text-primary: #f8fafc (Texto)
```

---

## 🔄 Migration

1. ✅ Design system criado
2. ✅ Lobby redesenhado
3. ✅ Table cards premium
4. ⚠️ **Table page**: Precisa aplicar classes do novo CSS

### Próximos Passos

A página da mesa (`app/table/[tableId]/page.tsx`) já está com a lógica completa (rebuy, sit-out, toast, etc), mas precisa ser atualizada para usar as novas classes CSS:

**Substituir classes antigas:**
- `.tablePage` → `.table-page`
- `.actionOverlay` → `.action-overlay`
- `.actionRow` → `.action-buttons`
- `.btn actionBtn*` → `.action-btn action-btn-*`
- `.actionRaise` → `.action-slider-section`
- `.turnToast` → `.waiting-toast`

**Adicionar wrappers:**
- Wrap table visual em `.poker-stage > .poker-table-wrap > .poker-table`
- Board cards em `.board-area`
- Pot em `.pot-display`

Ou usar o PokerTableView component que já deve ter essas classes.

---

**Status**: ✅ Design system completo, lobby premium, pronto para aplicar no table view
