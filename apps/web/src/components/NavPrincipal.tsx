import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getMetricas } from '../api/metricas.js'
// @ts-ignore
import styles from './NavPrincipal.module.css'

export type Secao = 'compromissos' | 'equipe' | 'revisao' | 'timeline'

const TABS: { id: Secao; label: string; icone: string }[] = [
  { id: 'compromissos', label: 'Compromissos', icone: '◎' },
  { id: 'equipe',       label: 'Equipe',        icone: '⊞' },
  { id: 'revisao',      label: 'Revisão',       icone: '✦' },
  { id: 'timeline',     label: 'Timeline',      icone: '◈' },
]

export function NavPrincipal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const secaoAtual = (searchParams.get('secao') ?? 'compromissos') as Secao

  const { data: metricas } = useQuery({
    queryKey: ['metricas'],
    queryFn: getMetricas,
  })

  const atencao = metricas?.precisamAtencao ?? 0

  function navegar(secao: Secao) {
    if (secao === secaoAtual) return
    // Troca de seção limpa filtros e busca
    if (secao === 'compromissos') {
      setSearchParams({})
    } else {
      setSearchParams({ secao })
    }
  }

  return (
    <nav className={styles.nav} role="tablist" aria-label="Seções do painel">
      {TABS.map((tab) => {
        const ativo = secaoAtual === tab.id
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={ativo}
            className={`${styles.tab} ${ativo ? styles.tabAtivo : ''}`}
            onClick={() => navegar(tab.id)}
          >
            <span className={styles.icone} aria-hidden="true">{tab.icone}</span>
            <span className={styles.label}>{tab.label}</span>
            {tab.id === 'compromissos' && atencao > 0 && (
              <span className={styles.badge} aria-label={`${atencao} itens precisam de atenção`}>
                {atencao}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
