# Feature 001 — Captura e triagem (primeira fatia vertical)

> Spec de feature. Recorta a primeira fatia funcional de ponta a ponta:
> MySQL → API → React. Inclui a fundação do repositório, porque é a primeira.
> Documentos normativos: `01-dominio.md` (regras), `02-dados.md` (schema),
> `03-api.md` (contratos), `04-frontend.md` (UI). Esta spec só **seleciona e
> sequencia** o que eles definem — não redefine nada. Em conflito, eles prevalecem.

---

## 1. Objetivo

Ao final desta fatia, um usuário consegue: criar conta, entrar, **capturar** uma
demanda só com o título, vê-la na **fila de triagem**, decidir (Fazer / Delegar /
Adiar / Descartar) e ver o item aparecer na lista de ativos com a entrada
automática correta no registro. Tudo persistido no MySQL, validado pelas
invariantes, testado de ponta a ponta.

Valor da fatia: prova o esqueleto inteiro (migrations, auth, transações com
registro automático, validação 422 com ID de invariante, React Query, fluxo de
formulário) no menor escopo funcional possível. Todas as fatias seguintes só
acrescentam músculo a esse esqueleto.

---

## 2. Escopo

### 2.1 Dentro

**Fundação (só nesta fatia, por ser a primeira):**
- Estrutura do repositório (§5), tooling (TS estrito, ESLint, Prettier, Vitest),
  docker-compose com MySQL 8, variáveis de ambiente documentadas em `.env.example`.
- Migrations: `usuarios`, `compromissos`, `registro_entradas` + índices
  (`02-dados.md` §3.1, §3.2, §3.4, §7) e o GRANT de imutabilidade (§3.4).
  A tabela `referencias` fica para a feature 002.
- Seed de desenvolvimento (`02-dados.md` §8) — sem as referências.
- Auth mínima: `POST /auth/registro` e `POST /auth/login` (`03-api.md` §3),
  middleware de Bearer token.

**A feature em si:**

| Camada | Itens |
|---|---|
| API | `POST /compromissos` (captura) · `GET /compromissos/triagem` · `POST /compromissos/:id/triagem` (4 decisões) · `GET /compromissos?filtro=ativas` |
| Domínio/serviço | Invariantes I-01, I-02, I-03, I-04, I-07, I-09 (descarte via triagem), I-10; entradas automáticas de captura e triagem (`01-dominio.md` §6); transações captura/triagem |
| Frontend | Telas `/login` e `/registro`; `AppShell`; `CaptureBar` (fluxo §5.1 do frontend); `TriageQueue` + `DelegarPopover` (fluxo §5.2); `CommitmentList` somente com o filtro Ativas, linhas **não clicáveis**; mapa de 422 (§5.3) para I-01/I-02/I-04; estados de tela (§6) nas superfícies desta fatia |

### 2.2 Fora (explícito — NÃO implementar nem "deixar pronto")

- Ficha/drawer, `PATCH /compromissos/:id`, rota `/compromissos/:id` → feature 002.
- Referências (tabela, endpoints, UI) → feature 002.
- Anotação manual no registro (`POST /:id/registro`) e exibição do registro →
  feature 002. (As entradas automáticas SÃO gravadas nesta fatia — apenas não há
  UI para vê-las; verificação por teste de integração.)
- `POST /:id/concluir` e `POST /:id/descartar` independentes → feature 002.
- `GET /metricas`, `MetricsBar`, `CargaGauge`, demais filtros e flags de
  vencimento na lista → feature 003.
- Qualquer item do §9 dos documentos normativos.

Se durante a implementação algo de fora parecer "necessário", parar e registrar a
dúvida — não implementar.

---

## 3. Critérios de aceite

Os cenários canônicos **C-01** e **C-02** (`01-dominio.md` §10) na íntegra, mais:

- **A-01.** Usuário cria conta, recebe token e cai no painel autenticado; refresh
  da página mantém a sessão; token inválido redireciona a `/login`.
- **A-02.** Captura em rajada: enviar 3 títulos seguidos mantém o foco no input e
  a fila de triagem exibe os 3 em ordem FIFO.
- **A-03.** Decisão Fazer: item sai da fila, aparece em Ativas com dono `Eu` e
  registro contém `Capturada.` + `Triagem: execução própria.` (verificado via
  teste de integração — sem UI de registro nesta fatia).
- **A-04.** Decisão Delegar com checkpoint ≥ prazo: API responde 422 `I-02`, o
  popover destaca o campo checkpoint com a mensagem do mapa §5.3, nada é
  persistido (transação revertida).
- **A-05.** Decisão Adiar sem prazo: o submit nem habilita (validação preventiva);
  forçando via API, 422 `I-04`.
- **A-06.** Decisão Descartar: `confirm`, item some da fila, `descartada_em`
  preenchido, entrada automática gravada; o item NÃO aparece em Ativas (I-09).
- **A-07.** Item em triagem não aparece em `GET /compromissos?filtro=ativas`
  (I-07).
- **A-08.** Tentativa de UPDATE/DELETE em `registro_entradas` com a conexão da
  aplicação falha por privilégio (I-05 — teste de integração contra o GRANT).
- **A-09.** Acessar a API com token de outro usuário não enxerga compromissos
  alheios (404, `03-api.md` §1).

---

## 4. Plano de testes

| Tipo | Conteúdo |
|---|---|
| Unidade (serviço) | Validador de triagem: matriz decisão × campos cobrindo I-02, I-03, I-04; normalização de `dono` ("Eu", " eu ", "EU"). |
| Integração (API + MySQL real via docker) | Um teste por linha do mapa rota→invariante (`03-api.md` §8) no escopo desta fatia, nomeados pelo ID (`i02.delegar-sem-checkpoint.test.ts`); A-08; A-09; transacionalidade de A-04 (nada persiste após 422). |
| Componente (React) | `DelegarPopover` (habilitação do submit, mapa de 422), `CaptureBar` (rajada, input vazio desabilitado), `TriageQueue` (4 decisões). |
| E2E (Playwright) | `c01-captura.spec.ts` e `c02-triagem.spec.ts`, contra a stack completa com seed. |

---

## 5. Estrutura do repositório (criada nesta fatia)

```
radar/
├── CLAUDE.md
├── docs/                  # estes documentos
├── docker-compose.yml     # mysql:8 + volumes
├── apps/
│   ├── api/               # Node + TS (Express ou Fastify — registrar a escolha
│   │   ├── src/           #   em docs/decisoes/002-framework-http.md)
│   │   │   ├── auth/
│   │   │   ├── compromissos/   # router, service, repo, validadores por módulo
│   │   │   ├── registro/       # repo append-only (criar/listar apenas)
│   │   │   └── infra/          # db, migrations, config, middleware
│   │   └── test/
│   └── web/               # React + Vite
│       ├── src/
│       │   ├── api/       # cliente http + hooks React Query
│       │   ├── types/     # espelho de 03-api.md
│       │   ├── pages/     # Login, Registro, Painel
│       │   └── components/
│       └── test/
└── e2e/                   # Playwright
```

Monorepo com npm workspaces. Sem pacote compartilhado na v1 — os tipos do web são
espelho declarado da spec, não import do servidor (simplicidade > DRY nesta
escala; revisitar em `decisoes/` se doer).

---

## 6. Sequência de execução sugerida (sessões de Claude Code)

Uma sessão por etapa, contexto limpo, plan mode antes de cada uma; ao final de
cada etapa, os testes daquela etapa passam (gate):

1. **Fundação**: scaffold do monorepo, docker-compose, migrations + GRANT, seed,
   tooling. Gate: `docker compose up` + migrations + lint + um teste trivial verde.
2. **Auth**: endpoints, middleware, telas de login/registro. Gate: A-01.
3. **Captura + fila (API)**: `POST /compromissos`, `GET /triagem`, entradas
   automáticas. Gate: testes de integração de I-01/I-07 + parte de A-03.
4. **Triagem (API)**: `POST /:id/triagem`, 4 decisões, transações. Gate: testes
   I-02/I-04/I-09, A-04 (transacionalidade), A-08, A-09.
5. **Frontend da fatia**: CaptureBar, TriageQueue, DelegarPopover, lista Ativas,
   mapa de 422. Gate: testes de componente + A-02.
6. **E2E + revisão**: c01 e c02 verdes; sessão de revisão em contexto limpo
   comparando o diff total contra esta spec, com atenção ao §2.2 (escopo).

---

## 7. Definição de pronto da feature

- Todos os critérios A-01…A-09 + C-01 + C-02 verificados por teste automatizado.
- Nenhum item do §2.2 implementado.
- `README` com subida do ambiente em ≤ 5 comandos.
- Revisão independente (etapa 6) sem achados pendentes.
- `CLAUDE.md` atualizado com os comandos reais de build/test/migrate que passaram
  a existir.

---

## 8. Riscos e perguntas em aberto

- **Framework HTTP** (Express vs Fastify): decidir na etapa 1 e registrar ADR.
  Critério: o que a equipe (você) prefere manter; ambos atendem.
- **ORM vs SQL direto**: as queries canônicas de `02-dados.md` §6 sugerem SQL
  explícito (ex.: Kysely/knex) em vez de ORM pesado; decidir na etapa 1, ADR.
- **GRANT em desenvolvimento**: docker-compose precisa criar o usuário
  `radar_app` com os privilégios corretos já no init — incluir script SQL de
  inicialização para A-08 ser testável desde o começo.