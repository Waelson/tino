# Feature 004 — Busca por resultado esperado

## 1. Contexto

"Resultado esperado" é o `titulo` do compromisso (domínio §2). A feature
adiciona busca textual parcial, ortogonal ao filtro existente, para localizar
um compromisso pelo que foi combinado.

Emenda: remove "busca textual" do §9 (Fora de escopo) de `03-api.md` e
`04-frontend.md`.

---

## 2. Escopo

**Dentro:**
- Parâmetro `?q=` em `GET /compromissos` — busca case-insensitive por substring no `titulo`
- Ortogonal ao `filtro`: `?filtro=delegadas&q=billing` retorna a intersecção
- URL state: `?q=` coexiste com `?filtro=` e sobrevive a refresh
- Debounce de 300 ms no input
- Empty state específico: "Nenhum compromisso com esse resultado esperado."

**Fora:**
- Busca em `dono`, `registro` ou `referencias`
- Busca booleana / full-text (FULLTEXT index) — LIKE é suficiente para o volume da v1

---

## 3. Contrato de API

```
GET /compromissos?filtro=ativas&q=billing
```

| Parâmetro | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `filtro` | enum | não | `ativas` (default) \| `comigo` \| `delegadas` \| `atencao` \| `concluidas` |
| `q` | string | não | ≤ 280 chars; vazio ou ausente = sem filtro de busca |

Resposta: `200 { "itens": [...] }` — mesmo shape de antes, apenas subconjunto dos itens.

---

## 4. Frontend

- `<SearchBar>` entre `<FilterChips>` e `<CommitmentList>` no Painel
- Input atualiza `?q=` na URL com debounce de 300 ms
- Trocar filtro preserva `?q=` na URL
- `CommitmentList` lê `?q=`, inclui na query key: `['compromissos', filtro, q]`
- Empty state quando busca não encontra nada: "Nenhum compromisso com esse resultado esperado."

---

## 5. Testes

- Integração: `busca.list.test.ts` — `?q=`, case-insensitive, combinação com filtro, vazio, sem match
- Componente: `SearchBar.test.tsx` — debounce, atualiza URL, limpa URL
