# 03 — API: contratos REST

> Documento normativo. Define rotas, payloads, códigos de resposta e o catálogo de
> erros da API. Implementação de referência: Node.js + TypeScript. Toda rota DEVE
> respeitar as invariantes de `01-dominio.md` e usar as queries canônicas de
> `02-dados.md`. Em caso de conflito, o domínio prevalece.

---

## 1. Convenções

| Tema | Convenção |
|---|---|
| Base | `/api/v1` |
| Formato | JSON em request e response; `Content-Type: application/json`. |
| Autenticação | `Authorization: Bearer <JWT>` em todas as rotas exceto `/auth/*`. Token expira em 7 dias (v1). |
| Escopo | Toda rota opera implicitamente sobre o usuário do token. NÃO existe `usuario_id` em payload ou URL. Acessar compromisso de outro usuário responde **404** (não 403 — não vazar existência). |
| Datas de negócio | `prazo`, `checkpoint`, `data`: string `YYYY-MM-DD` (I-10). |
| Timestamps técnicos | `criadaEm`, `atualizadaEm`: ISO 8601 UTC (`2026-06-12T14:03:22.123Z`). |
| Nomes de campos | camelCase no JSON; o mapeamento para snake_case do banco é da camada de persistência. |
| Transições de domínio | São **ações** (`POST /compromissos/:id/triagem`, `/concluir`, `/descartar`), não edições genéricas — porque carregam semântica e entradas automáticas de registro (§6 do domínio). `PATCH` cobre apenas edição de campos. |
| Booleanos derivados | A API SEMPRE devolve `checkpointVencido`, `prazoEstourado`, `precisaAtencao`, `comigo` calculados (I-06, §5 do domínio). A UI não recalcula. |
| Paginação | Fora do escopo da v1 (volume previsto pequeno). Listagens retornam tudo. |
| Concorrência | Last-write-wins na v1. Lock otimista é evolução futura registrada em `decisoes/`. |
| Idempotência | `POST /concluir` e `/descartar` sobre item já no estado-alvo respondem **200** com o recurso inalterado (sem nova entrada de registro). |

### 1.1 Formato de erro (único para toda a API)

```json
{ "erro": "I-02", "mensagem": "Delegação exige checkpoint anterior ao prazo." }
```

| HTTP | `erro` | Quando |
|---|---|---|
| 400 | `REQUISICAO_INVALIDA` | JSON malformado, tipo de campo errado, enum desconhecido. |
| 401 | `NAO_AUTENTICADO` | Token ausente, inválido ou expirado. |
| 404 | `NAO_ENCONTRADO` | Recurso inexistente ou de outro usuário. |
| 409 | `ESTADO_INVALIDO` | Ação incompatível com o ciclo de vida (ex.: triagem de item já triado). |
| 422 | `I-01` … `I-12` | Violação de invariante do domínio. `erro` carrega o ID exato. |
| 500 | `ERRO_INTERNO` | Falha não tratada. Mensagem genérica; detalhes só em log do servidor. |

---

## 2. Representações

### 2.1 `Compromisso` (resumo — usado em listagens)

```json
{
  "id": 42,
  "titulo": "API de billing estável em produção",
  "dono": "Marina",
  "tipo": "delegada",
  "prazo": "2026-06-19",
  "checkpoint": "2026-06-16",
  "status": "em_andamento",
  "checkpointVencido": false,
  "prazoEstourado": false,
  "precisaAtencao": false,
  "comigo": false,
  "criadaEm": "2026-06-12T14:03:22.123Z",
  "atualizadaEm": "2026-06-12T14:03:22.123Z"
}
```

`tipo` pode ser `null` (aguardando triagem). Campos de data ausentes vêm como `null`.

### 2.2 `CompromissoDetalhe` (ficha — usado em `GET /compromissos/:id`)

`Compromisso` + duas coleções:

```json
{
  "...": "campos do resumo",
  "referencias": [
    { "id": 7, "descricao": "PR #142 — clarus-billing/export",
      "url": "https://github.com/...", "criadaEm": "..." }
  ],
  "registro": [
    { "id": 31, "data": "2026-06-12", "origem": "sistema",
      "texto": "Status: Em andamento → Bloqueada.", "criadaEm": "..." }
  ]
}
```

`registro` vem ordenado do mais recente para o mais antigo (`data DESC, id DESC`);
`referencias` em ordem de criação.

### 2.3 `Metricas`

```json
{
  "ativos": 10,
  "checkpointsVencidos": 1,
  "prazosEstourados": 1,
  "comigo": 4,
  "carga": 40,
  "alertaCarga": true,
  "aguardandoTriagem": 2,
  "precisamAtencao": 2
}
```

`precisamAtencao` = count(ativos com `precisa_atencao`) — contagem **distinta**
(um item bloqueado E com prazo estourado conta uma vez), conforme a definição de
`precisa_atencao` em `01-dominio.md` §5. Adicionado na feature 003.

---

## 3. Autenticação

### `POST /auth/registro`
Body: `{ "nome": "...", "email": "...", "senha": "..." }` (senha ≥ 8 chars).
**201** `{ "token": "...", "usuario": { "id", "nome", "email" } }`.
Erros: 400; **422 `EMAIL_EM_USO`**.

### `POST /auth/login`
Body: `{ "email": "...", "senha": "..." }`.
**200** mesmo shape do registro. Erro: **401 `CREDENCIAIS_INVALIDAS`** (mensagem
única para email inexistente e senha errada — não distinguir).

Hash de senha: argon2id ou bcrypt (custo ≥ 12). NUNCA logar senha ou token.

---

## 4. Compromissos

### `GET /compromissos?filtro=ativas`

`filtro` ∈ `ativas` (default) | `comigo` | `delegadas` | `atencao` | `concluidas`.
Semântica exata: §5 do domínio + query §6.1 de `02-dados.md`. Itens em triagem
(`tipo = null`) NUNCA aparecem aqui (I-07).
**200** `{ "itens": [Compromisso, ...] }` ordenado por urgência (prazo ASC com
nulos por último, depois criação DESC).

### `GET /compromissos/triagem`

Fila de entrada: itens com `tipo = null`, FIFO (criação ASC).
**200** `{ "itens": [Compromisso, ...] }`.

### `POST /compromissos` — captura (C-01)

Body: `{ "titulo": "Resultado esperado..." }` — nenhum outro campo é aceito; campos
extras respondem 400.
Efeitos (transação): cria com `tipo=null`, `status=nao_iniciada`; grava entrada
automática `Capturada.`.
**201** `Compromisso`. Erros: **422 `I-01`** (título vazio).

### `GET /compromissos/:id`

**200** `CompromissoDetalhe`. Compromisso descartado responde **404** (I-09).

### `PATCH /compromissos/:id` — edição de campos

Body parcial; campos aceitos: `titulo`, `dono`, `prazo`, `checkpoint`, `status`,
`tipo`. Validação do **estado resultante** contra I-01…I-04 (ex.: se o item é
`delegada` e o PATCH remove o checkpoint → **422 `I-02`**).
Efeitos colaterais (transação, conforme §6 do domínio): mudanças de status, prazo,
checkpoint ou dono com valor anterior geram entradas automáticas; `status` →
`concluida` via PATCH equivale a `/concluir` (I-08); `tipo=fazer` força `dono="Eu"`
ignorando o valor enviado (I-03).
**200** `Compromisso` atualizado. Erros: 404; **422** com o ID da invariante.

### `POST /compromissos/:id/triagem` — decisão de triagem

Pré-condição: item com `tipo = null`; caso contrário **409 `ESTADO_INVALIDO`**.

Body por decisão:

| decisão | body | validações |
|---|---|---|
| `fazer` | `{ "decisao": "fazer", "prazo": "YYYY-MM-DD"? }` | dono vira `Eu` (I-03) |
| `delegar` | `{ "decisao": "delegar", "dono": "...", "prazo": "...", "checkpoint": "..." }` | I-02 completa |
| `adiar` | `{ "decisao": "adiar", "prazo": "..." }` | I-04 |
| `descartar` | `{ "decisao": "descartar" }` | — |

Efeitos (transação): seta `tipo` (ou `descartada_em`), grava a entrada automática
de triagem correspondente (§6 do domínio).
**200** `Compromisso`. Erros: 404, 409, **422 `I-02`/`I-04`**.

### `POST /compromissos/:id/concluir`

Transação: `status = concluida` + entrada automática (I-08). Idempotente.
**200** `Compromisso`. Erro: 404.

### `POST /compromissos/:id/descartar`

Transação: preenche `descartada_em` + entrada automática (I-09). Idempotente.
Disponível em qualquer ponto do ciclo de vida.
**200** `{ "id": 42, "descartada": true }`. Erro: 404.

---

## 5. Referências

### `POST /compromissos/:id/referencias`
Body: `{ "descricao": "..."?, "url": "https://..." }`.
**201** `Referencia`. Erros: 404; **422 `I-12`** (URL sem esquema http/https).

### `DELETE /compromissos/:id/referencias/:refId`
**204** sem corpo. Erro: 404 (inclui referência que não pertence ao compromisso).

---

## 6. Registro

### `POST /compromissos/:id/registro`
Body: `{ "texto": "...", "data": "YYYY-MM-DD"? }` (default: hoje no fuso do
usuário). Cria com `origem = "usuario"`.
**201** `RegistroEntrada`. Erros: 404; **422 `I-01`** análogo (texto vazio — usar
`erro: "TEXTO_OBRIGATORIO"`).

### Rotas que NÃO existem (I-05 — verificado por teste)

- `PATCH`/`PUT`/`DELETE` de `/registro/*` em qualquer forma.
- `DELETE /compromissos/:id` (hard delete).

O teste de contrato DEVE afirmar que essas rotas respondem **404/405** e que o
router não as declara.

---

## 7. Métricas

### `GET /metricas`
Query §6.2 de `02-dados.md` + contagem da fila de triagem.
**200** `Metricas` (shape §2.3). `carga` e `alertaCarga` calculados no servidor
(I-11); com zero ativos, `carga = 0` e `alertaCarga = false`.

---

## 8. Mapa rota → invariantes → cenários

| Rota | Invariantes exercidas | Cenários |
|---|---|---|
| `POST /compromissos` | I-01, I-07 | C-01 |
| `POST /:id/triagem` | I-02, I-03, I-04, I-09 | C-02 |
| `GET /compromissos` | I-06, I-07 | C-03 |
| `PATCH /:id` | I-01…I-04, I-08 | C-04 |
| `GET /:id` | I-05 (leitura), I-09 | C-04 |
| `GET /metricas` | I-06, I-07, I-11 | C-05 |
| ausência de rotas de mutação do registro | I-05 | — |

Este mapa é o checklist de cobertura: cada linha DEVE ter ao menos um teste de
integração nomeado com o ID correspondente.

---

## 9. Fora do escopo da v1 (API)

- Paginação, ordenação parametrizada, busca textual.
- Webhooks, rate limiting, refresh token, logout server-side, recuperação de senha.
- Endpoints administrativos (hard delete, export). Exportação de dados é candidata
  à v1.1 — registrar em `decisoes/` quando priorizar.
- Versionamento além de `/v1` e negociação de conteúdo.