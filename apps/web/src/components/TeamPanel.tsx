import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getEquipe } from '../api/compromissos.js'
// @ts-ignore
import styles from './TeamPanel.module.css'

function NumBadge({ value, alerta }: { value: number; alerta?: boolean }) {
  return (
    <span className={`${styles.numBadge} ${alerta && value > 0 ? styles.numAlerta : styles.numNeutral}`}>
      {value}
    </span>
  )
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

      <div className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Dono</th>
            <th>Ativos</th>
            <th className={styles.hideMobile}>CK Vencido</th>
            <th className={styles.hideMobile}>Prazo Estourado</th>
            <th>Bloqueados</th>
          </tr>
        </thead>
        <tbody>
          {data.membros.map((m) => (
            <tr
              key={m.dono}
              className={styles.row}
              tabIndex={0}
              role="button"
              aria-label={`Ver compromissos de ${m.dono}`}
              onClick={() => verDono(m.dono)}
              onKeyDown={(e) => { if (e.key === 'Enter') verDono(m.dono) }}
            >
              <td className={styles.nome}>{m.dono}</td>
              <td><NumBadge value={m.ativos} /></td>
              <td className={styles.hideMobile}>
                <NumBadge value={m.checkpointsVencidos} alerta />
              </td>
              <td className={styles.hideMobile}>
                <NumBadge value={m.prazosEstourados} alerta />
              </td>
              <td>
                <NumBadge value={m.bloqueados} alerta />
              </td>
            </tr>
          ))}
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
              {[1, 2, 3, 4, 5].map((j) => (
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
