# Radar

Sistema de controle de compromissos para líderes técnicos. Responde em segundos às três perguntas do método: *O que está comigo?* *O que está atrasado?* *Minha carga está saudável?*

---

## Funcionalidades

- **Captura sem fricção** — título obrigatório, nada mais (I-01)
- **Triagem FIFO** — Fazer / Delegar / Adiar / Descartar
- **Delegação com checkpoint** — valida checkpoint < prazo (I-02)
- **Registro imutável** — entradas automáticas + anotações manuais; sem edição ou exclusão (I-05)
- **Métricas de carga** — ativos, checkpoints vencidos, prazos estourados, carga %, alerta acima de 30%
- **Filtros** — Ativas · Comigo · Delegadas · Atenção · Concluídas
- **Ficha deep-linkável** — `/compromissos/:id` abre o drawer diretamente

---

## Stack

| Camada | Tecnologia |
|---|---|
| API | Node.js · Fastify 4 · Kysely · MySQL 8 |
| Web | React 18 · Vite · TanStack Query · CSS Modules |
| Testes | Vitest (unit + integração) · Playwright (E2E) |
| Infra | Docker Compose · npm workspaces |

---

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose

---

## Subir o ambiente

```bash
# 1. Clonar e instalar dependências
git clone https://github.com/Waelson/tino.git
cd tino
npm install

# 2. Variáveis de ambiente
cp .env.example .env

# 3. Subir o banco (MySQL 8)
docker compose up -d

# 4. Aplicar migrations
npm run migrate

# 5. Carregar seed de desenvolvimento
npm run seed

# 6. Iniciar API (porta 3000) + Web (porta 5173)
npm run dev
```

Abrir em: `http://localhost:5173`
Login de seed: `test@radar.dev` / `senha123`

---

## Testes

```bash
# Unitários + integração (requer banco rodando)
npm test

# E2E (requer npm run dev ativo)
npm run e2e
```

| Suíte | Cobertura |
|---|---|
| Unit + integração (API) | 115 testes — 24 arquivos |
| Componente (Web) | 49 testes — 7 arquivos |
| E2E (Playwright) | 13 testes — C-01…C-05, A-10, A-11, A-16, A-20 |

---

## Estrutura

```
├── apps/
│   ├── api/          # Fastify — rotas, serviços, repositórios, migrations
│   └── web/          # React — componentes, páginas, queries
├── e2e/              # Playwright — cenários canônicos C-01…C-05
├── docs/             # Documentação normativa (domínio, dados, API, frontend)
│   ├── 01-dominio.md
│   ├── 02-dados.md
│   ├── 03-api.md
│   ├── 04-frontend.md
│   ├── features/     # Specs de feature (001–003)
│   └── decisoes/     # ADRs
├── docker/           # init.sql com GRANTs de imutabilidade (I-05)
└── prototype/        # radar-compromissos.html — referência visual
```

---

## Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/01-dominio.md` | Entidades, estados, invariantes I-01…I-12, cenários C-01…C-05 |
| `docs/02-dados.md` | Schema MySQL, queries canônicas, matriz invariante → mecanismo |
| `docs/03-api.md` | Contratos REST, formato de erro, mapa rota → invariante |
| `docs/04-frontend.md` | Telas, React Query, tokens visuais, fluxos de interação |

Em conflito entre código e documentos: **domínio > dados/api/frontend > feature > código**.
