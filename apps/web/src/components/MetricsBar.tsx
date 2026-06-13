import { useQuery } from '@tanstack/react-query'
import { getMetricas } from '../api/metricas.js'
import { CargaGauge } from './CargaGauge.js'
// @ts-ignore
import styles from './MetricsBar.module.css'

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.card}>
      <span className={styles.cardLabel}>{label}</span>
      <span className={styles.cardValue}>{value}</span>
    </div>
  )
}

function MetricCardSkeleton() {
  return (
    <div className={styles.card}>
      <span className={styles.skeleton} style={{ width: '70%', height: '11px' }} />
      <span className={styles.skeleton} style={{ width: '40%', height: '28px', marginTop: '4px' }} />
    </div>
  )
}

export function MetricsBar() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['metricas'],
    queryFn: getMetricas,
  })

  if (isError) {
    return (
      <div className={styles.error}>
        <span>Erro ao carregar métricas.</span>
        <button className={styles.retryBtn} onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  return (
    <div className={styles.bar}>
      {isLoading || !data ? (
        <>
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <div className={`${styles.card} ${styles.cardGauge}`}>
            <span className={styles.skeleton} style={{ width: '60%', height: '11px' }} />
            <span className={styles.skeleton} style={{ width: '100%', height: '8px', marginTop: '12px' }} />
          </div>
        </>
      ) : (
        <>
          <MetricCard label="Ativos" value={data.ativos} />
          <MetricCard label="Checkpoints vencidos" value={data.checkpointsVencidos} />
          <MetricCard label="Prazos estourados" value={data.prazosEstourados} />
          <div className={`${styles.card} ${styles.cardGauge}`}>
            <CargaGauge carga={data.carga} alertaCarga={data.alertaCarga} />
          </div>
        </>
      )}
    </div>
  )
}
