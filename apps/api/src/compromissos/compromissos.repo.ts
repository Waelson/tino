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
  // Colunas derivadas (0 | 1 do MySQL)
  checkpoint_vencido: number
  prazo_estourado: number
  comigo: number
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

export type FiltroLista = 'ativas' | 'comigo' | 'delegadas' | 'atencao' | 'concluidas' | 'todas' | 'semana'

export async function listar(params: {
  usuarioId: bigint
  hoje: string
  prox7Dias?: string
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
      'c.descartada_em',
      'c.criada_em',
      'c.atualizada_em',
      sql<number>`(c.checkpoint IS NOT NULL AND c.checkpoint < ${params.hoje})`.as(
        'checkpoint_vencido',
      ),
      sql<number>`(c.prazo IS NOT NULL AND c.prazo < ${params.hoje})`.as('prazo_estourado'),
      sql<number>`(c.tipo = 'fazer' OR LOWER(TRIM(COALESCE(c.dono,''))) = 'eu')`.as('comigo'),
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
}

export async function metricas(params: {
  usuarioId: bigint
  hoje: string
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

  return {
    ativos: Number(ativosRow.ativos),
    checkpoints_vencidos: Number(ativosRow.checkpoints_vencidos),
    prazos_estourados: Number(ativosRow.prazos_estourados),
    comigo: Number(ativosRow.comigo),
    precisa_atencao: Number(ativosRow.precisa_atencao),
    aguardando_triagem: Number(triagemRow.aguardando_triagem),
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
      'c.descartada_em',
      'c.criada_em',
      'c.atualizada_em',
      sql<number>`0`.as('checkpoint_vencido'),
      sql<number>`0`.as('prazo_estourado'),
      sql<number>`0`.as('comigo'),
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
      'c.descartada_em',
      'c.criada_em',
      'c.atualizada_em',
      sql<number>`(c.checkpoint IS NOT NULL AND c.checkpoint < ${params.hoje})`.as(
        'checkpoint_vencido',
      ),
      sql<number>`(c.prazo IS NOT NULL AND c.prazo < ${params.hoje})`.as('prazo_estourado'),
      sql<number>`(c.tipo = 'fazer' OR LOWER(TRIM(COALESCE(c.dono,''))) = 'eu')`.as('comigo'),
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
}

export async function equipe(params: {
  usuarioId: bigint
  hoje: string
}): Promise<DonoMetricasRow[]> {
  return db
    .selectFrom('compromissos')
    .select([
      'dono',
      sql<number>`COUNT(*)`.as('ativos'),
      sql<number>`COALESCE(SUM(checkpoint IS NOT NULL AND checkpoint < ${params.hoje}), 0)`.as('checkpoints_vencidos'),
      sql<number>`COALESCE(SUM(prazo IS NOT NULL AND prazo < ${params.hoje}), 0)`.as('prazos_estourados'),
      sql<number>`COALESCE(SUM(status = 'bloqueada'), 0)`.as('bloqueados'),
    ])
    .where('usuario_id', '=', params.usuarioId)
    .where('descartada_em', 'is', null)
    .where('tipo', 'is not', null)
    .where('status', '!=', 'concluida')
    .where('dono', 'is not', null)
    .where(sql<boolean>`TRIM(dono) != ''`)
    .groupBy('dono')
    .orderBy(sql`COUNT(*) DESC`)
    .orderBy('dono', 'asc')
    .execute() as unknown as DonoMetricasRow[]
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
