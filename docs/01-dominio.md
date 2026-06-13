# 01 — Domínio: Radar de Compromissos

> Documento normativo. Define a linguagem ubíqua, o modelo de domínio, os estados,
> as transições e as invariantes do sistema. Toda implementação (banco, API, frontend)
> e todo teste DEVE respeitar este documento. Em caso de conflito entre uma spec de
> feature e este documento, este documento prevalece.
>
> Palavras-chave: DEVE / NÃO DEVE / PODE seguem o sentido da RFC 2119.

---

## 1. Visão de domínio

O Radar é um sistema de controle de **compromissos** para líderes técnicos. Um
compromisso não é uma tarefa: é um **resultado esperado com um dono e uma data**.
O sistema existe para responder três perguntas em segundos:

1. O que está atrasado ou precisa de atenção?
2. O que está comigo vs. delegado?
3. O que foi combinado em cada delegação (memória auditável)?

O método subjacente: tudo que chega é **capturado** sem fricção; depois passa por
**triagem** (fazer / delegar / adiar / descartar); toda delegação ganha um
**checkpoint** anterior ao prazo; todo acontecimento relevante vira uma entrada
**imutável e datada** no registro do item; e o sistema vigia a **carga** do líder
(proporção de itens sob execução própria), alertando acima de 30%.

---

## 2. Linguagem ubíqua (glossário)

| Termo | Definição |
|---|---|
| **Compromisso** | Unidade central do domínio. Um resultado esperado, com dono, tipo, prazo e status. Nunca chamar de "tarefa" no código ou na UI. |
| **Captura** | Criação de um compromisso apenas com o título (resultado esperado). Não exige nenhum outro campo. |
| **Triagem** | Decisão sobre um compromisso capturado: `fazer`, `delegada`, `adiada` ou descarte. Um compromisso sem tipo está "aguardando triagem". |
| **Dono** | A pessoa responsável pela execução. Sempre uma pessoa, nunca um time. O valor literal `Eu` identifica o próprio usuário do sistema. |
| **Resultado esperado** | O título do compromisso, redigido como estado final verificável ("API de billing estável em produção"), não como ação ("corrigir API"). |
| **Prazo** | Data-limite para o resultado esperado existir. |
| **Checkpoint** | Data de conversa de acompanhamento combinada no ato da delegação, sempre anterior ao prazo. É o que diferencia delegação de abandono. |
| **Registro** | Log cronológico, datado e imutável (append-only) de tudo que aconteceu com o compromisso. |
| **Referência** | Link externo anexado ao compromisso (thread de Slack, documento, PR), com descrição curta. |
| **Carga** | Percentual de compromissos ativos cujo dono é `Eu` em relação ao total de ativos. |
| **Limite saudável** | 30%. Carga acima disso indica que o líder virou gargalo. |
| **Ativo** | Compromisso não concluído e não descartado. |

---

## 3. Entidades e atributos

### 3.1 Compromisso

| Atributo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | inteiro autoincremento | sim | Imutável. |
| `titulo` | texto (≤ 280 chars) | sim | Resultado esperado. Não vazio após trim. |
| `dono` | texto (≤ 80 chars) | condicional | Ver invariantes I-02 a I-04. Texto livre na v1 (o delegado não é usuário do sistema). |
| `tipo` | enum: `fazer` \| `delegada` \| `adiada` \| `null` | não | `null` = aguardando triagem. |
| `prazo` | date | condicional | Ver I-02 e I-04. |
| `checkpoint` | date | condicional | Ver I-02. Sem hora; granularidade de dia. |
| `status` | enum: `nao_iniciada` \| `em_andamento` \| `bloqueada` \| `aguardando` \| `concluida` | sim | Default `nao_iniciada`. |
| `descartada_em` | datetime \| null | não | Soft delete. Ver I-09. |
| `criada_em` | datetime | sim | Gerado pelo servidor. Imutável. |
| `atualizada_em` | datetime | sim | Gerado pelo servidor. |

### 3.2 Referência (N por compromisso)

| Atributo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | inteiro | sim | |
| `compromisso_id` | FK | sim | Exclusão em cascata junto com o compromisso. |
| `descricao` | texto (≤ 140 chars) | não | Se vazia, a UI exibe a URL. |
| `url` | texto (≤ 2048 chars) | sim | DEVE ser URL válida com esquema http/https. |
| `criada_em` | datetime | sim | |

Referências PODEM ser removidas (são atalhos, não fatos históricos).

### 3.3 Entrada de registro (N por compromisso)

| Atributo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `id` | inteiro | sim | |
| `compromisso_id` | FK | sim | |
| `data` | date | sim | Data do fato. Default: hoje. |
| `texto` | texto (≤ 2000 chars) | sim | Não vazio após trim. |
| `origem` | enum: `usuario` \| `sistema` | sim | Entradas automáticas usam `sistema`. |
| `criada_em` | datetime | sim | |

Entradas de registro são **imutáveis**. Ver I-05.

---

## 4. Ciclo de vida e estados

O compromisso tem duas dimensões de estado independentes:

**Dimensão 1 — ciclo de vida** (derivada, não armazenada como coluna própria):

```
capturado ──triagem──▶ ativo ──concluir──▶ concluído
    │                    │                     │
    └────descartar───────┴─────descartar───────┘  (soft delete)
```

- `capturado`: `tipo IS NULL` e `descartada_em IS NULL`
- `ativo`: `tipo IS NOT NULL`, `status != concluida`, `descartada_em IS NULL`
- `concluído`: `status = concluida`, `descartada_em IS NULL`
- `descartado`: `descartada_em IS NOT NULL`

**Dimensão 2 — status de trabalho** (coluna `status`): qualquer transição entre os
cinco valores é permitida (inclusive reabrir: `concluida → em_andamento`), e toda
transição gera entrada automática no registro (ver §6).

São exatamente 5 valores de status. NÃO DEVE existir status "atrasada": atraso é
condição **derivada** (ver §5), nunca armazenada.

---

## 5. Condições derivadas (calculadas, nunca persistidas)

| Condição | Definição |
|---|---|
| `checkpoint_vencido` | compromisso ativo ∧ `checkpoint` < hoje |
| `prazo_estourado` | compromisso ativo ∧ `prazo` < hoje |
| `precisa_atencao` | `checkpoint_vencido` ∨ `prazo_estourado` ∨ `status = bloqueada` |
| `comigo` | `tipo = fazer` ∨ `dono` normalizado = `eu` (case-insensitive, trim) |

"Hoje" é avaliado no fuso do usuário (v1: `America/Sao_Paulo` fixo). A API DEVE
retornar essas condições computadas em cada compromisso para a UI não reimplementar
a regra.

**Métricas do painel:**

| Métrica | Definição |
|---|---|
| Compromissos ativos | count(ativos) |
| Checkpoints vencidos | count(ativos com `checkpoint_vencido`) |
| Prazos estourados | count(ativos com `prazo_estourado`) |
| Carga | round(100 × count(ativos com `comigo`) / count(ativos)); 0 se não há ativos |
| Alerta de carga | carga > 30 |

---

## 6. Entradas automáticas de registro (origem `sistema`)

O sistema DEVE gravar automaticamente, com a data corrente:

| Evento | Texto (padrão) |
|---|---|
| Captura | `Capturada.` |
| Triagem → fazer | `Triagem: execução própria.` |
| Triagem → delegada | `Delegada para {dono}. Prazo {prazo}, checkpoint {checkpoint}.` |
| Triagem → adiada | `Triagem: adiada para {prazo}.` |
| Mudança de status | `Status: {anterior} → {novo}.` |
| Mudança de prazo (quando já havia prazo) | `Prazo alterado de {anterior} para {novo}.` |
| Mudança de checkpoint (quando já havia) | `Checkpoint alterado de {anterior} para {novo}.` |
| Mudança de dono (quando já havia) | `Dono alterado de {anterior} para {novo}.` |
| Conclusão | `Compromisso concluído.` |
| Descarte | `Compromisso descartado.` |

Racional: o histórico de uma delegação deve se escrever sozinho — é a base da
cobrança objetiva ("no dia 09 você confirmou o prazo, o que mudou?").

---

## 7. Invariantes (normativas e testáveis)

Cada invariante tem ID estável. Testes DEVEM referenciar esses IDs. Violações em
escrita via API DEVEM retornar **HTTP 422** com corpo
`{ "erro": "<ID>", "mensagem": "<texto humano>" }`.

- **I-01 — Título obrigatório.** `titulo` não pode ser vazio após trim, em criação ou edição.

- **I-02 — Delegação completa.** Se `tipo = delegada`: `dono` é obrigatório e,
  normalizado, NÃO PODE ser `eu`; `prazo` é obrigatório; `checkpoint` é obrigatório;
  e `checkpoint` DEVE ser estritamente anterior a `prazo`. A invariante vale na
  transição para `delegada` e em qualquer edição posterior enquanto `tipo = delegada`.

- **I-03 — Execução própria.** Se `tipo = fazer`, o sistema DEVE definir `dono = Eu`
  automaticamente; o campo não é editável nesse tipo. `checkpoint` PODE ser nulo.

- **I-04 — Adiamento com data.** Se `tipo = adiada`, `prazo` é obrigatório
  ("adiar" sem data é esquecer com etapas extras).

- **I-05 — Registro imutável.** Entradas de registro só podem ser criadas. NÃO DEVE
  existir endpoint, mutação ou query de UPDATE ou DELETE para entradas de registro.
  A exclusão definitiva só ocorre em cascata com a exclusão física do compromisso
  (operação administrativa fora do escopo da v1).

- **I-06 — Atraso é derivado.** Nenhuma coluna persiste "atrasada", "vencido" ou
  equivalente. Essas condições são calculadas conforme §5 em tempo de leitura.

- **I-07 — Triagem precede planejamento.** Compromisso com `tipo IS NULL` aparece
  exclusivamente na fila de entrada; NÃO DEVE aparecer na lista principal nem
  contar nas métricas de carga, checkpoint ou prazo. (Conta apenas no contador da
  própria fila de entrada.)

- **I-08 — Conclusão registrada.** Transição para `status = concluida` DEVE gravar a
  entrada automática de conclusão. Compromisso concluído PODE ser reaberto
  (mudando o status), gerando a entrada automática correspondente.

- **I-09 — Descarte é soft delete.** Descartar preenche `descartada_em` e grava a
  entrada automática. Compromissos descartados não aparecem em nenhuma listagem da
  v1 e não contam em nenhuma métrica, mas permanecem no banco para auditoria.

- **I-10 — Datas sem hora.** `prazo`, `checkpoint` e `data` do registro são datas
  puras (sem componente de hora). Comparações usam a data corrente no fuso do
  usuário.

- **I-11 — Carga calculada no servidor.** O percentual de carga e o alerta (> 30%)
  são calculados pela API conforme §5. A UI apenas exibe.

- **I-12 — Validação de URL.** Referências DEVEM ter URL http/https sintaticamente
  válida; outros esquemas (`javascript:`, `data:` etc.) DEVEM ser rejeitados com 422.

---

## 8. Regras de interface derivadas do domínio

(Detalhamento visual fica em `04-frontend.md`; estas regras são de domínio.)

- A fila de triagem só é exibida quando há ao menos um compromisso capturado, e
  oferece exatamente quatro ações: Fazer, Delegar, Adiar, Descartar.
- A lista principal DEVE sinalizar visualmente `checkpoint_vencido` e
  `prazo_estourado`, com `prazo_estourado` prevalecendo quando ambos ocorrem.
- O indicador de carga DEVE exibir a marca fixa de 30% e mudar para o estado de
  alerta quando excedido.
- Filtros mínimos da lista: Ativas (default), Comigo, Delegadas, Atenção
  (`precisa_atencao`), Concluídas.
- O registro é exibido do mais recente para o mais antigo e não oferece edição.

---

## 9. Fora do escopo da v1 (explícito)

- Multiusuário, times, papéis e permissões. A v1 tem um usuário autenticado por
  conta; `Eu` refere-se sempre a ele; delegados são texto livre, não contas.
- Notificações (e-mail, push, Slack) de checkpoint ou prazo.
- Comentários de terceiros, anexos de arquivo, tags ou categorias.
- Recorrência de compromissos.
- Edição ou exclusão de entradas de registro (proibido por I-05, não é dívida).
- Hard delete pela interface.

Qualquer item desta lista que pareça "fácil de incluir de passagem" NÃO DEVE ser
implementado sem nova spec de feature.

---

## 10. Cenários canônicos de aceite

Cenários de referência que toda implementação DEVE satisfazer (base para testes
end-to-end; detalhes por feature ficam em `docs/features/`):

**C-01 — Captura sem fricção.** Dado o campo de captura, quando o usuário envia
apenas um título, então o compromisso é criado com `tipo = null`,
`status = nao_iniciada`, entrada `Capturada.` no registro, e aparece na fila de
triagem — sem exigir nenhum outro campo.

**C-02 — Delegação exige checkpoint.** Dado um compromisso em triagem, quando o
usuário escolhe Delegar e tenta salvar com checkpoint igual ou posterior ao prazo
(ou ausente), então a API responde 422 com `erro: "I-02"` e nada é persistido.

**C-03 — Checkpoint vencido aparece sozinho.** Dado um compromisso delegado com
checkpoint anterior a hoje e status diferente de concluída, quando a lista é
carregada, então o item exibe a sinalização de checkpoint vencido e entra no filtro
Atenção — sem qualquer ação do usuário.

**C-04 — Registro conta a história.** Dado um compromisso delegado que sofreu uma
mudança de prazo e uma mudança de status, quando o usuário abre a ficha, então o
registro mostra, em ordem do mais recente para o mais antigo: as duas entradas
automáticas e a entrada de delegação original — todas datadas e sem opção de edição.

**C-05 — Alerta de gargalo.** Dados 10 compromissos ativos, sendo 4 com dono `Eu`,
quando o painel é carregado, então a carga exibida é 40% e o indicador está em
estado de alerta (40 > 30).