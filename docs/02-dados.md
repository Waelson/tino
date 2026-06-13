# 02 — Dados: schema MySQL

> Documento normativo. Define o schema físico do banco, convenções, índices e o
> mapeamento entre as invariantes de `01-dominio.md` e os mecanismos que as
> garantem. Toda migration DEVE convergir para o estado descrito aqui.
> Em caso de conflito com `01-dominio.md`, o domínio prevalece e este documento
> deve ser corrigido.

---

## 1. Convenções gerais

| Tema | Convenção |
|---|---|
| Versão mínima | MySQL 8.0 (necessário para `CHECK` constraints efetivas e CTEs). |
| Engine | InnoDB em todas as tabelas. |
| Charset / collation | `utf8mb4` / `utf8mb4_0900_ai_ci`. |
| Nomes | Tabelas no plural em snake_case (`compromissos`); colunas em snake_case; FK como `<tabela_singular>_id`. |
| Chaves primárias | `id BIGINT UNSIGNED AUTO_INCREMENT`. |
| Timestamps técnicos | `criada_em DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)` e, onde aplicável, `atualizada_em ... ON UPDATE CURRENT_TIMESTAMP(3)`, sempre em **UTC**. |
| Datas de negócio | `prazo`, `checkpoint`, `data` são `DATE` puras (I-10), sem conversão de fuso: representam o dia no calendário do usuário. |
| Fuso de comparação | "Hoje" é calculado **na aplicação** em `America/Sao_Paulo` (v1) e passado como parâmetro às queries. NUNCA usar `CURDATE()` do servidor em regra de negócio. |
| Enums | `VARCHAR` curto + `CHECK` constraint, em vez de `ENUM` nativo (alterar `ENUM` exige `ALTER TABLE` com reescrita; `CHECK` + constante na aplicação evolui melhor). |
| Migrations | Sequenciais, imutáveis após merge, uma mudança lógica por arquivo. Ferramenta sugerida: a nativa do ORM adotado (ver `decisoes/`). |
| Soft delete | Apenas em `compromissos` (`descartada_em`), conforme I-09. Nenhuma outra tabela tem soft delete. |

---

## 2. Diagrama de relações

```
usuarios 1 ──── N compromissos 1 ──── N referencias
                      │
                      └──────────────── N registro_entradas
```

Tudo pertence a um usuário através de `compromissos.usuario_id`. `referencias` e
`registro_entradas` não têm `usuario_id` próprio: a posse é derivada do compromisso
(evita inconsistência de dupla fonte).

---

## 3. DDL de referência

### 3.1 `usuarios`

Suporte mínimo de autenticação da v1 (um usuário por conta; ver §9 do domínio).

```sql
CREATE TABLE usuarios (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(254)  NOT NULL,
  nome          VARCHAR(120)  NOT NULL,
  senha_hash    VARCHAR(255)  NOT NULL,           -- bcrypt/argon2; nunca a senha
  criada_em     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizada_em DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                              ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_usuarios_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 3.2 `compromissos`

```sql
CREATE TABLE compromissos (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id     BIGINT UNSIGNED NOT NULL,
  titulo         VARCHAR(280)    NOT NULL,
  dono           VARCHAR(80)     NULL,
  tipo           VARCHAR(10)     NULL,            -- NULL = aguardando triagem (I-07)
  prazo          DATE            NULL,
  checkpoint     DATE            NULL,
  status         VARCHAR(15)     NOT NULL DEFAULT 'nao_iniciada',
  descartada_em  DATETIME(3)     NULL,            -- soft delete (I-09)
  criada_em      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizada_em  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),

  CONSTRAINT fk_compromissos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id),

  CONSTRAINT ck_compromissos_tipo
    CHECK (tipo IN ('fazer','delegada','adiada')),

  CONSTRAINT ck_compromissos_status
    CHECK (status IN ('nao_iniciada','em_andamento','bloqueada',
                      'aguardando','concluida')),

  CONSTRAINT ck_compromissos_titulo
    CHECK (CHAR_LENGTH(TRIM(titulo)) > 0),        -- I-01 (reforço; ver §4)

  CONSTRAINT ck_compromissos_checkpoint_antes_prazo
    CHECK (checkpoint IS NULL OR prazo IS NULL OR checkpoint < prazo)  -- parte de I-02
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Observação: as obrigatoriedades condicionais de I-02/I-03/I-04 (ex.: `delegada`
exige dono+prazo+checkpoint) dependem do valor de `tipo` e são garantidas na
**camada de aplicação** (ver matriz no §5). O `CHECK` acima garante o pedaço
incondicional — checkpoint sempre antes do prazo quando ambos existem.

### 3.3 `referencias`

```sql
CREATE TABLE referencias (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  compromisso_id  BIGINT UNSIGNED NOT NULL,
  descricao       VARCHAR(140)    NULL,
  url             VARCHAR(2048)   NOT NULL,
  criada_em       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT fk_referencias_compromisso
    FOREIGN KEY (compromisso_id) REFERENCES compromissos (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Validação de URL (I-12: esquema http/https) é da camada de aplicação — `CHECK` com
regex em MySQL é frágil e penaliza escrita.

### 3.4 `registro_entradas`

```sql
CREATE TABLE registro_entradas (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  compromisso_id  BIGINT UNSIGNED NOT NULL,
  data            DATE            NOT NULL,
  texto           VARCHAR(2000)   NOT NULL,
  origem          VARCHAR(10)     NOT NULL,
  criada_em       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT fk_registro_compromisso
    FOREIGN KEY (compromisso_id) REFERENCES compromissos (id)
    ON DELETE CASCADE,

  CONSTRAINT ck_registro_origem CHECK (origem IN ('usuario','sistema')),
  CONSTRAINT ck_registro_texto  CHECK (CHAR_LENGTH(TRIM(texto)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Imutabilidade (I-05):** garantida em três camadas:
1. Aplicação: o repositório de registro expõe apenas `criar` e `listar`.
2. API: não existem rotas `PATCH`/`PUT`/`DELETE` para entradas.
3. Banco (cinto e suspensório): o usuário MySQL da aplicação NÃO DEVE receber
   privilégios `UPDATE` e `DELETE` sobre `registro_entradas`:
   ```sql
   GRANT SELECT, INSERT ON radar.registro_entradas TO 'radar_app'@'%';
   ```
   A cascata do `ON DELETE` da FK não é afetada por esse GRANT (a exclusão parte
   de `compromissos`, operação administrativa fora da v1).

---

## 4. O que o banco NÃO armazena (deliberado)

Conforme I-06, NÃO existem colunas para: `atrasada`, `checkpoint_vencido`,
`prazo_estourado`, `precisa_atencao`, `comigo`, `carga`. Tudo isso é derivado em
tempo de leitura (queries do §6) ou na camada de serviço. Se uma migration futura
propuser persistir qualquer um desses, é sinal de violação do domínio — recusar.

Também não se armazena o ciclo de vida (`capturado`/`ativo`/`concluído`/
`descartado`): ele é inteiramente derivável de `tipo`, `status` e `descartada_em`.

---

## 5. Matriz invariante → mecanismo de garantia

| Invariante | Banco (DDL) | Aplicação (service/validação) |
|---|---|---|
| I-01 título obrigatório | `NOT NULL` + `CHECK` trim | revalida e normaliza (trim) |
| I-02 delegação completa | `CHECK checkpoint < prazo` | obrigatoriedade condicional de dono/prazo/checkpoint e `dono != eu` |
| I-03 fazer → dono = Eu | — | seta `dono='Eu'` e ignora valor recebido |
| I-04 adiada → prazo | — | obrigatoriedade condicional |
| I-05 registro imutável | GRANT sem UPDATE/DELETE | repositório append-only; sem rotas de mutação |
| I-06 atraso derivado | ausência de colunas | condições calculadas no SELECT |
| I-07 triagem isolada | — | filtros de listagem e métricas excluem `tipo IS NULL` |
| I-08 conclusão registrada | — | transação: update status + insert no registro |
| I-09 soft delete | coluna `descartada_em` | todas as queries filtram `descartada_em IS NULL` |
| I-10 datas sem hora | colunas `DATE` | "hoje" calculado no fuso do usuário e parametrizado |
| I-11 carga no servidor | — | endpoint de métricas usa query do §6.2 |
| I-12 URL válida | — | validação de esquema http/https |

Regra geral do projeto: o banco garante o que é **incondicional e barato**
(existência, domínio de valores, ordem entre datas); a aplicação garante o que é
**condicional ao estado** — sempre dentro de uma transação quando a regra envolve
mais de uma tabela (ex.: I-08).

---

## 6. Queries canônicas

Estas queries são a definição executável do §5 do domínio. `:hoje` é a data
corrente no fuso do usuário, `:usuario_id` o usuário autenticado.

### 6.1 Listagem com condições derivadas

```sql
SELECT c.*,
       (c.checkpoint IS NOT NULL AND c.checkpoint < :hoje)            AS checkpoint_vencido,
       (c.prazo IS NOT NULL AND c.prazo < :hoje)                      AS prazo_estourado,
       (c.tipo = 'fazer' OR LOWER(TRIM(COALESCE(c.dono,''))) = 'eu')  AS comigo
FROM compromissos c
WHERE c.usuario_id = :usuario_id
  AND c.descartada_em IS NULL
  AND c.tipo IS NOT NULL
  AND c.status <> 'concluida'          -- filtro "Ativas"; demais filtros variam aqui
ORDER BY
  (c.prazo IS NULL), c.prazo ASC,      -- com prazo primeiro, mais urgente no topo
  c.criada_em DESC;
```

(Para itens concluídos ou em triagem, as flags de vencimento não se aplicam — a
camada de serviço as zera, mantendo a semântica "ativo ∧ data < hoje" do domínio.)

### 6.2 Métricas do painel (uma única passada)

```sql
SELECT
  COUNT(*)                                                            AS ativos,
  COALESCE(SUM(checkpoint IS NOT NULL AND checkpoint < :hoje), 0)     AS checkpoints_vencidos,
  COALESCE(SUM(prazo IS NOT NULL AND prazo < :hoje), 0)               AS prazos_estourados,
  COALESCE(SUM(tipo = 'fazer'
               OR LOWER(TRIM(COALESCE(dono,''))) = 'eu'), 0)          AS comigo
FROM compromissos
WHERE usuario_id = :usuario_id
  AND descartada_em IS NULL
  AND tipo IS NOT NULL
  AND status <> 'concluida';
```

A aplicação deriva: `carga = ativos > 0 ? round(100 * comigo / ativos) : 0` e
`alerta_carga = carga > 30` (I-11).

### 6.3 Fila de triagem

```sql
SELECT c.*
FROM compromissos c
WHERE c.usuario_id = :usuario_id
  AND c.descartada_em IS NULL
  AND c.tipo IS NULL
ORDER BY c.criada_em ASC;              -- FIFO: o mais antigo primeiro
```

### 6.4 Ficha do item (3 consultas, nunca N+1)

Compromisso por id (com as mesmas flags do §6.1), referências por
`compromisso_id` ordenadas por `criada_em ASC`, e registro por `compromisso_id`
ordenado por `data DESC, id DESC` (mais recente primeiro; `id` desempata entradas
do mesmo dia).

---

## 7. Índices

| Índice | Tabela (colunas) | Sustenta |
|---|---|---|
| `idx_comp_listagem` | `compromissos (usuario_id, descartada_em, tipo, status)` | §6.1, §6.2, §6.3 — o filtro-base de toda leitura |
| `idx_comp_prazo` | `compromissos (usuario_id, prazo)` | ordenação por urgência |
| `idx_comp_checkpoint` | `compromissos (usuario_id, checkpoint)` | filtro Atenção / futuras notificações |
| `idx_ref_comp` | `referencias (compromisso_id)` | ficha do item |
| `idx_reg_comp_data` | `registro_entradas (compromisso_id, data, id)` | registro em ordem cronológica inversa |

```sql
CREATE INDEX idx_comp_listagem   ON compromissos (usuario_id, descartada_em, tipo, status);
CREATE INDEX idx_comp_prazo      ON compromissos (usuario_id, prazo);
CREATE INDEX idx_comp_checkpoint ON compromissos (usuario_id, checkpoint);
CREATE INDEX idx_ref_comp        ON referencias (compromisso_id);
CREATE INDEX idx_reg_comp_data   ON registro_entradas (compromisso_id, data, id);
```

Volume esperado da v1 (centenas a poucos milhares de linhas por usuário) não exige
mais que isso. NÃO criar índices especulativos.

---

## 8. Seed de desenvolvimento

A migration de seed (apenas ambiente de desenvolvimento, nunca produção) DEVE criar
um usuário de teste e os três compromissos canônicos do protótipo, cobrindo os
estados interessantes: um delegado em andamento com checkpoint futuro, um próprio
com prazo amanhã, e um delegado bloqueado com checkpoint vencido e prazo estourado
— este último com duas entradas de registro além da delegação, para exercitar C-04.

---

## 9. Fora do escopo da v1 (dados)

- Particionamento, réplicas de leitura, full-text search em `titulo`/`texto`.
- Triggers de auditoria (a auditoria do domínio É o registro; não duplicar).
- Tabelas de tags, anexos, notificações, times (espelha §9 do domínio).
- Histórico de alterações de `compromissos` além do que o registro já captura.