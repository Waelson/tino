import { useQuery, useMutation } from '@tanstack/react-query'
import { getRiscoBriefingCache, gerarRiscoBriefing } from '../api/risco.js'
import type { RiscoBriefing as RiscoBriefingType } from '../types/api.js'
// @ts-ignore
import styles from './RiscoBriefing.module.css'

function formatarHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function RiscoBriefing() {
  const { data: cacheData, isLoading: loadingCache, refetch: refetchCache } = useQuery({
    queryKey: ['risco-briefing-cache'],
    queryFn: getRiscoBriefingCache,
  })

  const briefingCache: RiscoBriefingType | null =
    cacheData?.disponivel ? cacheData : null

  const dadosMudaram = briefingCache !== null && !briefingCache.estaAtualizado

  const {
    data: briefingGerado,
    isPending: gerando,
    isError: erroIA,
    mutate: gerar,
    reset: resetGerar,
  } = useMutation({
    mutationFn: gerarRiscoBriefing,
    onSuccess: () => void refetchCache(),
  })

  const briefing: RiscoBriefingType | null = briefingGerado ?? briefingCache

  const loadingBriefing = loadingCache || gerando

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>
          Briefing de risco
          <span className={styles.badge}>IA</span>
        </span>
      </div>

      {loadingBriefing ? (
        <SkeletonBriefing />
      ) : erroIA ? (
        <>
          <p className={styles.error}>Briefing indisponível no momento.</p>
          <button className={styles.btn} onClick={() => { resetGerar(); gerar() }}>Tentar novamente</button>
        </>
      ) : briefing ? (
        <>
          <div className={styles.status}>
            <span className={`${styles.dot} ${briefing.estaAtualizado ? styles.dotOk : styles.dotStale}`} />
            {briefing.estaAtualizado
              ? `Atualizado · gerado ${formatarHora(briefing.geradoEm)}`
              : `Desatualizado · gerado ${formatarHora(briefing.geradoEm)} · novos dados disponíveis`}
          </div>

          <p className={styles.briefing}>{briefing.briefing}</p>

          <div className={styles.acaoWrap}>
            <span className={styles.acaoLabel}>Ação prioritária</span>
            <p className={styles.acao}>{briefing.acaoPrioritaria}</p>
          </div>

          {dadosMudaram && !briefingGerado && (
            <button className={styles.btnSecondary} disabled={gerando} onClick={() => gerar()}>
              Atualizar briefing
            </button>
          )}
        </>
      ) : (
        <button
          className={styles.btn}
          disabled={loadingCache}
          onClick={() => gerar()}
        >
          Gerar briefing com IA
        </button>
      )}
    </div>
  )
}

function SkeletonBriefing() {
  return (
    <div className={styles.skeletonWrap}>
      {[90, 75, 60, 85].map((w, i) => (
        <span key={i} className={styles.skeleton} style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}
