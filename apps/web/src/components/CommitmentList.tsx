import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listar } from '../api/compromissos.js'
import type { Compromisso } from '../types/api.js'
import type { FiltroLista } from './FilterChips.js'
// @ts-ignore
import styles from './CommitmentList.module.css'

// Elemento de origem para devolução de foco ao fechar o drawer (A-19)
export let originElement: HTMLElement | null = null
export function saveOrigin() {
  originElement = document.activeElement as HTMLElement
}

const STATUS_LABELS: Record<string, string> = {
  nao_iniciada: 'Não iniciada',
  em_andamento: 'Em andamento',
  bloqueada: 'Bloqueada',
  aguardando: 'Aguardando',
  concluida: 'Concluída',
}

const STATUS_CLASS: Record<string, string> = {
  nao_iniciada: styles.bNao,
  em_andamento: styles.bAnd,
  bloqueada: styles.bBlo,
  aguardando: styles.bAgu,
  concluida: styles.bCon,
}

const TIPO_LABELS: Record<string, string> = {
  fazer: 'Fazer',
  delegada: 'Delegada',
  adiada: 'Adiada',
}

const EMPTY_MESSAGES: Record<FiltroLista, { principal: string; dica?: string }> = {
  ativas:     { principal: 'Nenhum compromisso por aqui ainda.', dica: 'Capture a primeira demanda no campo acima.' },
  comigo:     { principal: 'Nenhum compromisso com você agora.' },
  delegadas:  { principal: 'Nenhuma delegação no momento.' },
  atencao:    { principal: 'Nada precisa de atenção. Bom sinal.' },
  concluidas: { principal: 'Nenhum compromisso concluído ainda.' },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function CommitmentList() {
  const [searchParams] = useSearchParams()
  const filtro = (searchParams.get('filtro') ?? 'ativas') as FiltroLista

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['compromissos', filtro],
    queryFn: () => listar(filtro),
  })

  const emptyMsg = EMPTY_MESSAGES[filtro]

  return (
    <section className={styles.wrap} aria-label="Lista de compromissos">
      {isLoading && <SkeletonRows />}

      {isError && (
        <div className={styles.error}>
          <p>Erro ao carregar compromissos.</p>
          <button className={styles.retryBtn} onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </div>
      )}

      {!isLoading && !isError && data?.itens.length === 0 && (
        <div className={styles.empty}>
          <p>{emptyMsg.principal}</p>
          {emptyMsg.dica && <p className={styles.emptyHint}>{emptyMsg.dica}</p>}
        </div>
      )}

      {!isLoading && !isError && data && data.itens.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thTitulo}>Resultado esperado</th>
              <th>Dono</th>
              <th className={styles.hideMobile}>Tipo</th>
              <th>Prazo</th>
              <th className={styles.hideMobile}>Checkpoint</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.itens.map((item) => (
              <CommitmentRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function CommitmentRow({ item }: { item: Compromisso }) {
  const navigate = useNavigate()
  const statusLabel = STATUS_LABELS[item.status] ?? item.status
  const statusClass = STATUS_CLASS[item.status] ?? styles.bNao

  // A-24: prazoEstourado tem precedência sobre checkpointVencido — flag única
  const flag: 'prazo' | 'checkpoint' | null =
    item.prazoEstourado ? 'prazo' :
    item.checkpointVencido ? 'checkpoint' :
    null

  function abrir() {
    saveOrigin()
    void navigate(`/compromissos/${item.id}`)
  }

  return (
    <tr
      className={styles.row}
      tabIndex={0}
      role="button"
      aria-label={`Abrir ficha: ${item.titulo}`}
      onClick={abrir}
      onKeyDown={(e) => { if (e.key === 'Enter') abrir() }}
    >
      <td className={styles.tdTitulo}>
        <span className={styles.titulo}>{item.titulo}</span>
        {flag === 'prazo' && (
          <span className={styles.flag}>prazo estourado</span>
        )}
        {flag === 'checkpoint' && (
          <span className={styles.flag}>checkpoint vencido</span>
        )}
      </td>
      <td>
        <span className={item.comigo ? styles.donoEu : undefined}>
          {item.dono ?? '—'}
        </span>
      </td>
      <td className={styles.hideMobile}>
        <span className={styles.muted}>{TIPO_LABELS[item.tipo ?? ''] ?? '—'}</span>
      </td>
      <td>
        <span className={`${styles.mono}${item.prazoEstourado ? ` ${styles.late}` : ''}`}>
          {fmtDate(item.prazo)}
        </span>
      </td>
      <td className={styles.hideMobile}>
        <span className={`${styles.mono}${item.checkpointVencido ? ` ${styles.late}` : ''}`}>
          {fmtDate(item.checkpoint)}
        </span>
      </td>
      <td>
        <span className={`${styles.badge} ${statusClass}`}>{statusLabel}</span>
      </td>
    </tr>
  )
}

function SkeletonRows() {
  return (
    <table className={styles.table}>
      <tbody>
        {[1, 2, 3].map((i) => (
          <tr key={i} className={styles.row}>
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <td key={j}>
                <span className={styles.skeleton} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
