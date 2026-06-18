import { createHash } from 'node:crypto'
import { hojeEmSP } from '../compromissos/compromissos.service.js'
import {
  concluidos,
  paralisados,
  redelegados,
  donosEmSilencio,
  buscarNarrativaCache,
  salvarNarrativaCache,
  type CompromissoConcluido,
  type CompromissoParalisado,
  type CompromissoRedelegado,
  type DonoEmSilencio,
} from './revisao.repo.js'
import { gerarNarrativa } from './revisao.ia.js'

// ─── Helpers de semana ISO ────────────────────────────────────────────────────

export function semanaAtual(): string {
  const hoje = hojeEmSP()
  return dateParaSemanaISO(hoje)
}

export function dateParaSemanaISO(date: string): string {
  const d = new Date(date + 'T12:00:00Z')
  const dayOfWeek = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
  const anoISO = d.getUTCFullYear()
  const primeiraSexta = new Date(Date.UTC(anoISO, 0, 4))
  const semana = Math.ceil(
    ((d.getTime() - primeiraSexta.getTime()) / 86400000 + primeiraSexta.getUTCDay() + 1) / 7,
  )
  return `${anoISO}-W${String(semana).padStart(2, '0')}`
}

export function periodoSemana(semana: string): { inicio: string; fim: string } {
  const [anoStr, wStr] = semana.split('-W')
  const ano = Number(anoStr)
  const numSemana = Number(wStr)
  const jan4 = new Date(Date.UTC(ano, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const seg1 = new Date(jan4)
  seg1.setUTCDate(jan4.getUTCDate() - dow + 1)
  const inicio = new Date(seg1)
  inicio.setUTCDate(seg1.getUTCDate() + (numSemana - 1) * 7)
  const fim = new Date(inicio)
  fim.setUTCDate(inicio.getUTCDate() + 6)
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  }
}

// ─── Tipos de saída da API ────────────────────────────────────────────────────

export interface RevisaoSemanaData {
  semana: string
  periodo: { inicio: string; fim: string }
  dadosHash: string
  concluidos: CompromissoConcluido[]
  paralisados: CompromissoParalisado[]
  redelegados: CompromissoRedelegado[]
  donosEmSilencio: DonoEmSilencio[]
  resumo: {
    concluidos: number
    paralisados: number
    redelegados: number
    donosEmSilencio: number
  }
}

export interface NarrativaApi {
  semana: string
  narrativa: string
  sugestoes: string[]
  geradoEm: string
  modeloUsado: string
  estaAtualizada: boolean   // true = hash bate com dados atuais
}

export interface NarrativaCacheApi {
  disponivel: true
  semana: string
  narrativa: string
  sugestoes: string[]
  geradoEm: string
  modeloUsado: string
  estaAtualizada: boolean
}

export interface NarrativaIndisponivel {
  disponivel: false
  semana: string
}

// ─── Hash de dados ────────────────────────────────────────────────────────────

export function calcularHash(dados: Omit<RevisaoSemanaData, 'dadosHash' | 'semana' | 'periodo'>): string {
  const input = JSON.stringify({
    concluidos: dados.concluidos.map((c) => c.id).sort(),
    paralisados: dados.paralisados.map((c) => c.id).sort(),
    redelegados: dados.redelegados.map((c) => `${c.id}:${c.dataRedelegacao}`).sort(),
    donosEmSilencio: dados.donosEmSilencio.map((d) => d.dono).sort(),
  })
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

// ─── Cache em memória para semana corrente (TTL 1h) ──────────────────────────

interface EntradaMemoria {
  narrativa: NarrativaApi
  expiresAt: number
}
const memoriaCache = new Map<string, EntradaMemoria>()

function chaveMemoria(usuarioId: bigint, semana: string) {
  return `${usuarioId}:${semana}`
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export async function obterRevisao(
  usuarioId: bigint,
  semana?: string,
): Promise<RevisaoSemanaData> {
  const semanaAlvo = semana ?? semanaAtual()
  const hoje = hojeEmSP()
  const { inicio, fim } = periodoSemana(semanaAlvo)

  const [concluidosData, paralisadosData, redelegadosData, silencioData] = await Promise.all([
    concluidos({ usuarioId, inicioPeriodo: inicio, fimPeriodo: fim }),
    paralisados({ usuarioId, hoje, inicioPeriodo: inicio }),
    redelegados({ usuarioId, inicioPeriodo: inicio, fimPeriodo: fim }),
    donosEmSilencio({ usuarioId, hoje, limiarDias: 5 }),
  ])

  const dadosBrutos = {
    concluidos: concluidosData,
    paralisados: paralisadosData,
    redelegados: redelegadosData,
    donosEmSilencio: silencioData,
    resumo: {
      concluidos: concluidosData.length,
      paralisados: paralisadosData.length,
      redelegados: redelegadosData.length,
      donosEmSilencio: silencioData.length,
    },
  }

  return {
    semana: semanaAlvo,
    periodo: { inicio, fim },
    dadosHash: calcularHash(dadosBrutos),
    ...dadosBrutos,
  }
}

/** Retorna a narrativa em cache sem gerar nova — para exibição inicial. */
export async function obterNarrativaCache(
  usuarioId: bigint,
  semana?: string,
): Promise<NarrativaCacheApi | NarrativaIndisponivel> {
  const semanaAlvo = semana ?? semanaAtual()

  // Verifica cache em memória (semana corrente)
  const chave = chaveMemoria(usuarioId, semanaAlvo)
  const entrada = memoriaCache.get(chave)
  if (entrada && entrada.expiresAt > Date.now()) {
    // Compara hash para verificar se ainda está atualizada
    const dadosAtuais = await obterRevisao(usuarioId, semanaAlvo)
    return {
      disponivel: true,
      ...entrada.narrativa,
      estaAtualizada: dadosAtuais.dadosHash === entrada.narrativa.semana,  // reusa campo abaixo
    }
  }

  // Verifica cache no banco
  const cache = await buscarNarrativaCache({ usuarioId, semana: semanaAlvo })
  if (!cache) return { disponivel: false, semana: semanaAlvo }

  const dadosAtuais = await obterRevisao(usuarioId, semanaAlvo)
  const estaAtualizada = cache.dadosHash === dadosAtuais.dadosHash

  return {
    disponivel: true,
    semana: semanaAlvo,
    narrativa: cache.narrativa,
    sugestoes: cache.sugestoes,
    geradoEm: cache.geradoEm.toISOString(),
    modeloUsado: cache.modeloUsado,
    estaAtualizada,
  }
}

/** Gera nova narrativa se os dados mudaram; retorna cache se hash bater. */
export async function obterNarrativa(
  usuarioId: bigint,
  semana?: string,
): Promise<NarrativaApi> {
  const semanaAlvo = semana ?? semanaAtual()
  const isSemanaCorrente = semanaAlvo === semanaAtual()

  // Busca dados atuais e hash
  const dados = await obterRevisao(usuarioId, semanaAlvo)
  const hashAtual = dados.dadosHash

  // Verifica cache em memória
  const chave = chaveMemoria(usuarioId, semanaAlvo)
  const entradaMemoria = memoriaCache.get(chave)
  if (entradaMemoria && entradaMemoria.expiresAt > Date.now()) {
    const hashCache = entradaMemoria.narrativa.estaAtualizada ? hashAtual : null
    if (hashCache === hashAtual) {
      return { ...entradaMemoria.narrativa, estaAtualizada: true }
    }
  }

  // Verifica cache no banco
  const cache = await buscarNarrativaCache({ usuarioId, semana: semanaAlvo })
  if (cache && cache.dadosHash === hashAtual) {
    const resultado: NarrativaApi = {
      semana: semanaAlvo,
      narrativa: cache.narrativa,
      sugestoes: cache.sugestoes,
      geradoEm: cache.geradoEm.toISOString(),
      modeloUsado: cache.modeloUsado,
      estaAtualizada: true,
    }
    if (isSemanaCorrente) {
      memoriaCache.set(chave, { narrativa: resultado, expiresAt: Date.now() + 60 * 60 * 1000 })
    }
    return resultado
  }

  // Hash diferente (ou sem cache) — chama a IA
  const { narrativa, sugestoes, modeloUsado } = await gerarNarrativa(dados)

  const resultado: NarrativaApi = {
    semana: semanaAlvo,
    narrativa,
    sugestoes,
    geradoEm: new Date().toISOString(),
    modeloUsado,
    estaAtualizada: true,
  }

  // Persiste
  await salvarNarrativaCache({
    usuarioId,
    semana: semanaAlvo,
    narrativa,
    sugestoes,
    modeloUsado,
    dadosHash: hashAtual,
  })

  if (isSemanaCorrente) {
    memoriaCache.set(chave, { narrativa: resultado, expiresAt: Date.now() + 60 * 60 * 1000 })
  }

  return resultado
}
