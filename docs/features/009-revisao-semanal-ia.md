# Feature 009 — Revisão semanal com IA

> Spec de feature. Pré-requisitos: features 001–008 concluídas e em produção.
> Documentos normativos: `01-dominio.md`, `02-dados.md`, `03-api.md`, `04-frontend.md`.
> Em conflito entre esta spec e um documento normativo, o documento normativo prevalece.

---

## 1. Problema

O tech leader termina a semana sem uma visão consolidada do que aconteceu: o que
avançou, o que travou, quem ficou em silêncio e o que entra na pauta da próxima
semana. Para montar esse raio-x hoje é necessário percorrer vários filtros
manualmente e interpretar dezenas de entradas de registro sem auxílio.

O sistema já coleta tudo que é necessário — registros imutáveis e datados,
histórico de transições de status, delegações com checkpoints, padrões de atraso
— mas não os transforma em inteligência acionável.

---

## 2. Solução

Chip **"Revisão"** na barra de filtros. Quando selecionado, exibe um painel de
retrospectiva da semana corrente (segunda a domingo no fuso `America/Sao_Paulo`)
composto por três camadas:

1. **Dados estruturados** — métricas e listas geradas pela API sem IA.
2. **Narrativa gerada por IA** — parágrafo interpretando os dados da semana.
3. **Sugestões de ação** — lista de até 3 ações concretas para a próxima semana,
   geradas por IA com base nos padrões identificados.

A IA recebe dados estruturados e determinísticos (nunca texto livre do usuário
como entrada principal) e retorna texto em português, respeitando a linguagem
ubíqua do domínio.

---

## 3. Contratos de API

### 3.1 `GET /revisao?semana=YYYY-Www`

Retorna os dados estruturados da semana, **sem chamada à IA**. Resposta rápida,
cacheável, base para o painel e para o prompt de IA.

**Parâmetro:** `semana` — semana ISO 8601 (ex.: `2026-W25`). Se omitido, usa a
semana corrente calculada no fuso do usuário.

**Resposta 200:**

```json
{
  "semana": "2026-W25",
  "periodo": { "inicio": "2026-06-15", "fim": "2026-06-21" },
  "concluidos": [
    {
      "id": 42,
      "titulo": "API de billing estável em produção",
      "dono": "Ana",
      "tipo": "delegada",
      "concluidoEm": "2026-06-17"
    }
  ],
  "paralisados": [
    {
      "id": 17,
      "titulo": "Migração do banco de dados",
      "dono": "Eu",
      "tipo": "fazer",
      "status": "nao_iniciada",
      "prazo": "2026-06-20",
      "diasSemAtualizacao": 9
    }
  ],
  "redelegados": [
    {
      "id": 23,
      "titulo": "Revisão do processo de deploy",
      "donoAnterior": "Carlos",
      "donoAtual": "Pedro",
      "dataRedelegacao": "2026-06-16"
    }
  ],
  "donosEmSilencio": [
    {
      "dono": "Pedro",
      "ativos": 4,
      "diasSemAtualizacao": 6
    }
  ],
  "resumo": {
    "concluidos": 3,
    "paralisados": 2,
    "redelegados": 1,
    "checkpointsVencidos": 2,
    "prazosEstourados": 1
  }
}
```

**Definições dos campos de dados:**

| Campo | Critério de inclusão |
|---|---|
| `concluidos` | `status` transitou para `concluida` entre `periodo.inicio` e `periodo.fim` (detectado via entrada de registro `sistema` com texto começando em `"Compromisso concluído."`) |
| `paralisados` | Ativo, triado (`tipo IS NOT NULL`), `status = 'nao_iniciada'`, com prazo dentro ou antes do período, e sem nenhuma entrada de registro nos últimos 7 dias |
| `redelegados` | Tem entrada de registro `sistema` com texto começando em `"Dono alterado de"` dentro do período |
| `donosEmSilencio` | Dono com ≥ 1 ativo delegado sem nenhuma entrada de registro nos últimos 5 dias |
| `diasSemAtualizacao` | `DATEDIFF(:hoje, MAX(re.criada_em))` para entradas do compromisso |

**"Hoje" é calculado uma vez no serviço** e parametrizado em todas as queries —
nunca `CURDATE()` (regra inviolável §6 do `CLAUDE.md`).

---

### 3.2 `POST /revisao/narrativa`

Chama a API da OpenAI e retorna a narrativa + sugestões geradas por IA. Rota
separada do `GET /revisao` para que o painel carregue imediatamente com os dados
estruturados enquanto a IA processa em paralelo (ou sob demanda).

**Request:**

```json
{ "semana": "2026-W25" }
```

**Resposta 200:**

```json
{
  "semana": "2026-W25",
  "narrativa": "Esta semana 3 compromissos foram concluídos...",
  "sugestoes": [
    "Agendar checkpoint com Pedro antes de quinta: 4 ativos sem atualização há 6 dias.",
    "O compromisso 'Migração do banco' está parado há 9 dias — considere escalar ou descartar.",
    "Sua carga atual é 38%. Dos 5 itens 'fazer', 2 não têm prazo definido — candidatos a delegar."
  ],
  "geradoEm": "2026-06-18T14:03:22.123Z",
  "modeloUsado": "gpt-4o-mini"
}
```

**Resposta 503** — quando a OpenAI está indisponível:

```json
{ "erro": "IA_INDISPONIVEL", "mensagem": "Não foi possível gerar a narrativa. Tente novamente." }
```

A UI degrada graciosamente: exibe os dados estruturados normalmente e mostra um
aviso no lugar da narrativa.

---

## 4. Arquitetura da integração com IA

### 4.1 Fluxo

```
POST /revisao/narrativa
  │
  ├─ 1. Chama GET /revisao internamente (reuso do service, sem HTTP)
  │
  ├─ 2. Monta o prompt estruturado (ver §4.2)
  │
  ├─ 3. Chama OpenAI Chat Completions API (modelo: gpt-4o-mini)
  │
  ├─ 4. Parseia e valida a resposta (JSON estruturado)
  │
  └─ 5. Retorna { narrativa, sugestoes, geradoEm, modeloUsado }
```

### 4.2 Prompt estruturado

O prompt é construído em duas partes:

**System prompt (fixo — define o papel e as restrições):**

```
Você é um assistente de gestão para tech leaders. Analisa dados de compromissos
e produz retrospectivas objetivas em português (pt-BR).

Regras obrigatórias:
- Use sempre a linguagem do domínio: "compromisso" (nunca "tarefa"), "dono",
  "checkpoint", "triagem", "carga", "delegada", "fazer", "adiada".
- Seja direto e objetivo. Máximo de 4 frases na narrativa.
- As sugestões devem ser ações concretas e específicas (quem, o quê, quando).
  Máximo de 3 sugestões.
- Não invente dados. Use somente o que está no JSON fornecido.
- Responda APENAS com JSON válido no formato especificado. Sem texto fora do JSON.

Formato de resposta:
{
  "narrativa": "<string>",
  "sugestoes": ["<string>", "<string>", "<string>"]
}
```

**User prompt (dinâmico — dados da semana):**

```
Dados da semana {{ semana }} ({{ periodo.inicio }} a {{ periodo.fim }}):

{{ JSON.stringify(dadosRevisao, null, 2) }}

Gere a retrospectiva seguindo as regras do sistema.
```

### 4.3 Cache

Narrativas de **semanas passadas são imutáveis** — os registros são append-only
e o passado não muda. O cache é implementado na camada de serviço:

| Semana | Estratégia |
|---|---|
| Semana passada ou anterior | Persiste em `revisao_narrativas` (nova tabela — ver §5) |
| Semana corrente | TTL de 1 hora em memória (mapa no processo); não persiste até a semana fechar |

Isso evita chamadas redundantes à OpenAI e garante que a retrospectiva da
semana passada seja sempre instantânea após a primeira geração.

### 4.4 Variável de ambiente

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini   # default; permite upgrade sem redeploy
```

---

## 5. Migration: tabela de cache de narrativas

```sql
CREATE TABLE revisao_narrativas (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT UNSIGNED NOT NULL,
  semana        CHAR(8) NOT NULL,          -- ex.: '2026-W25'
  narrativa     TEXT NOT NULL,
  sugestoes     JSON NOT NULL,             -- array de strings
  modelo_usado  VARCHAR(50) NOT NULL,
  gerado_em     DATETIME NOT NULL,
  UNIQUE KEY uq_usuario_semana (usuario_id, semana),
  CONSTRAINT fk_rn_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Invariante de cache:** `POST /revisao/narrativa` para uma semana já encerrada
e já cacheada responde **200** diretamente do banco, sem chamar a OpenAI.

---

## 6. Módulo de API: `revisao/`

Novo módulo em `apps/api/src/revisao/` seguindo a convenção dos demais agregados:

| Arquivo | Responsabilidade |
|---|---|
| `revisao.router.ts` | Registra `GET /revisao` e `POST /revisao/narrativa` no Fastify |
| `revisao.service.ts` | Lógica de negócio: monta dados estruturados, controla cache, orquestra chamada à IA |
| `revisao.repo.ts` | Queries Kysely: concluídos, paralisados, redelegados, donos em silêncio, CRUD de cache |
| `revisao.ia.ts` | Encapsulamento da OpenAI: monta prompt, chama API, parseia e valida resposta |
| `revisao.schemas.ts` | Schemas Zod/JSON Schema para validação de request e response |

---

## 7. UI

### 7.1 Chip na barra de filtros

- Posicionado após "Equipe" (última posição)
- Label: **"Revisão"**
- Sem contador de badge
- Ao selecionar, `CommitmentList` e `TeamPanel` são substituídos por `WeeklyReview`

### 7.2 Componente `WeeklyReview`

Layout em duas colunas em viewport largo, coluna única em mobile:

**Coluna esquerda — dados estruturados (carrega imediatamente):**

```
┌─────────────────────────────────┐
│  Semana 25 · 15–21 jun 2026     │
│                                 │
│  ✓ Concluídos (3)               │
│  · API de billing ...  [Ana]    │
│  · ...                          │
│                                 │
│  ⏸ Paralisados (2)              │
│  · Migração do banco · 9 dias   │
│  · ...                          │
│                                 │
│  🔄 Redelegados (1)             │
│  · Revisão do deploy            │
│    Carlos → Pedro               │
│                                 │
│  🔇 Donos em silêncio (1)       │
│  · Pedro · 4 ativos · 6 dias    │
└─────────────────────────────────┘
```

**Coluna direita — IA (carrega em paralelo com skeleton):**

```
┌─────────────────────────────────┐
│  Análise da semana  [✨ IA]     │
│                                 │
│  Esta semana 3 compromissos     │
│  foram concluídos, mas 2 deles  │
│  só saíram do lugar após        │
│  redelegação...                 │
│                                 │
│  Sugestões para a próxima       │
│  semana:                        │
│                                 │
│  1. Agendar checkpoint com      │
│     Pedro antes de quinta.      │
│  2. Escalar ou descartar        │
│     'Migração do banco'.        │
│  3. Delegar 2 itens sem prazo   │
│     para reduzir carga (38%).   │
│                                 │
│  [Gerar análise] ← se pendente  │
└─────────────────────────────────┘
```

### 7.3 Estados da coluna de IA

| Estado | Comportamento |
|---|---|
| Carregando | Skeleton de 3 linhas com animação `pulse` |
| Sucesso | Narrativa + lista de sugestões |
| Erro / 503 | Aviso "Análise indisponível no momento." + botão "Tentar novamente" |
| Semana sem dados | "Nenhum dado para esta semana." — sem botão de gerar |

### 7.4 Navegação de semanas

Setas `‹` `›` acima do painel permitem navegar entre semanas anteriores.
Semanas futuras não são acessíveis (seta `›` desabilitada quando semana corrente).

---

## 8. Invariantes respeitadas

| Invariante | Como é respeitada |
|---|---|
| **I-05** (registro imutável) | Nenhuma query de UPDATE/DELETE em `registro_entradas`. A detecção de eventos usa `SELECT` nas entradas existentes. |
| **I-06** (derivados não persistidos) | `diasSemAtualizacao`, `paralisado`, `emSilencio` são calculados em tempo de leitura; nenhuma coluna nova em `compromissos`. |
| **I-10** (datas sem hora) | `:hoje` e `:inicioSemana`/`:fimSemana` são calculados uma vez no serviço com fuso `America/Sao_Paulo` e parametrizados. Nunca `CURDATE()`. |
| **I-11** (carga no servidor) | Toda derivação de dados é feita na API. A UI exibe o que recebe. |

---

## 9. Critérios de aceite

- **A-30 — Painel carrega sem IA.** Ao selecionar o chip "Revisão", os dados
  estruturados (concluídos, paralisados, redelegados, donos em silêncio) são
  exibidos imediatamente, mesmo que a coluna de IA ainda esteja carregando.

- **A-31 — Narrativa coerente.** A narrativa gerada menciona apenas dados
  presentes na resposta de `GET /revisao` — nenhuma informação inventada.
  Verificado em teste de integração com mock da OpenAI validando que o prompt
  contém exatamente os dados enviados à API.

- **A-32 — Cache de semana passada.** `POST /revisao/narrativa` para uma semana
  já encerrada e cacheada responde em < 50 ms e não faz chamada à OpenAI
  (verificado com spy no client HTTP).

- **A-33 — Degradação graciosa.** Quando a OpenAI retorna erro (mock 503), os
  dados estruturados permanecem visíveis e a coluna de IA exibe o aviso de
  indisponibilidade sem quebrar o painel.

- **A-34 — Semana ISO correta.** Segunda a domingo no fuso `America/Sao_Paulo`.
  Teste de integração fixando `:hoje = '2026-06-18'` (quinta) verifica que
  `periodo.inicio = '2026-06-15'` e `periodo.fim = '2026-06-21'`.

- **A-35 — Itens em triagem excluídos.** Compromissos com `tipo IS NULL` não
  aparecem em nenhuma seção do painel de revisão (I-07).

- **A-36 — Navegação entre semanas.** Clicar em `‹` carrega a semana anterior;
  a seta `›` fica desabilitada quando o painel exibe a semana corrente.

- **A-37 — Prompt não vaza dados de outro usuário.** O serviço monta o contexto
  da IA exclusivamente com dados do `usuario_id` do token. Teste de integração
  cria dois usuários com dados distintos e verifica isolamento.

---

## 10. Plano de testes

| Tipo | Conteúdo |
|---|---|
| Unidade (serviço) | Cálculo de `semanaISO()`, `inicioDaSemana()`, `fimDaSemana()` para datas em fuso `America/Sao_Paulo` (incluindo virada de ano); lógica de cache (semana aberta → não persiste; semana fechada → persiste e reusa). |
| Unidade (`revisao.ia.ts`) | Montagem do prompt: verifica que todos os campos de `RevisaoSemana` aparecem no user prompt; parseia resposta JSON válida; lança `IaResponseInvalidaError` para JSON malformado ou sem campos obrigatórios. |
| Integração (API + MySQL) | `GET /revisao`: A-34 (período ISO), A-35 (sem triagem), isolamento por usuário; cada seção com fixture específica. `POST /revisao/narrativa`: A-32 (cache hit sem chamada IA), A-33 (503 OpenAI → 503 da rota com mensagem correta), A-37 (isolamento). |
| Componente (React) | `WeeklyReview`: renderiza skeleton durante loading; exibe dados estruturados sem aguardar IA; exibe aviso de erro quando narrativa falha; desabilita seta `›` na semana corrente. |
| E2E (Playwright) | Jornada completa: capturar → triar → concluir → abrir "Revisão" → verificar item em "Concluídos"; navegar para semana anterior e verificar que seta `›` é habilitada. IA mockada via `page.route`. |

---

## 11. Fora do escopo

- Notificações automáticas (e-mail, push, Slack) com o resumo semanal.
- Histórico de narrativas anteriores exibido em linha (apenas navegação entre semanas).
- Customização do prompt pelo usuário.
- Suporte a outros modelos de IA além da OpenAI.
- Exportação do painel de revisão (PDF, markdown).
- Análise de tendências entre semanas (ex.: "terceira semana seguida com carga acima de 30%") — evolução futura.
- Qualquer item do §9 de `01-dominio.md`.

---

## 12. Arquivos a criar / modificar

| Arquivo | Mudança |
|---|---|
| `apps/api/src/revisao/revisao.router.ts` | Novo — registra `GET /revisao` e `POST /revisao/narrativa` |
| `apps/api/src/revisao/revisao.service.ts` | Novo — lógica de negócio, cache, orquestração |
| `apps/api/src/revisao/revisao.repo.ts` | Novo — queries Kysely para os 4 grupos de dados + CRUD de cache |
| `apps/api/src/revisao/revisao.ia.ts` | Novo — encapsulamento da OpenAI (prompt, parse, validação) |
| `apps/api/src/revisao/revisao.schemas.ts` | Novo — schemas Zod para request/response |
| `apps/api/src/app.ts` | Registrar o plugin `revisao.router` |
| `apps/api/migrations/NNNN_create_revisao_narrativas.ts` | Nova migration — tabela de cache |
| `apps/api/test/revisao/revisao.test.ts` | Novo — testes de integração (A-32, A-33, A-34, A-35, A-37) |
| `apps/api/test/revisao/revisao-ia.unit.test.ts` | Novo — testes de unidade do módulo IA |
| `apps/web/src/api/revisao.ts` | Novo — `getRevisao()` e `gerarNarrativa()` |
| `apps/web/src/types/api.ts` | Adicionar `RevisaoSemana`, `NarrativaIA`, `DonoSilencio` |
| `apps/web/src/components/WeeklyReview.tsx` | Novo — componente principal do painel |
| `apps/web/src/components/WeeklyReview.module.css` | Novo — estilos |
| `apps/web/src/components/FilterChips.tsx` | Adicionar chip "Revisão" e tipo `FiltroPainel` |
| `apps/web/src/pages/Painel.tsx` | Renderização condicional `WeeklyReview` quando `filtro=revisao` |
| `e2e/revisao-semanal.spec.ts` | Novo — jornada E2E com IA mockada |
| `.env.example` | Adicionar `OPENAI_API_KEY` e `OPENAI_MODEL` |

---

## 13. Riscos e decisões em aberto

- **Custo de tokens:** `gpt-4o-mini` custa ~0,15 USD/1M tokens de entrada. Um
  prompt típico desta feature tem ~800 tokens. Com cache de semanas passadas, o
  custo por usuário ativo é estimado em < 0,001 USD/semana. Monitorar se o
  volume crescer.

- **Latência da IA:** A geração pode levar 3–8 segundos. A separação entre
  `GET /revisao` (dados estruturados, rápido) e `POST /revisao/narrativa` (IA,
  assíncrono) garante que o painel nunca bloqueia na resposta da OpenAI.

- **Alucinação controlada:** O prompt proíbe explicitamente inventar dados e
  exige JSON estruturado. O serviço valida o JSON de saída com Zod antes de
  retornar — resposta inválida da IA resulta em `IaResponseInvalidaError`
  tratado como 503.

- **Isolamento de dados:** O contexto enviado à OpenAI contém dados do usuário.
  Revisar a política de uso de dados da OpenAI antes de ir a produção; considerar
  ativar o modo "zero data retention" da API.
