// @ts-ignore
import styles from './CargaGauge.module.css'

interface CargaGaugeProps {
  carga: number
  alertaCarga: boolean
}

export function CargaGauge({ carga, alertaCarga }: CargaGaugeProps) {
  const pct = Math.min(carga, 100)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.label}>Carga comigo</span>
        <span className={`${styles.valor} ${alertaCarga ? styles.valorAlerta : ''}`}>
          {carga}%
        </span>
      </div>

      <div className={styles.trilhoWrap}>
        <span className={styles.marcaLabel} aria-hidden="true">30%</span>
        <div className={styles.trilho} role="meter" aria-label={`Carga comigo: ${carga}%`} aria-valuenow={carga} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`${styles.barra} ${alertaCarga ? styles.barraAlerta : ''}`}
            style={{ width: `${pct}%` }}
          />
          <div className={styles.marca} aria-hidden="true" />
        </div>
      </div>

      {alertaCarga && (
        <p className={styles.legenda}>acima de 30% — delegue mais</p>
      )}
    </div>
  )
}
