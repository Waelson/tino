# 04 — Frontend: telas, estados e fluxos (React)

> Documento normativo. Define rotas, árvore de componentes, gestão de estado,
> fluxos de interação e estados de tela do cliente React. O protótipo
> `radar-compromissos.html` é a **referência visual e de comportamento** da v1 —
> em dúvida de layout ou microinteração, reproduzir o protótipo. Em regra de
> negócio, `01-dominio.md` prevalece sobre tudo.

---

## 1. Stack e convenções

| Tema | Convenção |
|---|---|
| Base | React 18+ + TypeScript estrito (`strict: true`), Vite. |
| Estado de servidor | TanStack Query (React Query). NENHUM dado vindo da API é copiado para estado global próprio. |
| Estado local | `useState`/`useReducer` por componente. NÃO introduzir Redux/Zustand na v1. |
| Roteamento | React Router. A ficha é dirigida por rota (deep-link). |
| Estilo | CSS modules + variáveis CSS globais com os tokens do protótipo (§7). Sem framework de UI pronto na v1 — a identidade visual já existe. |
| HTTP | Cliente único (`api.ts`) que injeta o Bearer token, converte erros para `ApiError { status, erro, mensagem }` e desloga em 401. |
| Tipos | Os shapes de `03-api.md` viram tipos TS em `src/types/` (`Compromisso`, `CompromissoDetalhe`, `Metricas`, …), espelhados 1:1. |
| Regra de ouro | A UI NUNCA recalcula `checkpointVencido`, `prazoEstourado`, `precisaAtencao`, `comigo`, `carga` (I-06/I-11). Exibe o que a API devolve. A única lógica de domínio permitida no cliente é validação preventiva de formulário (§5.3), e o servidor continua sendo a fonte da verdade. |

---

## 2. Rotas

| Rota | Tela | Acesso |
|---|---|---|
| `/login` | Login | pública |
| `/registro` | Criação de conta | pública |
| `/` | Painel (tela única do produto) | autenticada |
| `/compromissos/:id` | Painel com a ficha aberta em drawer sobre a lista | autenticada |

Autenticada sem token → redireciona a `/login` preservando a rota de retorno.
Fechar o drawer navega de volta a `/` mantendo filtro e scroll da lista.
`/compromissos/:id` com 404 da API → fecha o drawer e exibe toast "Compromisso não
encontrado".

---

## 3. Árvore de componentes (Painel)

```
<AppShell>                       header: marca + nome do usuário + sair
  <MetricsBar>                   4 cartões — dados de GET /metricas
    <MetricCard> ×3              ativos / checkpoints vencidos / prazos estourados
    <CargaGauge>                 barra com marca fixa em 30% (§7.3)
  <CaptureBar>                   input + botão "Capturar"
  <TriageQueue>                  visível só se aguardandoTriagem > 0
    <TriageItem> ×N              título + 4 botões (Fazer/Delegar/Adiar/Descartar)
    <DelegarPopover>             mini-form dono/prazo/checkpoint (§5.2)
  <FilterChips>                  Ativas · Comigo · Delegadas · Atenção · Concluídas
  <CommitmentList>               tabela (desktop) / cards (mobile)
    <CommitmentRow> ×N           título + flags, dono, tipo, prazo, checkpoint, status
  <EmptyState>                   quando a listagem do filtro vier vazia
<CommitmentDrawer>               rota /compromissos/:id — GET /compromissos/:id
  <FichaHeader>                  id, data de captura, fechar (Esc / overlay / ✕)
  <FichaForm>                    titulo, dono, tipo, prazo, checkpoint, status
  <RefSection>                   lista de referências + form de adição
  <LogSection>                   form de anotação + linha do tempo (somente leitura)
  <FichaFooter>                  "Concluir compromisso" + "Descartar"
<Toast>                          notificações globais (sucesso/erro)
```

Nomes de componentes podem variar; a decomposição e as responsabilidades não.

---

## 4. Estado de servidor (React Query)

### 4.1 Chaves de query

| Chave | Endpoint |
|---|---|
| `['metricas']` | `GET /metricas` |
| `['compromissos', filtro]` | `GET /compromissos?filtro=` |
| `['triagem']` | `GET /compromissos/triagem` |
| `['compromisso', id]` | `GET /compromissos/:id` |

### 4.2 Mapa de invalidação (obrigatório)

Toda mutação bem-sucedida invalida exatamente:

| Mutação | Invalida |
|---|---|
| capturar | `['triagem']`, `['metricas']` |
| triagem (qualquer decisão) | `['triagem']`, `['compromissos']`*, `['metricas']` |
| PATCH ficha | `['compromisso', id]`, `['compromissos']`*, `['metricas']` |
| concluir / descartar | `['compromisso', id]`, `['compromissos']`*, `['metricas']` |
| referência (criar/remover) | `['compromisso', id]` |
| anotação no registro | `['compromisso', id]` |

\* prefixo — invalida todos os filtros em cache.

Sem updates otimistas na v1: invalidar e refetch é suficiente para o volume, e
elimina toda reconciliação manual. (Exceção única: §5.1.)

---

## 5. Fluxos de interação

### 5.1 Captura (C-01)

Enter ou clique em Capturar → `POST /compromissos` → limpa o input, foco
permanece nele (captura em rajada), toast "Capturada. Faça a triagem quando puder."
A fila de triagem PODE inserir o item otimisticamente (é append FIFO trivial);
rollback em erro. Input vazio: botão desabilitado — não chamar a API para receber
I-01.

### 5.2 Triagem (C-02)

Fazer e Adiar: um clique → `POST /:id/triagem` (Adiar abre antes um date-picker
de prazo, obrigatório — I-04). Delegar: abre `DelegarPopover` com dono, prazo e
checkpoint, todos obrigatórios; o submit só habilita com os três preenchidos e
checkpoint < prazo (validação preventiva); 422 do servidor mapeia para o campo
(§5.3). Descartar: `confirm` nativo na v1 → `POST /:id/triagem` com `descartar`.
Após Fazer/Delegar/Adiar, navegar para `/compromissos/:id` (ficha aberta para
complementar) — exceto Descartar, que apenas remove da fila.

### 5.3 Tratamento de 422 (padrão único)

O cliente mantém um mapa `erro → { campo?, mensagem }`:

| `erro` | campo destacado | mensagem exibida |
|---|---|---|
| `I-01` | titulo | "Descreva o resultado esperado." |
| `I-02` | checkpoint (ou o ausente) | "Delegação exige dono, prazo e checkpoint anterior ao prazo." |
| `I-04` | prazo | "Adiar exige uma nova data." |
| `I-12` | url | "Use um link http(s) válido." |
| demais | — | exibe `mensagem` da API em toast |

A mensagem da API nunca é descartada silenciosamente.

### 5.4 Ficha (C-04)

Campos salvam **no blur/change** (`PATCH` por campo alterado), como no protótipo —
sem botão "Salvar". Indicador discreto de salvamento por campo (✓ breve / erro
inline). `tipo = fazer` trava o campo dono em "Eu" (I-03). O registro: textarea +
"Adicionar ao registro"; entradas exibidas mais recente primeiro, sem qualquer
affordance de edição ou exclusão (I-05) — nem ícone desabilitado: ausência total.
Concluir: botão primário → `POST /:id/concluir` → fecha drawer + toast.
Descartar: `confirm` → `POST /:id/descartar` → fecha drawer + toast.

### 5.5 Lista e flags (C-03)

`prazoEstourado` prevalece sobre `checkpointVencido` quando ambos (badge/flag
única, vermelha, texto "prazo estourado"; senão "checkpoint vencido"). Dono "Eu"
em peso 600. Linha inteira clicável → navega para a ficha; também acessível por
teclado (linha focável, Enter abre).

---

## 6. Estados de tela (obrigatórios em toda superfície)

| Estado | Comportamento |
|---|---|
| Carregando | Skeletons (3 linhas na lista, blocos nos cartões). NUNCA spinner de página inteira após o primeiro load. |
| Vazio | Lista sem itens no filtro: mensagem específica do filtro ("Nada precisa de atenção. Bom sinal." para Atenção; convite à captura para Ativas sem nenhum item). |
| Erro de rede | Bloco inline com "Tentar de novo" (refetch). Toast apenas para erros de mutação. |
| 401 em qualquer chamada | Limpa sessão e redireciona a `/login` com aviso "Sessão expirada". |

---

## 7. Especificação visual

### 7.1 Tokens (extraídos do protótipo — fonte da verdade visual)

```css
--bg:#F2F5F4; --surface:#FFF; --ink:#17231F; --muted:#5C6B66;
--line:#DBE3E0; --accent:#0E6E5C; --accent-ink:#0A5246; --accent-soft:#E0F0EB;
```
Tipografia: Archivo (interface) + IBM Plex Mono (datas, números, IDs).
Status badges (fundo/texto): nao_iniciada `#F1EFE8/#444441` · em_andamento
`#E6F1FB/#0C447C` · bloqueada e aguardando `#FAEEDA/#633806` · concluida
`#EAF3DE/#27500A`. Flag de atraso: `#A32D2D`.

### 7.2 Responsividade

Breakpoint único: 760px. Abaixo dele: métricas em grade 2×2; tabela vira lista de
cards (título + dono + prazo + badge; tipo e checkpoint ficam só na ficha); drawer
em largura total. Acima: tabela completa, drawer de 480px.

### 7.3 CargaGauge (componente-assinatura)

Barra horizontal com marca vertical fixa em 30%; preenchimento `--accent` até 30%
e vermelho quando `alertaCarga`; rótulo "Carga comigo: N%" e legenda "acima da
marca de 30%, delegue mais". Percentual e alerta vêm prontos da API (I-11) —
o componente recebe `{ carga, alertaCarga }` e não calcula nada.

### 7.4 Acessibilidade (piso de qualidade)

Foco visível em todo interativo; drawer com foco preso (focus trap), fecha com
Esc e devolve o foco à linha de origem; `aria-label` em botões de ícone; toasts
com `role="status"`; contraste AA nos pares de badge; `prefers-reduced-motion`
desliga a transição do gauge e a pulsação da marca.

---

## 8. Testes do cliente

- **Componentes** (Vitest + Testing Library): CargaGauge (30%, 31%, 0 ativos),
  mapa de 422 (§5.3), TriageQueue (4 decisões), LogSection (ausência de controles
  de edição — I-05).
- **E2E** (Playwright, contra API real de desenvolvimento + seed): um spec por
  cenário canônico, nomeados `c01-captura.spec.ts` … `c05-carga.spec.ts`,
  reproduzindo literalmente C-01…C-05 do domínio.
- O mapa de invalidação (§4.2) é testado indiretamente pelos E2E: após cada
  mutação, a tela DEVE refletir o novo estado sem reload manual.

---

## 9. Fora do escopo da v1 (frontend)

- Dark mode, i18n (texto direto em pt-BR), PWA/offline, atalhos de teclado
  globais, drag-and-drop, animações além das do protótipo.
- Updates otimistas além da fila de triagem (§5.1).
- Preferências persistentes de UI (filtro padrão, densidade). O filtro selecionado
  vive em estado de URL (`?filtro=`) — sobrevive a refresh, e isso basta.