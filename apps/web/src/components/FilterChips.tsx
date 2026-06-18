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

  const { data: metricas } = useQuery({
    queryKey: ['metricas'],
    queryFn: getMetricas,
  })

  function selecionar(filtro: FiltroLista) {
    if (qAtivo) return
    const params: Record<string, string> = filtro === 'ativas' ? {} : { filtro }
    setSearchParams(params)
  }

  return (
    <div className={styles.filters} role="tablist" aria-label="Filtrar compromissos">
      {CHIPS.map((chip) => {
        const ativo = filtroAtual === chip.id
        const contador = chip.contador !== undefined ? metricas?.[chip.contador] : undefined
        return (
          <button
            key={chip.id}
            role="tab"
            aria-selected={ativo}
            disabled={qAtivo}
            aria-disabled={qAtivo}
            className={`${styles.chip} ${ativo ? styles.chipOn : ''} ${qAtivo ? styles.chipDisabled : ''}`}
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
