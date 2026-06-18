# Feature 007 — Foco da semana

## Problema

A reunião de segunda-feira começa com a pergunta: "o que precisa de mim essa semana?".
Hoje o tech leader precisa varrer três filtros (Ativas, Atenção, Delegadas) para
montar esse raio-x manualmente.

## Solução

Nova aba **"Esta semana"** na barra de filtros, reunindo em uma só tela:

- Compromissos com `prazo` ou `checkpoint` vencendo nos próximos 7 dias (inclusive hoje, inclusive vencidos)
- Compromissos com `status = 'em_andamento'` — independente do prazo

## Critério de inclusão

```
status != 'concluida'
AND tipo IS NOT NULL
AND descartada_em IS NULL
AND (
  (prazo      IS NOT NULL AND prazo      <= :prox7Dias)
  OR
  (checkpoint IS NOT NULL AND checkpoint <= :prox7Dias)
  OR
  status = 'em_andamento'
)
```

`:prox7Dias` = hoje + 7 dias, calculado no serviço com `addDias(hojeEmSP(), 7)` e
parametrizado na query — nunca `CURDATE()` (regra inviolável §6).

## Contrato de API

`GET /compromissos?filtro=semana`

Resposta idêntica aos demais filtros: `{ itens: CompromissoApi[] }`.

## UI

- Chip "Esta semana" posicionado entre "Ativas" e "Comigo" na barra de filtros
- Sem contador de badge (o valor seria redundante com a lista)
- Mensagem de lista vazia: "Nenhum compromisso para esta semana."
- Chip desabilitado quando `?q=` ou `?dono=` estão ativos (comportamento padrão)

## Ordenação

Mesma dos demais filtros:
1. `prazo IS NULL` (sem prazo por último)
2. `prazo ASC`
3. `criada_em DESC`

## Fora do escopo

- Itens em triagem (tipo = null)
- Itens descartados
- Itens concluídos
- Configuração do horizonte (fixo em 7 dias)
- Notificações ou alertas proativos

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `apps/api/src/compromissos/compromissos.schemas.ts` | `'semana'` adicionado ao enum `filtro` |
| `apps/api/src/compromissos/compromissos.repo.ts` | `FiltroLista` + `prox7Dias?` + branch `semana` |
| `apps/api/src/compromissos/compromissos.service.ts` | `addDias()` + passa `prox7Dias` ao repo |
| `apps/web/src/components/FilterChips.tsx` | Tipo + chip "Esta semana" |
| `apps/web/src/components/CommitmentList.tsx` | `EMPTY_MESSAGES.semana` |
| `apps/api/test/compromissos/semana.filter.test.ts` | 9 testes de integração |
