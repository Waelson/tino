import { createHash } from 'node:crypto'
import { listarRiscoComRegistro } from '../compromissos/compromissos.service.js'
import type { ItemRiscoContexto } from '../compromissos/compromissos.repo.js'
import { gerarBriefingRisco } from './risco.ia.js'

// ─── Tipos de saída ───────────────────────────────────────────────────────────

export interface RiscoBriefingApi {
  briefing: string
  acaoPrioritaria: string
  geradoEm: string
  modeloUsado: string
  estaAtualizado: boolean
}

export type RiscoBriefingCacheApi =
  | { disponivel: false }
  | ({ disponivel: true } & RiscoBriefingApi)

// ─── Cache em memória (TTL 30 min — risco muda mais rápido que a revisão) ────

interface EntradaCache {
  briefing: RiscoBriefingApi
  hash: string
  expiresAt: number
}

const memoriaCache = new Map<string, EntradaCache>()

const TTL_MS = 30 * 60 * 1000

function chaveCache(usuarioId: bigint): string {
  return String(usuarioId)
}

function calcularHash(itens: ItemRiscoContexto[]): string {
  const input = JSON.stringify(
    itens.map((i) => ({ id: i.id, diasSemRegistro: i.diasSemRegistro })),
  )
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

/** Retorna o briefing em cache sem chamar a IA — para exibição inicial. */
export async function obterBriefingCache(usuarioId: bigint): Promise<RiscoBriefingCacheApi> {
  const chave = chaveCache(usuarioId)
  const entrada = memoriaCache.get(chave)
  if (!entrada || entrada.expiresAt <= Date.now()) {
    return { disponivel: false }
  }

  // Verifica se os dados mudaram desde a última geração
  const itens = await listarRiscoComRegistro(usuarioId)
  const hashAtual = calcularHash(itens)
  return {
    disponivel: true,
    ...entrada.briefing,
    estaAtualizado: hashAtual === entrada.hash,
  }
}

/** Gera novo briefing se os dados mudaram; retorna cache se hash bater. */
export async function obterBriefing(usuarioId: bigint): Promise<RiscoBriefingApi> {
  const itens = await listarRiscoComRegistro(usuarioId)
  const hashAtual = calcularHash(itens)

  const chave = chaveCache(usuarioId)
  const entrada = memoriaCache.get(chave)
  if (entrada && entrada.expiresAt > Date.now() && entrada.hash === hashAtual) {
    return { ...entrada.briefing, estaAtualizado: true }
  }

  // Hash diferente (ou sem cache) — chama a IA
  const { briefing, acaoPrioritaria, modeloUsado } = await gerarBriefingRisco(itens)

  const resultado: RiscoBriefingApi = {
    briefing,
    acaoPrioritaria,
    geradoEm: new Date().toISOString(),
    modeloUsado,
    estaAtualizado: true,
  }

  memoriaCache.set(chave, { briefing: resultado, hash: hashAtual, expiresAt: Date.now() + TTL_MS })

  return resultado
}
