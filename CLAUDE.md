# CLAUDE.md — Radar

Sistema de controle de compromissos para líderes técnicos (capturar → triar →
delegar com checkpoint → registrar → medir carga). Monorepo: `apps/api`
(Node + TypeScript), `apps/web` (React + Vite), MySQL 8, `e2e/` (Playwright).

## Documentos normativos (leia antes de implementar)

Toda regra de negócio, contrato e decisão de UI vive em `docs/`:

- `docs/01-dominio.md` — entidades, estados, invariantes I-01…I-12, cenários C-01…C-05. **Prevalece sobre todos os outros.**
- `docs/02-dados.md` — schema MySQL, queries canônicas, matriz invariante → mecanismo.
- `docs/03-api.md` — contratos REST, formato de erro, mapa rota → invariante.
- `docs/04-frontend.md` — telas, React Query, mapa de 422, tokens visuais.
- `docs/features/NNN-*.md` — fatias de trabalho. Implemente UMA por vez, respeitando o §"Fora" de cada uma.
- `docs/decisoes/` — ADRs. Toda escolha técnica relevante ganha um arquivo numerado.
- `prototype/radar-compromissos.html` — referência visual e de comportamento da UI.

Em conflito entre código, feature e documentos base: domínio > dados/api/frontend > feature > código. Se uma feature exigir mudar um documento base, a emenda é parte do entregável (ver feature 003 §2 como modelo).

## Regras invioláveis

1. `registro_entradas` é append-only: NUNCA criar UPDATE/DELETE (query, endpoint, mutação ou UI) para entradas de registro (I-05).
2. Atraso, carga e afins são DERIVADOS: nunca criar coluna persistindo `atrasada`, `checkpoint_vencido`, `carga` etc. (I-06); o frontend nunca recalcula o que a API devolve (I-11).
3. Erros de invariante: HTTP 422 com `{ "erro": "I-NN", "mensagem": "..." }`. Testes referenciam invariantes e cenários pelo ID (`i02.*.test.ts`, `c01-*.spec.ts`).
4. Escopo: nada do §"Fora" de uma feature ou do §9 dos documentos entra "de passagem". Em dúvida, pare e pergunte — não implemente.
5. Mutações que tocam compromisso + registro são transacionais; entrada automática só quando o valor realmente muda.
6. Datas de negócio são `DATE` puras; "hoje" é calculado no fuso do usuário uma vez por requisição e parametrizado nas queries — nunca `CURDATE()`.

## Convenções

- Linguagem ubíqua em pt-BR no domínio: "compromisso" (nunca "tarefa"), "triagem", "checkpoint", "dono", "carga", "registro".
- TypeScript estrito nos dois apps. JSON em camelCase; banco em snake_case; o mapeamento é da camada de persistência.
- API: módulos por agregado (`compromissos/`, `registro/`, `auth/`) com router, service, repo e validadores juntos.
- Web: estado de servidor só em React Query (chaves e invalidação: `04-frontend.md` §4); sem Redux/Zustand; estilos com CSS modules + tokens do §7.

## Comandos

```
# 1. Subir o banco (MySQL 8 + usuário radar_app + GRANTs I-05)
docker compose up -d

# 2. Instalar dependências (root — propaga para todos os workspaces)
npm install

# 3. Aplicar migrations (Kysely Migrator)
npm run migrate

# 4. Carregar seed de desenvolvimento (3 compromissos canônicos)
npm run seed

# 5. Subir api (porta 3000) + web (porta 5173) em modo dev
npm run dev

# 6. Testes de unidade + integração (Vitest — requer banco rodando)
npm test

# 7. Testes E2E (Playwright — requer `npm run dev` ativo)
npm run e2e
```

**Stack:** Fastify v4 (API) · Kysely + mysql2 (banco) · React + Vite (web) · Playwright (e2e).
ADRs: `docs/decisoes/001-kysely-query-builder.md`, `docs/decisoes/002-fastify-framework-http.md`.

## Fluxo de trabalho

- Plan mode antes de qualquer mudança multi-arquivo; uma etapa da feature por sessão, com o gate da etapa verde antes de encerrar.
- Ao final de cada feature: revisão do diff em contexto limpo contra a spec da feature, com atenção explícita ao escopo.
- Migrations são imutáveis após merge; mudou de ideia, nova migration.