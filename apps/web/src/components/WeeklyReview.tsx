import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getRevisao, getNarrativaCache, gerarNarrativa } from '../api/revisao.js'
import type {
  NarrativaIA,
  CompromissoConcluido,
  CompromissoParalisado,
  CompromissoRedelegado,
  DonoSilencio,
} from '../types/api.js'
// @ts-ignore
import styles from './WeeklyReview.module.css'

// ─── Helpers de semana ISO ────────────────────────────────────────────────────

function semanaAtual(): string {
  const hoje = new Intl.DateTimeFormat('sv', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return dateParaSemanaISO(hoje)
}

function dateParaSemanaISO(date: string): string {
  const d = new Date(date + 'T12:00:00Z')
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const ano = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(ano, 0, 4))
  const semana = Math.ceil(
    ((d.getTime() - jan4.getTime()) / 86400000 + (jan4.getUTCDay() || 7) + 1) / 7,
  )
  return `${ano}-W${String(semana).padStart(2, '0')}`
}

function semanasNoAno(ano: number): number {
  const dec28 = new Date(Date.UTC(ano, 11, 28))
  const dow = dec28.getUTCDay() || 7
  dec28.setUTCDate(dec28.getUTCDate() + 4 - dow)
  const jan4 = new Date(Date.UTC(dec28.getUTCFullYear(), 0, 4))
  return Math.ceil(
    ((dec28.getTime() - jan4.getTime()) / 86400000 + (jan4.getUTCDay() || 7) + 1) / 7,
  )
}

function navSemana(semana: string, delta: number): string {
  const [anoStr, wStr] = semana.split('-W')
  let ano = Number(anoStr)
  let w = Number(wStr) + delta
  if (w < 1) { ano -= 1; w = semanasNoAno(ano) }
  else if (w > semanasNoAno(ano)) { ano += 1; w = 1 }
  return `${ano}-W${String(w).padStart(2, '0')}`
}

function formatarPeriodo(inicio: string, fim: string): string {
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const [, im, id] = inicio.split('-')
  const [, fm, fd] = fim.split('-')
  const ini = `${Number(id)} ${meses[Number(im) - 1]}`
  const fin = `${Number(fd)} ${meses[Number(fm) - 1]}`
  return `${ini}–${fin}`
}

function formatarHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function WeeklyReview() {
  const [semana, setSemana] = useState<string>(semanaAtual)
  const isSemanaCorrente = semana === semanaAtual()

  // Dados estruturados da semana
  const { data: dadosSemana, isLoading: loadingDados } = useQuery({
    queryKey: ['revisao', semana],
    queryFn: () => getRevisao(semana),
  })

  // Narrativa em cache — carrega automaticamente sem gerar
  const { data: cacheData, isLoading: loadingCache, refetch: refetchCache } = useQuery({
    queryKey: ['revisao-cache', semana],
    queryFn: () => getNarrativaCache(semana),
  })

  const narrativaCache = cacheData?.disponivel ? cacheData : null
  const dadosMudaram = narrativaCache !== null && !narrativaCache.estaAtualizada

  // Mutação que chama a IA (ou retorna cache se hash bater)
  const {
    data: narrativaGerada,
    isPending: gerando,
    isError: erroIA,
    mutate: gerar,
    reset: resetGerar,
  } = useMutation({
    mutationFn: () => gerarNarrativa(semana),
    onSuccess: () => void refetchCache(),
  })

  // Narrativa a exibir: gerada agora > cache do banco
  const narrativa: NarrativaIA | null = narrativaGerada ?? narrativaCache

  function irParaSemana(delta: number) {
    resetGerar()
    setSemana((s) => navSemana(s, delta))
  }

  const periodo = dadosSemana?.periodo
  const loadingNarrativa = loadingCache || gerando

  return (
    <div className={styles.container}>

      {/* ── Navegação ── */}
      <div className={styles.nav}>
        <button className={styles.navBtn} aria-label="Semana anterior" onClick={() => irParaSemana(-1)}>‹</button>
        <button className={styles.navBtn} aria-label="Próxima semana" disabled={isSemanaCorrente} onClick={() => irParaSemana(1)}>›</button>
        <span className={styles.navLabel}>{semana}</span>
        {periodo && <span className={styles.navPeriodo}>· {formatarPeriodo(periodo.inicio, periodo.fim)}</span>}
      </div>

      {/* ── Card de IA — full-width ── */}
      <div className={styles.iaCard}>
        <div className={styles.iaHeader}>
          <span className={styles.iaTitle}>
            Análise da semana
            <span className={styles.iaBadge}>IA</span>
          </span>
        </div>

        {loadingNarrativa ? (
          <SkeletonIA />
        ) : erroIA ? (
          <>
            <p className={styles.iaError}>Análise indisponível no momento.</p>
            <button className={styles.gerarBtn} onClick={() => gerar()}>Tentar novamente</button>
          </>
        ) : narrativa ? (
          <>
            {/* Indicador de status */}
            <div className={styles.iaStatus}>
              <span className={`${styles.iaStatusDot} ${narrativa.estaAtualizada ? styles.iaStatusDotOk : styles.iaStatusDotStale}`} />
              {narrativa.estaAtualizada
                ? `Dados atuais · gerada ${formatarHora(narrativa.geradoEm)}`
                : `Desatualizada · gerada ${formatarHora(narrativa.geradoEm)} · novos dados disponíveis`}
            </div>

            <p className={styles.narrativa}>{narrativa.narrativa}</p>
            <p className={styles.sugestoesLabel}>Sugestões para a próxima semana</p>
            <ol className={styles.sugestoes}>
              {narrativa.sugestoes.map((s, i) => (
                <li key={i} className={styles.sugestao}>
                  <span className={styles.sugestaoNum}>{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>

            {/* Botão de atualizar — só aparece quando dados mudaram */}
            {dadosMudaram && !narrativaGerada && (
              <button className={styles.atualizarBtn} disabled={gerando} onClick={() => gerar()}>
                Atualizar análise
              </button>
            )}
          </>
        ) : (
          /* Sem cache — primeira geração */
          <button
            className={styles.gerarBtn}
            disabled={loadingDados || !dadosSemana}
            onClick={() => gerar()}
          >
            Gerar análise com IA
          </button>
        )}
      </div>

      {/* ── Grid 2×2 de dados ── */}
      {loadingDados ? (
        <div className={styles.dadosGrid}>
          {[0,1,2,3].map((i) => (
            <div key={i} className={styles.dadosCard}><SkeletonDados /></div>
          ))}
        </div>
      ) : dadosSemana && (
        <div className={styles.dadosGrid}>
          <div className={styles.dadosCard}>
            <div className={styles.dadosHeader}>
              <span className={styles.dadosIcone}>✓</span>
              <span className={styles.dadosTitulo}>Concluídos</span>
              <span className={styles.dadosBadge}>{dadosSemana.resumo.concluidos}</span>
            </div>
            {dadosSemana.concluidos.length === 0
              ? <p className={styles.empty}>Nenhum nesta semana.</p>
              : <ul className={styles.lista}>{dadosSemana.concluidos.map((c) => <ItemConcluido key={c.id} item={c} />)}</ul>}
          </div>

          <div className={styles.dadosCard}>
            <div className={styles.dadosHeader}>
              <span className={styles.dadosIcone}>⏸</span>
              <span className={styles.dadosTitulo}>Paralisados</span>
              <span className={`${styles.dadosBadge} ${dadosSemana.resumo.paralisados > 0 ? styles.dadosBadgeAlert : ''}`}>
                {dadosSemana.resumo.paralisados}
              </span>
            </div>
            {dadosSemana.paralisados.length === 0
              ? <p className={styles.empty}>Nenhum paralisado.</p>
              : <ul className={styles.lista}>{dadosSemana.paralisados.map((c) => <ItemParalisado key={c.id} item={c} />)}</ul>}
          </div>

          <div className={styles.dadosCard}>
            <div className={styles.dadosHeader}>
              <span className={styles.dadosIcone}>↻</span>
              <span className={styles.dadosTitulo}>Redelegados</span>
              <span className={`${styles.dadosBadge} ${dadosSemana.resumo.redelegados > 0 ? styles.dadosBadgeAlert : ''}`}>
                {dadosSemana.resumo.redelegados}
              </span>
            </div>
            {dadosSemana.redelegados.length === 0
              ? <p className={styles.empty}>Nenhuma redelegação.</p>
              : <ul className={styles.lista}>{dadosSemana.redelegados.map((c) => <ItemRedelegado key={c.id} item={c} />)}</ul>}
          </div>

          <div className={styles.dadosCard}>
            <div className={styles.dadosHeader}>
              <span className={styles.dadosIcone}>🔇</span>
              <span className={styles.dadosTitulo}>Donos em silêncio</span>
              <span className={`${styles.dadosBadge} ${dadosSemana.resumo.donosEmSilencio > 0 ? styles.dadosBadgeAlert : ''}`}>
                {dadosSemana.resumo.donosEmSilencio}
              </span>
            </div>
            {dadosSemana.donosEmSilencio.length === 0
              ? <p className={styles.empty}>Todos atualizando normalmente.</p>
              : <ul className={styles.lista}>{dadosSemana.donosEmSilencio.map((d) => <ItemSilencio key={d.dono} item={d} />)}</ul>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ItemConcluido({ item }: { item: CompromissoConcluido }) {
  return (
    <li className={styles.item}>
      <span className={styles.itemTitulo}>{item.titulo}</span>
      <span className={styles.itemMeta}>{item.dono ?? 'Eu'}</span>
    </li>
  )
}

function ItemParalisado({ item }: { item: CompromissoParalisado }) {
  return (
    <li className={styles.item}>
      <span className={styles.itemTitulo}>{item.titulo}</span>
      <span className={styles.itemAlerta}>{item.diasSemAtualizacao}d parado</span>
    </li>
  )
}

function ItemRedelegado({ item }: { item: CompromissoRedelegado }) {
  return (
    <li className={styles.item}>
      <span className={styles.itemTitulo}>{item.titulo}</span>
      <span className={styles.itemMeta}>→ {item.donoAtual ?? '—'}</span>
    </li>
  )
}

function ItemSilencio({ item }: { item: DonoSilencio }) {
  return (
    <li className={styles.item}>
      <span className={styles.itemTitulo}>{item.dono}</span>
      <span className={styles.itemAlerta}>{item.diasSemAtualizacao}d sem update · {item.ativos} ativo{item.ativos !== 1 ? 's' : ''}</span>
    </li>
  )
}

function SkeletonDados() {
  return (
    <div className={styles.skeletonWrap}>
      {[70, 90, 60, 80].map((w, i) => (
        <span key={i} className={styles.skeleton} style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

function SkeletonIA() {
  return (
    <div className={styles.skeletonWrap}>
      {[100, 85, 70, 95, 60].map((w, i) => (
        <span key={i} className={styles.skeleton} style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}
