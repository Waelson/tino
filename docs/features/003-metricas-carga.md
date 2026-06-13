# Feature 003 — Métricas, carga e filtros (fecha a v1)

> Spec de feature. Terceira e última fatia vertical da v1: o painel de métricas
> com o indicador de carga (o sinal de gargalo do método), os filtros da lista e
> as sinalizações de vencimento. É a fatia que faz o sistema responder em segundos
> às três perguntas do domínio (§1 de `01-dominio.md`).
> Documentos normativos: `01-dominio.md`, `02-dados.md`, `03-api.md`,
> `04-frontend.md`. Pré-requisito: features 001 e 002 concluídas.

---

## 1. Objetivo

Ao final desta fatia, o usuário abre o painel e vê: quantos compromissos ativos
tem, quantos checkpoints venceram, quantos prazos estouraram e — o número-assinatura
do produto — **qual a sua carga**, com alerta visual acima de 30%. A lista ganha os
filtros Comigo, Delegadas, Atenção e Concluídas, e cada linha sinaliza atraso sem
nenhuma ação do usuário. Com isso, os cinco cenários canônicos do domínio estão
todos no ar, e a v1 está funcionalmente completa.

---

## 2. Alteração em documento normativo (parte desta feature)

Para os contadores dos chips terem fonte única, esta feature **emenda
`03-api.md` §2.3**, adicionando um campo à representação `Metricas`:

```json
{ "...": "campos existentes", "precisamAtencao": 2 }
```

`precisamAtencao` = count(ativos com `precisa_atencao`) — contagem **distinta**
(um item bloqueado E com prazo estourado conta uma vez), conforme a definição de
`precisa_atencao` em `01-dominio.md` §5. A atualização do arquivo `03-api.md` é
entregável desta feature, na mesma sessão que implementar o endpoint.

---

## 3. Escopo

### 3.1 Dentro

| Camada | Itens |
|---|---|
| API | `GET /metricas` (query `02-dados.md` §6.2 + `aguardandoTriagem` + `precisamAtencao`); filtros `comigo`, `delegadas`, `atencao`, `concluidas` em `GET /compromissos` (semântica `01-dominio.md` §5 / matches da listagem). |
| Domínio/serviço | I-06 (derivado, nada persistido), I-07 (triagem fora de tudo), I-11 (carga no servidor); zeragem das flags para itens não ativos (`02-dados.md` §6.1, observação); "hoje" no fuso do usuário parametrizado nas queries (I-10). |
| Frontend | `MetricsBar` com os 3 `MetricCard` + `CargaGauge` (`04-frontend.md` §7.3); `FilterChips` com contadores vindos de `/metricas` (Ativas=`ativos`, Comigo=`comigo`, Atenção=`precisamAtencao`; Delegadas e Concluídas sem contador); filtro em estado de URL `?filtro=` (default `ativas`, sobrevive a refresh); flags nas linhas com precedência prazo > checkpoint (`04-frontend.md` §5.5); estados vazios específicos por filtro (§6); invalidação de `['metricas']` já mapeada desde a 001 — verificar que está completa. |

### 3.2 Fora (explícito — NÃO implementar nem "deixar pronto")

- Notificações de qualquer tipo (checkpoint vencendo, resumo semanal) → pós-v1.
- Histórico/gráfico da carga ao longo do tempo; metas configuráveis (o limite é
  fixo em 30% na v1 — mudar isso exige nova decisão de domínio).
- Ordenação parametrizada, busca, paginação (`03-api.md` §9).
- Qualquer item do §9 dos documentos normativos.

---

## 4. Critérios de aceite

Os cenários canônicos **C-03** e **C-05** (`01-dominio.md` §10) na íntegra, mais:

- **A-20 — Métricas vivas.** Capturar um item incrementa `aguardandoTriagem` na
  tela sem reload; triar como Fazer move o item para Ativas e atualiza `ativos`,
  `comigo` e a carga na mesma interação (invalidação correta).
- **A-21 — Zero ativos.** Sem compromissos ativos: carga exibida 0%, sem alerta,
  e nenhuma divisão por zero em lugar algum (`carga = 0` vindo da API, I-11).
- **A-22 — Limiar estrito.** Com exatamente 30% de carga o gauge NÃO está em
  alerta; com 31% está (`alertaCarga = carga > 30`). Teste com 10 ativos / 3
  comigo (30%) e 13 ativos / 4 comigo (31%).
- **A-23 — Filtro na URL.** Selecionar Atenção altera para `?filtro=atencao`;
  refresh mantém o filtro e os dados; URL sem parâmetro carrega Ativas.
- **A-24 — Precedência de flags.** Item com checkpoint vencido E prazo estourado
  exibe uma única sinalização: "prazo estourado".
- **A-25 — Atenção é de ativos.** Item concluído com prazo no passado NÃO aparece
  no filtro Atenção nem conta em `precisamAtencao` (condições derivadas exigem
  item ativo, `01-dominio.md` §5); item bloqueado sem nenhuma data vencida
  aparece.
- **A-26 — Concluídas limpas.** O filtro Concluídas lista os concluídos sem
  nenhuma flag de vencimento (zeragem das flags para não ativos).
- **A-27 — Fronteira do dia.** Item com checkpoint igual a hoje (no fuso do
  usuário) NÃO está vencido (comparação estrita `< hoje`); com checkpoint de
  ontem, está. Teste de integração fixando `:hoje` como parâmetro.
- **A-28 — Estados vazios por filtro.** Atenção vazio exibe "Nada precisa de
  atenção. Bom sinal."; Ativas vazio convida à captura (`04-frontend.md` §6).

---

## 5. Plano de testes

| Tipo | Conteúdo |
|---|---|
| Unidade (serviço) | Cálculo de carga e alerta: tabela de casos (0 ativos; 30%; 31%; 100%; arredondamento de 1/3 → 33); `precisamAtencao` distinto vs soma (item com duas condições conta uma vez). |
| Integração (API + MySQL) | `GET /metricas` contra fixtures cobrindo A-21, A-22, A-25, A-27; um teste por filtro de `GET /compromissos` validando a semântica do §5 do domínio (nomeados `i06.*`, `i07.*`, `i11.*` conforme o mapa de `03-api.md` §8); triagem pendente fora de todas as métricas e filtros (I-07). |
| Componente (React) | `CargaGauge` (0%, 30%, 31%, marca fixa, `prefers-reduced-motion`); `FilterChips` (contadores, estado ativo, sincronização com URL); `CommitmentRow` (precedência de flags — A-24). |
| E2E (Playwright) | `c03-checkpoint-vencido.spec.ts` e `c05-carga.spec.ts` literais; jornada A-20 (captura → triagem → métricas atualizando sem reload). |

---

## 6. Sequência de execução sugerida (sessões de Claude Code)

1. **API**: `GET /metricas` (com a emenda do §2 aplicada em `03-api.md`), filtros
   da listagem, zeragem de flags para não ativos. Gate: integração de A-21, A-22,
   A-25, A-27 + filtros verdes.
2. **Frontend**: `MetricsBar`, `CargaGauge`, `FilterChips` com URL, flags na
   lista, estados vazios. Gate: testes de componente + A-23, A-24, A-28.
3. **E2E + revisão de fechamento da v1**: c03, c05 e jornada A-20 verdes; depois
   uma revisão independente **ampla** — não só o diff desta feature, mas a v1
   inteira contra `01-dominio.md`: as 12 invariantes têm teste? os 5 cenários
   passam? algum item dos §§9 (fora de escopo) vazou para o código?

---

## 7. Definição de pronto (da feature e da v1)

**Da feature:** C-03 + C-05 + A-20…A-28 automatizados; nada do §3.2 implementado;
suítes das features 001 e 002 verdes; `03-api.md` emendado conforme §2.

**Da v1 (este é o marco):**
- Os cinco cenários canônicos C-01…C-05 passam em E2E contra a stack completa.
- Cada invariante I-01…I-12 tem ao menos um teste automatizado que a referencia
  pelo ID (auditável por `grep -r "I-0" apps/*/test e2e/`).
- README permite subir o ambiente do zero em ≤ 5 comandos.
- Revisão de fechamento (etapa 3) sem achados pendentes.

---

## 8. Riscos e perguntas em aberto

- **Fuso na fronteira do dia**: o parâmetro `:hoje` DEVE ser calculado uma única
  vez por requisição (middleware/contexto) e injetado em todas as queries — duas
  chamadas a "agora" na mesma requisição perto da meia-noite podem divergir.
- **Consistência chip × lista**: os contadores vêm de `/metricas` e os itens de
  `/compromissos`; entre duas invalidações pode haver janela de inconsistência
  visual de milissegundos. Aceito na v1 (mesma invalidação dispara ambos);
  registrar apenas se incomodar na prática.
- **Arredondamento da carga**: `round` padrão (33,33 → 33; 33,5 → 34) definido no
  teste de unidade — o teste é o contrato, para o frontend nunca "corrigir" o
  número.
- **Pós-v1 natural** (registrar em `decisoes/` quando priorizar): notificação de
  checkpoint do dia, exportação de dados, revisão semanal guiada (a pergunta "o
  que está parado há mais de uma semana?" do método ainda não tem tela).