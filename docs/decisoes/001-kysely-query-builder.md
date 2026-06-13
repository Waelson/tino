# ADR 001 — Kysely como query builder para acesso ao banco

**Data:** 2026-06-12
**Status:** Aceito

---

## Contexto

O documento `02-dados.md` define queries canônicas em SQL explícito (§6) com
expressões derivadas calculadas em tempo de leitura (`checkpoint_vencido`,
`prazo_estourado`, `comigo`), `ORDER BY` composto e parâmetros nomeados. Eram
candidatos:

1. **ORM pesado (Prisma / TypeORM):** abstrai o SQL mas exige adaptadores para
   expressões derivadas e perde type-safety quando você escreve raw SQL — que
   aqui seria inevitável.
2. **mysql2 puro:** máximo controle, zero abstrações. Custo: nenhum type-safety
   nas colunas; erros de typo em nome de coluna aparecem apenas em runtime.
3. **Kysely:** query builder type-safe que escreve SQL estruturado em TypeScript.
   Sem geração de código, sem mágica de ORM. Suporta `sql` template tag para
   as partes que precisam de SQL literal (expressões derivadas do §6).

---

## Decisão

Adotar **Kysely** como única camada de acesso ao banco.

---

## Justificativa

- As queries canônicas do §6 mapeiam naturalmente para a API fluente do Kysely.
- O `sql` template tag cobre as expressões derivadas sem sair do tipo-safe.
- Sem geração de código: os tipos são declarados manualmente em `src/infra/db.ts`
  e refletem diretamente o schema de `02-dados.md §3`.
- Idempotência das migrations: `Kysely.Migrator` com `FileMigrationProvider`
  é a ferramenta nativa — sem dependência extra.
- mysql2 permanece como driver subjacente; Kysely é apenas o builder, não o
  cliente de conexão.

---

## Consequências

- O schema de tipos (`Database` em `src/infra/db.ts`) deve ser mantido sincronizado
  com as migrations. Se uma migration adiciona coluna, o tipo deve ser atualizado
  na mesma PR.
- SQL literal (`sql` tag) é necessário somente para as expressões derivadas das
  queries canônicas — o restante usa a API fluente.
- Sem suporte a `ENUM` nativo: enums são `VARCHAR` + `CHECK` no banco e union
  types em TypeScript, conforme convenção de `02-dados.md §1`.
