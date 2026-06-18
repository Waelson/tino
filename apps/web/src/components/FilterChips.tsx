import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getMetricas } from '../api/metricas.js'
// @ts-ignore
import styles from './FilterChips.module.css'

export type FiltroLista = 'ativas' | 'comigo' | 'delegadas' | 'atencao' | 'concluidas' | 'todas'

const CHIPS: { id: FiltroLista; label: string; contador?: keyof import('../types/api.js').Metricas }[] = [
  { id: 'ativas',     label: 'Ativas',     contador: 'ativos' },
  { id: 'comigo',     label: 'Comigo',     contador: 'comigo' },
  { id: 'delegadas',  label: 'Delegadas' },
  { id: 'atencao',    label: 'Atenção',    contador: 'precisamAtencao' },
  { id: 'concluidas', label: 'Concluídas' },
]

export function FilterChips() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filtroAtual = (searchParams.get('filtro') ?? 'ativas') as FiltroLista
  const qAtivo = !!searchParams.get('q')
  const donoAtivo = searchParams.get('dono')
  const desabilitar = qAtivo || !!donoAtivo

  const { data: metricas } = useQuery({
    queryKey: ['metricas'],
    queryFn: getMetricas,
  })

  function selecionar(filtro: FiltroLista) {
    if (desabilitar) return
    const params: Record<string, string> = filtro === 'ativas' ? {} : { filtro }
    setSearchParams(params)
  }

  return (
    <div className={styles.filters} role="tablist" aria-label="Filtrar compromissos">
      {donoAtivo && (
        <button
          className={`${styles.chip} ${styles.chipDono}`}
          onClick={() => setSearchParams({})}
          aria-label={`Remover filtro por dono: ${donoAtivo}`}
        >
          {donoAtivo} ×
        </button>
      )}
      {CHIPS.map((chip) => {
        const ativo = filtroAtual === chip.id
        const contador = chip.contador !== undefined ? metricas?.[chip.contador] : undefined
        return (
          <button
            key={chip.id}
            role="tab"
            aria-selected={ativo}
            disabled={desabilitar}
            aria-disabled={desabilitar}
            className={`${styles.chip} ${ativo ? styles.chipOn : ''} ${desabilitar ? styles.chipDisabled : ''}`}
            onClick={() => selecionar(chip.id)}
          >
            {chip.label}
            {contador !== undefined && (
              <span className={styles.chipN}>{contador as number}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
