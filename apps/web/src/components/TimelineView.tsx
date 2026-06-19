import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listar } from '../api/compromissos.js'
import type { Compromisso } from '../types/api.js'
import { saveOrigin } from './CommitmentList.js'
// @ts-ignore
import styles from './TimelineView.module.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hojeStr(): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function addDias(base: string, dias: number): string {
  const d = new Date(base + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// Início da semana (segunda-feira) para uma data YYYY-MM-DD
function inicioSemana(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  const dow = d.getUTCDay() // 0=dom, 1=seg…
  const diff = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function labelSemana(seg: string): string {
  const inicio = new Date(seg + 'T12:00:00Z')
  const fim = new Date(seg + 'T12:00:00Z')
  fim.setUTCDate(fim.getUTCDate() + 6)

  const fmtDia = (d: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'UTC',
      day: 'numeric',
    }).format(d)

  const fmtMes = (d: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'UTC',
      month: 'short',
    })
      .format(d)
      .replace('.', '')

  const mesInicio = fmtMes(inicio)
  const mesFim = fmtMes(fim)

  if (mesInicio === mesFim) {
    return `${fmtDia(inicio)}–${fmtDia(fim)} ${mesInicio}`
  }
  return `${fmtDia(inicio)} ${mesInicio}–${fmtDia(fim)} ${mesFim}`
}

interface Grupo {
  chave: string   // YYYY-MM-DD (segunda-feira)
  label: string
  itens: Compromisso[]
}

function agruparPorSemana(itens: Compromisso[]): Grupo[] {
  const map = new Map<string, Compromisso[]>()
  for (const item of itens) {
    const seg = inicioSemana(item.prazo!)
    const arr = map.get(seg) ?? []
    arr.push(item)
    map.set(seg, arr)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, its]) => ({
      chave,
      label: labelSemana(chave),
      itens: its.sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '')),
    }))
}

// ─── Constantes de status ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  nao_iniciada: 'Não iniciada',
  em_andamento: 'Em andamento',
  bloqueada: 'Bloqueada',
  aguardando: 'Aguardando',
  concluida: 'Concluída',
}

const STATUS_CLASS: Record<string, string> = {
  nao_iniciada: styles.bNao!,
  em_andamento: styles.bAnd!,
  bloqueada:    styles.bBlo!,
  aguardando:   styles.bAgu!,
  concluida:    styles.bCon!,
}

// ─── TimelineView ─────────────────────────────────────────────────────────────

export function TimelineView() {
  const [janela, setJanela] = useState(90)
  const hoje = hojeStr()
  const limite = addDias(hoje, janela)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['compromissos', 'ativas', null, null],
    queryFn: () => listar('ativas', null, null),
  })

  const itens = data?.itens ?? []
  const comPrazo = itens
    .filter(i => i.prazo && i.prazo >= hoje && i.prazo <= limite)
  const estourados = itens.filter(i => i.prazo && i.prazo < hoje)
  const semPrazo = itens.filter(i => !i.prazo)

  const grupos = agruparPorSemana(comPrazo)

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>Próximos</span>
        {([30, 60, 90] as const).map((d) => (
          <button
            key={d}
            className={`${styles.janelaBt} ${janela === d ? styles.janelaOn : ''}`}
            onClick={() => setJanela(d)}
          >
            {d} dias
          </button>
        ))}
      </div>

      {isLoading && <p className={styles.info}>Carregando…</p>}

      {isError && (
        <div className={styles.info}>
          <p>Erro ao carregar compromissos.</p>
          <button className={styles.retryBtn} onClick={() => void refetch()}>Tentar de novo</button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Atrasados (prazo < hoje) */}
          {estourados.length > 0 && (
            <div className={styles.grupo}>
              <h3 className={`${styles.semana} ${styles.semanaRed}`}>Atrasados</h3>
              {estourados
                .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''))
                .map(item => <TimelineRow key={item.id} item={item} />)}
            </div>
          )}

          {/* Grupos semanais */}
          {grupos.length === 0 && estourados.length === 0 && semPrazo.length === 0 && (
            <p className={styles.info}>Nenhum compromisso com prazo nos próximos {janela} dias.</p>
          )}
          {grupos.map(g => (
            <div key={g.chave} className={styles.grupo}>
              <h3 className={styles.semana}>{g.label}</h3>
              {g.itens.map(item => <TimelineRow key={item.id} item={item} />)}
            </div>
          ))}

          {/* Sem prazo */}
          {semPrazo.length > 0 && (
            <div className={styles.grupo}>
              <h3 className={`${styles.semana} ${styles.semanaMuted}`}>Sem prazo</h3>
              {semPrazo.map(item => <TimelineRow key={item.id} item={item} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── TimelineRow ──────────────────────────────────────────────────────────────

function TimelineRow({ item }: { item: Compromisso }) {
  const navigate = useNavigate()
  const statusLabel = STATUS_LABELS[item.status] ?? item.status
  const statusClass = STATUS_CLASS[item.status] ?? styles.bNao

  const rowBorder =
    item.status === 'em_andamento' ? styles.rowGreen :
    item.status === 'bloqueada'    ? styles.rowAmber :
    ''

  function abrir() {
    saveOrigin()
    void navigate(`/compromissos/${item.id}`)
  }

  return (
    <div
      className={`${styles.row} ${rowBorder}`}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ficha: ${item.titulo}`}
      onClick={abrir}
      onKeyDown={(e) => { if (e.key === 'Enter') abrir() }}
    >
      <div className={styles.rowMain}>
        {item.critica && <span className={styles.estrela}>★</span>}
        <span className={item.prazoEstourado ? `${styles.titulo} ${styles.tituloRed}` : styles.titulo}>
          {item.titulo}
        </span>
        {item.prazoEstourado && (
          <span className={styles.flagRed}>! prazo estourado</span>
        )}
        {!item.prazoEstourado && item.checkpointVencido && (
          <span className={styles.flagRed}>checkpoint vencido</span>
        )}
        {!item.prazoEstourado && !item.checkpointVencido && item.prazoEmRisco && (
          <span className={styles.flagAmber}>prazo em risco</span>
        )}
      </div>
      <div className={styles.rowMeta}>
        {item.dono && <span className={styles.dono}>{item.dono}</span>}
        <span className={styles.prazoData}>{fmtDate(item.prazo)}</span>
        <span className={`${styles.badge} ${statusClass}`}>{statusLabel}</span>
      </div>
    </div>
  )
}
