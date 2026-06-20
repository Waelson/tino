import { sql } from 'kysely'
import type { Kysely, Transaction } from 'kysely'
import { db } from '../infra/db.js'
import type { Database, Referencia, RegistroEntrada, Status } from '../infra/db.js'
import type { Tipo } from '../infra/db.js'

// Tipo retornado pelas queries com colunas derivadas
export interface CompromissoRow {
  id: bigint
  usuario_id: bigint
  titulo: string
  dono: string | null
  tipo: 'fazer' | 'delegada' | 'adiada' | null
  prazo: string | null
  checkpoint: string | null
  status: string
  descartada_em: Date | null
  criada_em: Date
  atualizada_em: Date
  // Coluna de negócio persistida
  critica: number
  // Colunas derivadas (0 | 1 do MySQL)
  checkpoint_vencido: number
  prazo_estourado: number
  comigo: number
  prazo_em_risco: number
}

export async function capturar(
  trx: Transaction<Database>,
  params: { usuarioId: bigint; titulo: string },
): Promise<bigint> {
  const result = await trx
    .insertInto('compromissos')
    .values({
      usuario_id: params.usuarioId,
      titulo: params.titulo,
      status: 'nao_iniciada',
    })
    .executeTakeFirstOrThrow()

  return result.insertId as bigint
}

export type FiltroLista = 'ativas' | 'comigo' | 'delegadas' | 'atencao' | 'concluidas' | 'todas' | 'semana' | 'risco' | 'criticas'

export async function listar(params: {
  usuarioId: bigint
  hoje: string
  prox7Dias?: string
  prox3Dias: string
  limiarSilencio: string
  filtro?: FiltroLista
  q?: string
  dono?: string
}): Promise<CompromissoRow[]> {
  let base = db
    .selectFrom('compromissos as c')
    .select([
      'c.id',
      'c.usuario_id',
      'c.titulo',
      'c.dono',
      'c.tipo',
      'c.prazo',
      'c.checkpoint',
      'c.status',
      'c.critica',
      'c.descartada_em',
      'c.criada_em',
      'c.atualizada_em',
      sql<number>`(c.checkpoint IS NOT NULL AND c.checkpoint < ${params.hoje})`.as(
        'checkpoint_vencido',
      ),
      sql<number>`(c.prazo IS NOT NULL AND c.prazo < ${params.hoje})`.as('prazo_estourado'),
      sql<number>`(c.tipo = 'fazer' OR LOWER(TRIM(COALESCE(c.dono,''))) = 'eu')`.as('comigo'),
      sql<number>`(c.prazo IS NOT NULL AND c.prazo >= ${params.hoje} AND c.prazo <= ${params.prox3Dias} AND NOT EXISTS (SELECT 1 FROM registro_entradas re2 WHERE re2.compromisso_id = c.id AND re2.criada_em >= ${params.limiarSilencio}))`.as('prazo_em_risco'),
    ])
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
    .where('c.tipo', 'is not', null)

  if (params.q?.trim()) {
    const termo = `%${params.q.trim()}%`
    base = base.where(sql<boolean>`LOWER(c.titulo) LIKE LOWER(${termo})`) as typeof base
  }

  const filtro = params.filtro ?? 'ativas'

  if (params.dono?.trim()) {
    const nome = params.dono.trim()
    return base
      .where(sql<boolean>`LOWER(TRIM(c.dono)) = LOWER(TRIM(${nome}))`)
      .orderBy(sql`(c.prazo IS NULL)`)
      .orderBy('c.prazo', 'asc')
      .orderBy('c.criada_em', 'desc')
      .execute()
  }

  if (filtro === 'criticas') {
    return base
      .where('c.status', '!=', 'concluida')
      .where('c.critica', '=', 1)
      .orderBy(sql`(c.prazo IS NULL)`)
      .orderBy('c.prazo', 'asc')
      .orderBy('c.criada_em', 'desc')
      .execute()
  }

  if (filtro === 'risco') {
    return base
      .where('c.status', '!=', 'concluida')
      .where(sql<boolean>`(c.prazo IS NOT NULL AND c.prazo >= ${params.hoje} AND c.prazo <= ${params.prox3Dias} AND NOT EXISTS (SELECT 1 FROM registro_entradas re2 WHERE re2.compromisso_id = c.id AND re2.criada_em >= ${params.limiarSilencio}))`)
      .orderBy('c.prazo', 'asc')
      .execute()
  }

  if (filtro === 'semana') {
    const limite = params.prox7Dias ?? params.hoje
    return base
      .where('c.status', '!=', 'concluida')
      .where(
        sql<boolean>`((c.prazo IS NOT NULL AND c.prazo <= ${limite}) OR (c.checkpoint IS NOT NULL AND c.checkpoint <= ${limite}) OR c.status = 'em_andamento')`,
      )
      .orderBy(sql`(c.prazo IS NULL)`)
      .orderBy('c.prazo', 'asc')
      .orderBy('c.criada_em', 'desc')
      .execute()
  }

  if (filtro === 'todas') {
    return base
      .orderBy(sql`(c.prazo IS NULL)`)
      .orderBy('c.prazo', 'asc')
      .orderBy('c.criada_em', 'desc')
      .execute()
  }

  if (filtro === 'concluidas') {
    return base
      .where('c.status', '=', 'concluida')
      .orderBy(sql`(c.prazo IS NULL)`)
      .orderBy('c.prazo', 'asc')
      .orderBy('c.criada_em', 'desc')
      .execute()
  }

  let query = base.where('c.status', '!=', 'concluida')

  if (filtro === 'comigo') {
    query = query.where(
      sql<boolean>`(c.tipo = 'fazer' OR LOWER(TRIM(COALESCE(c.dono,''))) = 'eu')`,
    ) as typeof query
  } else if (filtro === 'delegadas') {
    query = query.where('c.tipo', '=', 'delegada') as typeof query
  } else if (filtro === 'atencao') {
    query = query.where(
      sql<boolean>`((c.checkpoint IS NOT NULL AND c.checkpoint < ${params.hoje}) OR (c.prazo IS NOT NULL AND c.prazo < ${params.hoje}) OR c.status = 'bloqueada')`,
    ) as typeof query
  }

  return query
    .orderBy(sql`(c.prazo IS NULL)`)
    .orderBy('c.prazo', 'asc')
    .orderBy('c.criada_em', 'desc')
    .execute()
}

// ─── Métricas do painel ───────────────────────────────────────────────────────

export interface MetricasRow {
  ativos: number
  checkpoints_vencidos: number
  prazos_estourados: number
  comigo: number
  precisa_atencao: number
  aguardando_triagem: number
  em_risco: number
  criticas: number
}

export async function metricas(params: {
  usuarioId: bigint
  hoje: string
  prox3Dias: string
  limiarSilencio: string
}): Promise<MetricasRow> {
  // Query 1 — §6.2 canônica + precisamAtencao (uma passada, sem N+1)
  const ativosRow = await db
    .selectFrom('compromissos')
    .select([
      sql<number>`COUNT(*)`.as('ativos'),
      sql<number>`COALESCE(SUM(checkpoint IS NOT NULL AND checkpoint < ${params.hoje}), 0)`.as(
        'checkpoints_vencidos',
      ),
      sql<number>`COALESCE(SUM(prazo IS NOT NULL AND prazo < ${params.hoje}), 0)`.as(
        'prazos_estourados',
      ),
      sql<number>`COALESCE(SUM(tipo = 'fazer' OR LOWER(TRIM(COALESCE(dono,''))) = 'eu'), 0)`.as(
        'comigo',
      ),
      sql<number>`COALESCE(SUM((checkpoint IS NOT NULL AND checkpoint < ${params.hoje}) OR (prazo IS NOT NULL AND prazo < ${params.hoje}) OR status = 'bloqueada'), 0)`.as(
        'precisa_atencao',
      ),
      sql<number>`COALESCE(SUM(critica = 1), 0)`.as('criticas'),
    ])
    .where('usuario_id', '=', params.usuarioId)
    .where('descartada_em', 'is', null)
    .where('tipo', 'is not', null)
    .where('status', '!=', 'concluida')
    .executeTakeFirstOrThrow()

  // Query 2 — fila de triagem
  const triagemRow = await db
    .selectFrom('compromissos')
    .select(sql<number>`COUNT(*)`.as('aguardando_triagem'))
    .where('usuario_id', '=', params.usuarioId)
    .where('descartada_em', 'is', null)
    .where('tipo', 'is', null)
    .executeTakeFirstOrThrow()

  // Query 3 — compromissos em risco (prazo ≤ hoje+3 e sem registro nos últimos 5 dias)
  const riscoRow = await db
    .selectFrom('compromissos as c')
    .select(sql<number>`COUNT(*)`.as('em_risco'))
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
    .where('c.tipo', 'is not', null)
    .where('c.status', '!=', 'concluida')
    .where(sql<boolean>`(c.prazo IS NOT NULL AND c.prazo >= ${params.hoje} AND c.prazo <= ${params.prox3Dias})`)
    .where(sql<boolean>`NOT EXISTS (SELECT 1 FROM registro_entradas re WHERE re.compromisso_id = c.id AND re.criada_em >= ${params.limiarSilencio})`)
    .executeTakeFirstOrThrow()

  return {
    ativos: Number(ativosRow.ativos),
    checkpoints_vencidos: Number(ativosRow.checkpoints_vencidos),
    prazos_estourados: Number(ativosRow.prazos_estourados),
    comigo: Number(ativosRow.comigo),
    precisa_atencao: Number(ativosRow.precisa_atencao),
    aguardando_triagem: Number(triagemRow.aguardando_triagem),
    em_risco: Number(riscoRow.em_risco),
    criticas: Number(ativosRow.criticas),
  }
}

export async function listarTriagem(params: { usuarioId: bigint }): Promise<CompromissoRow[]> {
  return await db
    .selectFrom('compromissos as c')
    .select([
      'c.id',
      'c.usuario_id',
      'c.titulo',
      'c.dono',
      'c.tipo',
      'c.prazo',
      'c.checkpoint',
      'c.status',
      'c.critica',
      'c.descartada_em',
      'c.criada_em',
      'c.atualizada_em',
      sql<number>`0`.as('checkpoint_vencido'),
      sql<number>`0`.as('prazo_estourado'),
      sql<number>`0`.as('comigo'),
      sql<number>`0`.as('prazo_em_risco'),
    ])
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
    .where('c.tipo', 'is', null)
    .orderBy('c.criada_em', 'asc')
    .execute()
}

function selectCompromissoComDeriv(
  executor: Kysely<Database> | Transaction<Database>,
  params: { id: bigint; usuarioId: bigint; hoje: string },
) {
  return executor
    .selectFrom('compromissos as c')
    .select([
      'c.id',
      'c.usuario_id',
      'c.titulo',
      'c.dono',
      'c.tipo',
      'c.prazo',
      'c.checkpoint',
      'c.status',
      'c.critica',
      'c.descartada_em',
      'c.criada_em',
      'c.atualizada_em',
      sql<number>`(c.checkpoint IS NOT NULL AND c.checkpoint < ${params.hoje})`.as(
        'checkpoint_vencido',
      ),
      sql<number>`(c.prazo IS NOT NULL AND c.prazo < ${params.hoje})`.as('prazo_estourado'),
      sql<number>`(c.tipo = 'fazer' OR LOWER(TRIM(COALESCE(c.dono,''))) = 'eu')`.as('comigo'),
      sql<number>`0`.as('prazo_em_risco'),
    ])
    .where('c.id', '=', params.id)
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
}

export async function findById(params: {
  id: bigint
  usuarioId: bigint
  hoje: string
}): Promise<CompromissoRow | undefined> {
  return selectCompromissoComDeriv(db, params).executeTakeFirst()
}

export async function findByIdTrx(
  trx: Transaction<Database>,
  params: { id: bigint; usuarioId: bigint; hoje: string },
): Promise<CompromissoRow | undefined> {
  return selectCompromissoComDeriv(trx, params).executeTakeFirst()
}

export async function listarReferencias(params: {
  compromissoId: bigint
}): Promise<Referencia[]> {
  return db
    .selectFrom('referencias')
    .selectAll()
    .where('compromisso_id', '=', params.compromissoId)
    .orderBy('criada_em', 'asc')
    .execute()
}

export async function listarRegistro(params: {
  compromissoId: bigint
}): Promise<RegistroEntrada[]> {
  return db
    .selectFrom('registro_entradas')
    .selectAll()
    .where('compromisso_id', '=', params.compromissoId)
    .orderBy('data', 'desc')
    .orderBy('id', 'desc')
    .execute()
}

export async function findByIdParaDescartar(
  trx: Transaction<Database>,
  params: { id: bigint; usuarioId: bigint },
): Promise<{ id: bigint; descartada_em: Date | null } | undefined> {
  return trx
    .selectFrom('compromissos')
    .select(['id', 'descartada_em'])
    .where('id', '=', params.id)
    .where('usuario_id', '=', params.usuarioId)
    .executeTakeFirst()
}

export async function adicionarReferencia(params: {
  compromissoId: bigint
  url: string
  descricao: string | null
}): Promise<bigint> {
  const result = await db
    .insertInto('referencias')
    .values({
      compromisso_id: params.compromissoId,
      url: params.url,
      descricao: params.descricao,
    })
    .executeTakeFirstOrThrow()
  return result.insertId as bigint
}

export async function removerReferencia(params: {
  refId: bigint
  compromissoId: bigint
}): Promise<number> {
  const result = await db
    .deleteFrom('referencias')
    .where('id', '=', params.refId)
    .where('compromisso_id', '=', params.compromissoId)
    .executeTakeFirstOrThrow()
  return Number(result.numDeletedRows)
}

export async function findReferenciaById(params: {
  refId: bigint
  compromissoId: bigint
}): Promise<import('../infra/db.js').Referencia | undefined> {
  return db
    .selectFrom('referencias')
    .selectAll()
    .where('id', '=', params.refId)
    .where('compromisso_id', '=', params.compromissoId)
    .executeTakeFirst()
}

export async function atualizarPatch(
  trx: Transaction<Database>,
  params: {
    id: bigint
    titulo?: string
    dono?: string | null
    prazo?: string | null
    checkpoint?: string | null
    status?: Status
    tipo?: Tipo
    critica?: number
  },
): Promise<void> {
  const { id, ...fields } = params
  const updates: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) updates[key] = val
  }
  await trx.updateTable('compromissos').set(updates).where('id', '=', id).execute()
}

// ─── Painel de equipe ─────────────────────────────────────────────────────────

export interface DonoMetricasRow {
  dono: string | null
  ativos: number
  checkpoints_vencidos: number
  prazos_estourados: number
  bloqueados: number
  criticos: number
  em_risco: number
  proximo_prazo: string | null
}

export async function equipe(params: {
  usuarioId: bigint
  hoje: string
  prox3Dias: string
  limiarSilencio: string
}): Promise<DonoMetricasRow[]> {
  return db
    .selectFrom('compromissos as c')
    .select([
      'c.dono',
      sql<number>`COUNT(*)`.as('ativos'),
      sql<number>`COALESCE(SUM(c.checkpoint IS NOT NULL AND c.checkpoint < ${params.hoje}), 0)`.as('checkpoints_vencidos'),
      sql<number>`COALESCE(SUM(c.prazo IS NOT NULL AND c.prazo < ${params.hoje}), 0)`.as('prazos_estourados'),
      sql<number>`COALESCE(SUM(c.status = 'bloqueada'), 0)`.as('bloqueados'),
      sql<number>`COALESCE(SUM(c.critica = 1), 0)`.as('criticos'),
      sql<number>`COALESCE(SUM(c.prazo IS NOT NULL AND c.prazo >= ${params.hoje} AND c.prazo <= ${params.prox3Dias} AND NOT EXISTS (SELECT 1 FROM registro_entradas re WHERE re.compromisso_id = c.id AND re.criada_em >= ${params.limiarSilencio})), 0)`.as('em_risco'),
      sql<string | null>`MIN(CASE WHEN c.prazo IS NOT NULL AND c.prazo >= ${params.hoje} THEN c.prazo END)`.as('proximo_prazo'),
    ])
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
    .where('c.tipo', 'is not', null)
    .where('c.status', '!=', 'concluida')
    .where('c.dono', 'is not', null)
    .where(sql<boolean>`TRIM(c.dono) != ''`)
    .groupBy('c.dono')
    .orderBy(sql`COUNT(*) DESC`)
    .orderBy('c.dono', 'asc')
    .execute() as unknown as DonoMetricasRow[]
}

// ─── Contexto de risco para IA ────────────────────────────────────────────────

export interface ItemRiscoContexto {
  id: number
  titulo: string
  dono: string | null
  prazo: string
  diasSemRegistro: number
  ultimasEntradas: { data: string; texto: string; origem: string }[]
}

export async function listarRiscoComRegistro(params: {
  usuarioId: bigint
  hoje: string
  prox3Dias: string
  limiarSilencio: string
}): Promise<ItemRiscoContexto[]> {
  const itens = await db
    .selectFrom('compromissos as c')
    .select([
      'c.id',
      'c.titulo',
      'c.dono',
      'c.prazo',
      sql<Date | null>`(SELECT MAX(re.criada_em) FROM registro_entradas re WHERE re.compromisso_id = c.id)`.as('ultima_em'),
    ])
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
    .where('c.tipo', 'is not', null)
    .where('c.status', '!=', 'concluida')
    .where(sql<boolean>`(c.prazo IS NOT NULL AND c.prazo >= ${params.hoje} AND c.prazo <= ${params.prox3Dias})`)
    .where(sql<boolean>`NOT EXISTS (SELECT 1 FROM registro_entradas re2 WHERE re2.compromisso_id = c.id AND re2.criada_em >= ${params.limiarSilencio})`)
    .orderBy('c.prazo', 'asc')
    .execute()

  if (itens.length === 0) return []

  const ids = itens.map((i) => i.id)

  const todasEntradas = await db
    .selectFrom('registro_entradas')
    .select(['compromisso_id', 'data', 'texto', 'origem', 'criada_em'])
    .where('compromisso_id', 'in', ids)
    .orderBy('criada_em', 'desc')
    .orderBy('id', 'desc')
    .execute()

  const entradasPorItem = new Map<bigint, { data: string; texto: string; origem: string }[]>()
  for (const e of todasEntradas) {
    const arr = entradasPorItem.get(e.compromisso_id) ?? []
    if (arr.length < 3) {
      arr.push({
        data: String(e.data).substring(0, 10),
        texto: e.texto,
        origem: e.origem,
      })
      entradasPorItem.set(e.compromisso_id, arr)
    }
  }

  const hojeMs = new Date(params.hoje + 'T12:00:00Z').getTime()
  return itens.map((item) => {
    const ultimaEm = item.ultima_em
    let diasSemRegistro = 999
    if (ultimaEm) {
      diasSemRegistro = Math.max(0, Math.floor((hojeMs - new Date(ultimaEm).getTime()) / 86400000))
    }
    return {
      id: Number(item.id),
      titulo: item.titulo,
      dono: item.dono,
      prazo: String(item.prazo).substring(0, 10),
      diasSemRegistro,
      ultimasEntradas: entradasPorItem.get(item.id) ?? [],
    }
  })
}

export async function atualizarTriagem(
  trx: Transaction<Database>,
  params: {
    id: bigint
    tipo?: Tipo | null
    dono?: string | null
    prazo?: string | null
    checkpoint?: string | null
    descartada_em?: Date | null
  },
): Promise<void> {
  const { id, ...updates } = params
  await trx
    .updateTable('compromissos')
    .set(updates)
    .where('id', '=', id)
    .execute()
}
