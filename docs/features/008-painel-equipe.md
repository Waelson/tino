# Feature 008 — Painel de equipe (carga por dono)

## Problema

O tech leader delega compromissos a várias pessoas. Hoje só consegue ver a carga
de cada uma filtrando manualmente por nome (`?dono=`). A pergunta
"quem da minha equipe está sobrecarregado agora?" não tem resposta rápida.

## Solução

Chip **"Equipe"** na barra de filtros. Quando selecionado, exibe uma tabela com
todos os donos que têm compromissos ativos, mostrando de relance:

- Total de ativos
- Checkpoints vencidos
- Prazos estourados
- Bloqueados

Clicar em qualquer linha navega para `?dono=<nome>`, abrindo a lista completa
daquele dono.

## Critério de inclusão por dono

```
status != 'concluida'
AND tipo IS NOT NULL
AND descartada_em IS NULL
AND dono IS NOT NULL
AND TRIM(dono) != ''
```

Agrupado por `dono`, ordenado por `COUNT(*) DESC` (mais sobrecarregados primeiro).

## Contrato de API

`GET /compromissos/equipe` → `{ membros: DonoMetricas[] }`

```ts
interface DonoMetricas {
  dono: string
  ativos: number
  checkpointsVencidos: number
  prazosEstourados: number
  bloqueados: number
}
```

## UI

- Chip "Equipe" posicionado entre "Delegadas" e "Atenção"
- Tabela: Dono | Ativos | Checkpoint vencido | Prazo estourado | Bloqueados
- Valores de alerta (> 0) em destaque vermelho com fundo âmbar
- Clicar na linha → `?dono=<nome>` (navega para lista filtrada)
- Mensagem vazia: "Nenhuma delegação ativa no momento."
- `CommitmentList` é substituída por `TeamPanel` quando `filtro=equipe`

## Fora do escopo

- Donos com apenas itens concluídos
- Donos com dono = null ou string vazia
- Itens em triagem (tipo = null)
- Itens descartados
- Histórico ou tendências de carga ao longo do tempo

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `apps/api/src/compromissos/compromissos.repo.ts` | `equipe()` + `DonoMetricasRow` |
| `apps/api/src/compromissos/compromissos.service.ts` | `obterEquipe()` + `DonoMetricasApi` |
| `apps/api/src/compromissos/compromissos.router.ts` | `GET /equipe` (antes de `/:id`) |
| `apps/web/src/types/api.ts` | `DonoMetricas` + `EquipeResponse` |
| `apps/web/src/api/compromissos.ts` | `getEquipe()` |
| `apps/web/src/components/FilterChips.tsx` | `FiltroPainel` + chip "Equipe" |
| `apps/web/src/components/TeamPanel.tsx` | Componente novo |
| `apps/web/src/components/TeamPanel.module.css` | Estilos novos |
| `apps/web/src/pages/Painel.tsx` | Renderização condicional `TeamPanel` / `CommitmentList` |
| `apps/api/test/compromissos/equipe.test.ts` | 10 testes de integração |
