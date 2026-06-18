import { db } from '../infra/db.js'
import type { Referencia, RegistroEntrada } from '../infra/db.js'
import { criarEntrada } from '../registro/registro.repo.js'
import {
  capturar as capturarRepo,
  listar as listarRepo,
  listarTriagem as listarTriagemRepo,
  metricas as metricasRepo,
  equipe as equipeRepo,
  listarReferencias,
  listarRegistro,
  findById,
  type CompromissoRow,
  type FiltroLista,
} from './compromissos.repo.js'

// ─── Tipos de saída da API (camelCase, serialize-safe) ───────────────────────

export interface ReferenciaApi {
  id: number
  descricao: string | null
  url: string
  criadaEm: string
}

export interface RegistroEntradaApi {
  id: number
  data: string
  origem: 'usuario' | 'sistema'
  texto: string
  criadaEm: string
}

export interface CompromissoDetalheApi extends CompromissoApi {
  referencias: ReferenciaApi[]
  registro: RegistroEntradaApi[]
}

export interface MetricasApi {
  ativos: number
  checkpointsVencidos: number
  prazosEstourados: number
  comigo: number
  carga: number
  alertaCarga: boolean
  aguardandoTriagem: number
  precisamAtencao: number
}

export interface CompromissoApi {
  id: number
  titulo: string
  dono: string | null
  tipo: 'fazer' | 'delegada' | 'adiada' | null
  prazo: string | null
  checkpoint: string | null
  status: string
  checkpointVencido: boolean
  prazoEstourado: boolean
  precisaAtencao: boolean
  comigo: boolean
  criadaEm: string
  atualizadaEm: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(val: string | Date | null | undefined): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().substring(0, 10)
  return String(val).substring(0, 10)
}

export function hojeEmSP(): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function addDias(base: string, dias: number): string {
  const d = new Date(base + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function calcularCargaEAlerta(
  ativos: number,
  comigo: number,
): { carga: number; alertaCarga: boolean } {
  const carga = ativos > 0 ? Math.round((100 * comigo) / ativos) : 0
  return { carga, alertaCarga: carga > 30 }
}

export async function obterMetricas(usuarioId: bigint): Promise<MetricasApi> {
  const hoje = hojeEmSP()
  const row = await metricasRepo({ usuarioId, hoje })
  const { carga, alertaCarga } = calcularCargaEAlerta(row.ativos, row.comigo)
  return {
    ativos: row.ativos,
    checkpointsVencidos: row.checkpoints_vencidos,
    prazosEstourados: row.prazos_estourados,
    comigo: row.comigo,
    carga,
    alertaCarga,
    aguardandoTriagem: row.aguardando_triagem,
    precisamAtencao: row.precisa_atencao,
  }
}

export function mapToApi(row: CompromissoRow): CompromissoApi {
  // Flags de vencimento só se aplicam a itens ativos (§6.1 nota, I-06)
  // Itens em triagem (tipo=null) ou concluídos têm flags zeradas
  const isFlaggable = row.tipo !== null && row.status !== 'concluida'
  const checkpointVencido = isFlaggable ? Boolean(row.checkpoint_vencido) : false
  const prazoEstourado = isFlaggable ? Boolean(row.prazo_estourado) : false
  const comigo = isFlaggable ? Boolean(row.comigo) : false
  const precisaAtencao = checkpointVencido || prazoEstourado || row.status === 'bloqueada'

  return {
    id: Number(row.id),
    titulo: row.titulo,
    dono: row.dono,
    tipo: row.tipo,
    prazo: formatDate(row.prazo),
    checkpoint: formatDate(row.checkpoint),
    status: row.status,
    checkpointVencido,
    prazoEstourado,
    precisaAtencao,
    comigo,
    criadaEm: row.criada_em.toISOString(),
    atualizadaEm: row.atualizada_em.toISOString(),
  }
}

// ─── Operações ───────────────────────────────────────────────────────────────

export async function capturar(usuarioId: bigint, titulo: string): Promise<CompromissoApi> {
  const tituloTrimmed = titulo.trim()

  if (!tituloTrimmed) {
    const err = Object.assign(new Error('Título não pode ser vazio.'), {
      statusCode: 422,
      erro: 'I-01',
    })
    throw err
  }

  const hoje = hojeEmSP()

  const id = await db.transaction().execute(async (trx) => {
    const compromissoId = await capturarRepo(trx, {
      usuarioId,
      titulo: tituloTrimmed,
    })
    await criarEntrada(trx, {
      compromissoId,
      data: hoje,
      texto: 'Capturada.',
      origem: 'sistema',
    })
    return compromissoId
  })

  const row = await findById({ id, usuarioId, hoje })
  if (!row) throw new Error('Compromisso não encontrado após inserção.')

  return mapToApi(row)
}

export { FiltroLista }

export async function listar(
  usuarioId: bigint,
  filtro: FiltroLista = 'ativas',
  q?: string,
  dono?: string,
): Promise<CompromissoApi[]> {
  const hoje = hojeEmSP()
  const prox7Dias = addDias(hoje, 7)
  const rows = await listarRepo({
    usuarioId,
    hoje,
    filtro,
    ...(q !== undefined && { q }),
    ...(dono !== undefined && { dono }),
    ...(filtro === 'semana' && { prox7Dias }),
  })
  return rows.map(mapToApi)
}

export async function listarTriagem(usuarioId: bigint): Promise<CompromissoApi[]> {
  const rows = await listarTriagemRepo({ usuarioId })
  return rows.map(mapToApi)
}

export function mapReferencia(r: Referencia): ReferenciaApi {
  return {
    id: Number(r.id),
    descricao: r.descricao,
    url: r.url,
    criadaEm: r.criada_em.toISOString(),
  }
}

export function mapRegistro(r: RegistroEntrada): RegistroEntradaApi {
  return {
    id: Number(r.id),
    data: formatDate(r.data as string | Date) ?? '',
    origem: r.origem,
    texto: r.texto,
    criadaEm: r.criada_em.toISOString(),
  }
}

export interface DonoMetricasApi {
  dono: string
  ativos: number
  checkpointsVencidos: number
  prazosEstourados: number
  bloqueados: number
}

export async function obterEquipe(usuarioId: bigint): Promise<DonoMetricasApi[]> {
  const hoje = hojeEmSP()
  const rows = await equipeRepo({ usuarioId, hoje })
  return rows.map((r) => ({
    dono: r.dono!,
    ativos: Number(r.ativos),
    checkpointsVencidos: Number(r.checkpoints_vencidos),
    prazosEstourados: Number(r.prazos_estourados),
    bloqueados: Number(r.bloqueados),
  }))
}

export async function buscarDetalhe(
  usuarioId: bigint,
  id: bigint,
): Promise<CompromissoDetalheApi> {
  const hoje = hojeEmSP()
  const row = await findById({ id, usuarioId, hoje })

  if (!row) {
    const err = Object.assign(new Error('Compromisso não encontrado.'), {
      statusCode: 404,
      erro: 'NAO_ENCONTRADO',
    })
    throw err
  }

  const [refs, reg] = await Promise.all([
    listarReferencias({ compromissoId: id }),
    listarRegistro({ compromissoId: id }),
  ])

  return {
    ...mapToApi(row),
    referencias: refs.map(mapReferencia),
    registro: reg.map(mapRegistro),
  }
}
