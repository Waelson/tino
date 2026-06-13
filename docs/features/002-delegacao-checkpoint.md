# Feature 002 — Ficha do compromisso e acompanhamento da delegação

> Spec de feature. Segunda fatia vertical: entrega a **ficha do item** — o lugar
> onde a delegação é acompanhada (edição de dono/prazo/checkpoint, referências,
> registro datado, concluir e descartar). Cobre exatamente o que a feature 001
> adiou em seu §2.2, exceto métricas e filtros (feature 003).
> Documentos normativos: `01-dominio.md`, `02-dados.md`, `03-api.md`,
> `04-frontend.md`. Esta spec só seleciona e sequencia; em conflito, eles prevalecem.
> Pré-requisito: feature 001 concluída (definição de pronto satisfeita).

---

## 1. Objetivo

Ao final desta fatia, o usuário clica em qualquer item da lista e abre a ficha
completa: edita os campos com salvamento automático, anexa referências (Slack,
docs, PRs), adiciona anotações datadas ao registro, vê a história do item se
escrever sozinha (entradas automáticas), conclui e descarta. É a fatia que
materializa o coração do método: **delegar sem checkpoint é abandono, e cobrar
sem registro é discussão**.

---

## 2. Escopo

### 2.1 Dentro

| Camada | Itens |
|---|---|
| Banco | Migration da tabela `referencias` + índice `idx_ref_comp` (`02-dados.md` §3.3, §7). |
| API | `GET /compromissos/:id` (CompromissoDetalhe) · `PATCH /compromissos/:id` · `POST /:id/concluir` · `POST /:id/descartar` · `POST /:id/referencias` · `DELETE /:id/referencias/:refId` · `POST /:id/registro` (`03-api.md` §§4–6). |
| Domínio/serviço | Invariantes I-01…I-05, I-08, I-09, I-12 no contexto de edição; entradas automáticas de mudança de status/prazo/checkpoint/dono, conclusão e descarte (`01-dominio.md` §6); validação do **estado resultante** no PATCH; idempotência de concluir/descartar (`03-api.md` §1). |
| Frontend | Rota `/compromissos/:id` (drawer dirigido por rota, deep-link, 404 → toast e fecha); linhas da lista passam a ser clicáveis e focáveis (Enter abre); `CommitmentDrawer` completo: `FichaHeader`, `FichaForm` (salvar no blur/change, indicador por campo), `RefSection`, `LogSection`, `FichaFooter`; extensão do mapa de 422 com I-12; focus trap, Esc, devolução de foco (`04-frontend.md` §§3, 5.4, 7.4). |

### 2.2 Fora (explícito — NÃO implementar nem "deixar pronto")

- `GET /metricas`, `MetricsBar`, `CargaGauge` → feature 003.
- Filtros além de Ativas e flags de vencimento na lista (`checkpointVencido`/
  `prazoEstourado` na UI) → feature 003. (A API já devolve os campos calculados
  desde a 001 — apenas não há exibição.)
- Edição/exclusão de entradas do registro: proibido em definitivo (I-05), não é
  adiamento.
- Upload de arquivos, preview de links, ícones por tipo de referência.
- Qualquer item do §9 dos documentos normativos.

---

## 3. Critérios de aceite

O cenário canônico **C-04** (`01-dominio.md` §10) na íntegra, mais:

- **A-10 — Deep-link.** Acessar `/compromissos/:id` diretamente (refresh incluso)
  abre o painel com o drawer carregado; id inexistente ou de outro usuário fecha o
  drawer com toast "Compromisso não encontrado" (API 404).
- **A-11 — Salvamento por campo.** Alterar o checkpoint e sair do campo dispara
  `PATCH` apenas com o campo alterado; mudanças de status, prazo, checkpoint e
  dono (com valor anterior) aparecem como entradas automáticas no registro sem
  reload (invalidação `['compromisso', id]`).
- **A-12 — Edição não quebra delegação.** Em item `delegada`, limpar o checkpoint
  ou movê-lo para depois do prazo: API responde 422 `I-02`, o campo é destacado
  com a mensagem do mapa, e a UI restaura o valor vigente no servidor.
- **A-13 — Dono travado em execução própria.** Com `tipo = fazer`, o campo dono
  exibe `Eu` desabilitado; um `PATCH` forjado com outro dono é ignorado pelo
  servidor, que mantém `Eu` (I-03).
- **A-14 — Registro append-only de ponta a ponta.** Adicionar anotação manual a
  insere com `origem = usuario` e data de hoje no topo; a linha do tempo não tem
  nenhum affordance de edição/exclusão; rotas de mutação do registro não existem
  (teste de contrato, `03-api.md` §6); UPDATE/DELETE direto falha por GRANT
  (reaproveita A-08).
- **A-15 — Referências válidas.** Adicionar URL https cria e exibe na hora;
  `javascript:alert(1)` e `ftp://…` respondem 422 `I-12` com destaque no campo;
  remover responde 204 e some da lista; referência de outro compromisso → 404.
- **A-16 — Conclusão idempotente.** Concluir grava a entrada automática, fecha o
  drawer com toast e o item sai de Ativas; chamar `/concluir` de novo responde 200
  sem criar **segunda** entrada no registro.
- **A-17 — Descarte da ficha.** Confirmar o descarte preenche `descartada_em`,
  grava a entrada automática, fecha o drawer; o item não aparece em nenhuma
  listagem e `GET /compromissos/:id` passa a responder 404 (I-09).
- **A-18 — Reabertura registrada.** Em item concluído, mudar o status para
  `em_andamento` é aceito e gera a entrada automática de transição (I-08, §4 do
  ciclo de vida).
- **A-19 — Acessibilidade do drawer.** Foco preso no drawer enquanto aberto; Esc
  fecha; ao fechar, o foco volta à linha de origem na lista.

---

## 4. Plano de testes

| Tipo | Conteúdo |
|---|---|
| Unidade (serviço) | Validador de PATCH: matriz tipo × campo alterado × estado resultante (I-02/I-03/I-04); gerador de entradas automáticas (uma por mudança real, nenhuma quando o valor não muda); normalização de URL (I-12). |
| Integração (API + MySQL) | Linhas do mapa rota→invariante (`03-api.md` §8) no escopo desta fatia, nomeadas pelo ID; A-12 (transacionalidade do 422); A-16 (idempotência sem entrada duplicada); A-17; teste de contrato da ausência de rotas (A-14). |
| Componente (React) | `FichaForm` (PATCH por campo, restauração em 422, dono travado); `LogSection` (ordenação `data DESC, id DESC`, ausência de controles); `RefSection` (mapa de I-12); drawer (focus trap, Esc, devolução de foco — A-19). |
| E2E (Playwright) | `c04-registro.spec.ts` reproduzindo C-04 literalmente; um spec de jornada da ficha cobrindo A-10 → A-11 → A-16. |

---

## 5. Sequência de execução sugerida (sessões de Claude Code)

Uma sessão por etapa, contexto limpo, plan mode antes de cada uma, gate ao final:

1. **Banco + leitura da ficha**: migration de `referencias`; `GET /compromissos/:id`
   com as três consultas de `02-dados.md` §6.4 (sem N+1 — verificar por teste que
   conta queries). Gate: integração do detalhe verde, inclusive 404 de descartado.
2. **PATCH + entradas automáticas**: validação de estado resultante, transação
   campo+registro, idempotência de noop. Gate: matriz de unidade + A-12, A-13.
3. **Ações e coleções**: `/concluir`, `/descartar`, referências, anotação manual.
   Gate: A-15, A-16, A-17, A-18 e contrato A-14.
4. **Frontend do drawer**: rota, componentes, salvar no blur, mapas de 422,
   acessibilidade. Gate: testes de componente + A-10, A-19.
5. **E2E + revisão**: c04 e jornada da ficha verdes; revisão independente em
   contexto limpo do diff total contra esta spec, com atenção ao §2.2.

---

## 6. Definição de pronto da feature

- C-04 + A-10…A-19 verificados por teste automatizado.
- Nenhum item do §2.2 implementado.
- Nenhuma regressão: suíte completa da feature 001 segue verde.
- Revisão independente (etapa 5) sem achados pendentes.
- `CLAUDE.md` atualizado se surgiram comandos novos (ex.: migration de referências
  no fluxo de setup).

---

## 7. Riscos e perguntas em aberto

- **Corrida no salvar-no-blur**: dois PATCHes em voo (usuário edita dois campos
  rápido) podem intercalar. Mitigação v1: serializar mutações da ficha numa fila
  por compromisso no cliente (uma de cada vez); registrar em
  `decisoes/00X-concorrencia-ficha.md` que lock otimista fica para depois.
- **Focus trap**: implementar à mão é propenso a bug; avaliar utilitário pequeno
  (ex.: `focus-trap`) em vez de dependência de UI completa — registrar ADR se
  adotar.
- **`confirm()` nativo no descarte**: mantido na v1 pela simplicidade (igual ao
  protótipo); modal próprio só se a revisão de acessibilidade apontar problema.
- **Entradas automáticas duplicadas**: PATCH com o mesmo valor vigente NÃO gera
  entrada (definido em §4 — "uma por mudança real"); o teste de unidade do gerador
  é o guardião disso.