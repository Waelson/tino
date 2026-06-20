import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getEquipe } from '../api/compromissos.js'
import type { DonoMetricas } from '../types/api.js'
// @ts-ignore
import styles from './TeamPanel.module.css'

function NumBadge({ value, alerta }: { value: number; alerta?: boolean }) {
  return (
    <span className={`${styles.numBadge} ${alerta && value > 0 ? styles.numAlerta : styles.numNeutral}`}>
      {value}
    </span>
  )
}

function HealthDot({ m }: { m: DonoMetricas }) {
  const isRed   = m.prazosEstourados > 0 || m.checkpointsVencidos > 0
  const isAmber = !isRed && (m.bloqueados > 0 || m.emRisco > 0)
  const cls = isRed ? styles.dotRed : isAmber ? styles.dotAmber : styles.dotGreen
  const icon = isRed ? 'priority_high' : isAmber ? 'warning' : 'check'
  return (
    <span className={`${styles.dot} ${cls}`} aria-hidden="true">
      <span className="material-symbols-outlined">{icon}</span>
    </span>
  )
}


function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function TeamPanel() {
  const [, setSearchParams] = useSearchParams()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['equipe'],
    queryFn: getEquipe,
  })

  function verDono(nome: string) {
    setSearchParams({ dono: nome })
  }

  if (isLoading) return <SkeletonRows />

  if (isError) {
    return (
      <div className={styles.error}>
        <p>Erro ao carregar painel de equipe.</p>
        <button className={styles.retryBtn} onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  if (!data || data.membros.length === 0) {
    return (
      <section className={styles.wrap} aria-label="Painel de equipe">
        <div className={styles.sectionHeader}>
          <span className={`material-symbols-outlined ${styles.sectionIcon}`}>groups</span>
          <span className={styles.sectionTitle}>Equipe</span>
        </div>
        <div className={styles.empty}>Nenhuma delegação ativa no momento.</div>
      </section>
    )
  }

  return (
    <section className={styles.wrap} aria-label="Painel de equipe">
      <div className={styles.sectionHeader}>
        <span className={`material-symbols-outlined ${styles.sectionIcon}`}>groups</span>
        <span className={styles.sectionTitle}>Equipe</span>
        <span className={styles.countBadge}>{data.membros.length}</span>
      </div>

      <div className={styles.legenda}>
        <span className={`${styles.dot} ${styles.dotGreen}`} aria-hidden="true">
          <span className="material-symbols-outlined">check</span>
        </span>
        <span className={styles.legendaTexto}>Tudo em dia</span>
        <span className={`${styles.dot} ${styles.dotAmber}`} aria-hidden="true">
          <span className="material-symbols-outlined">warning</span>
        </span>
        <span className={styles.legendaTexto}>Bloqueado ou prazo em risco</span>
        <span className={`${styles.dot} ${styles.dotRed}`} aria-hidden="true">
          <span className="material-symbols-outlined">priority_high</span>
        </span>
        <span className={styles.legendaTexto}>Prazo ou checkpoint estourado</span>
      </div>

      <div className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Dono</th>
            <th>Ativos</th>
            <th className={styles.hideMobile}>CK Vencido</th>
            <th className={styles.hideMobile}>Prazo Est.</th>
            <th className={styles.hideMobile}>Em Risco</th>
            <th className={styles.hideMobile}>Críticos</th>
            <th>Bloqueados</th>
            <th className={styles.hideMobile}>Próx. Prazo</th>
          </tr>
        </thead>
        <tbody>
          {data.membros.map((m) => {
            return (
              <tr
                key={m.dono}
                className={styles.row}
                tabIndex={0}
                role="button"
                aria-label={`Ver compromissos de ${m.dono}`}
                onClick={() => verDono(m.dono)}
                onKeyDown={(e) => { if (e.key === 'Enter') verDono(m.dono) }}
              >
                <td>
                  <div className={styles.donoCell}>
                    <HealthDot m={m} />
                    <span className={styles.nome}>{m.dono}</span>
                  </div>
                </td>
                <td><NumBadge value={m.ativos} /></td>
                <td className={styles.hideMobile}>
                  <NumBadge value={m.checkpointsVencidos} alerta />
                </td>
                <td className={styles.hideMobile}>
                  <NumBadge value={m.prazosEstourados} alerta />
                </td>
                <td className={styles.hideMobile}>
                  <NumBadge value={m.emRisco} alerta />
                </td>
                <td className={styles.hideMobile}>
                  <NumBadge value={m.criticos} alerta />
                </td>
                <td>
                  <NumBadge value={m.bloqueados} alerta />
                </td>
                <td className={styles.hideMobile}>
                  <span className={styles.prazoMono}>{fmtDate(m.proximoPrazo)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </section>
  )
}

function SkeletonRows() {
  return (
    <section className={styles.wrap} aria-label="Painel de equipe">
      <div className={styles.sectionHeader}>
        <span className={`material-symbols-outlined ${styles.sectionIcon}`}>groups</span>
        <span className={styles.sectionTitle}>Equipe</span>
      </div>
      <div className={styles.tableCard}>
      <table className={styles.table}>
        <tbody>
          {[1, 2, 3].map((i) => (
            <tr key={i} className={styles.row}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                <td key={j}><span className={styles.skeleton} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  )
}
