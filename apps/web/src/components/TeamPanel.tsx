import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getEquipe } from '../api/compromissos.js'
// @ts-ignore
import styles from './TeamPanel.module.css'

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
        <div className={styles.empty}>Nenhuma delegação ativa no momento.</div>
      </section>
    )
  }

  return (
    <section className={styles.wrap} aria-label="Painel de equipe">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Dono</th>
            <th>Ativos</th>
            <th className={styles.hideMobile}>Checkpoint vencido</th>
            <th className={styles.hideMobile}>Prazo estourado</th>
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
              <td className={styles.num}>{m.ativos}</td>
              <td className={styles.hideMobile}>
                {m.checkpointsVencidos > 0
                  ? <span className={styles.alerta}>{m.checkpointsVencidos}</span>
                  : <span className={styles.ok}>—</span>}
              </td>
              <td className={styles.hideMobile}>
                {m.prazosEstourados > 0
                  ? <span className={styles.alerta}>{m.prazosEstourados}</span>
                  : <span className={styles.ok}>—</span>}
              </td>
              <td>
                {m.bloqueados > 0
                  ? <span className={styles.alerta}>{m.bloqueados}</span>
                  : <span className={styles.ok}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function SkeletonRows() {
  return (
    <section className={styles.wrap} aria-label="Painel de equipe">
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
    </section>
  )
}
