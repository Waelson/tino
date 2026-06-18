import { sql } from 'kysely'
import { db } from '../infra/db.js'

// ─── Tipos de saída das queries ───────────────────────────────────────────────

export interface CompromissoConcluido {
  id: bigint
  titulo: string
  dono: string | null
  tipo: string | null
  concluidoEm: string
}

export interface CompromissoParalisado {
  id: bigint
  titulo: string
  dono: string | null
  tipo: string | null
  status: string
  prazo: string | null
  diasSemAtualizacao: number
}

export interface CompromissoRedelegado {
  id: bigint
  titulo: string
  donoAtual: string | null
  dataRedelegacao: string
}

export interface DonoEmSilencio {
  dono: string
  ativos: number
  diasSemAtualizacao: number
}

export interface NarrativaCache {
  narrativa: string
  sugestoes: string[]
  modeloUsado: string
  dadosHash: string | null
  geradoEm: Date
}

// ─── Queries de dados estruturados ───────────────────────────────────────────

export async function concluidos(params: {
  usuarioId: bigint
  inicioPeriodo: string
  fimPeriodo: string
}): Promise<CompromissoConcluido[]> {
  const rows = await db
    .selectFrom('compromissos as c')
    .innerJoin('registro_entradas as re', 're.compromisso_id', 'c.id')
    .select([
      'c.id',
      'c.titulo',
      'c.dono',
      'c.tipo',
      sql<string>`DATE(re.criada_em)`.as('concluidoEm'),
    ])
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
    .where('c.tipo', 'is not', null)
    .where('re.origem', '=', 'sistema')
    .where(sql<boolean>`re.texto LIKE 'Compromisso concluído.%'`)
    .where(sql<boolean>`DATE(re.criada_em) BETWEEN ${params.inicioPeriodo} AND ${params.fimPeriodo}`)
    .orderBy('re.criada_em', 'desc')
    .execute()

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    dono: r.dono,
    tipo: r.tipo,
    concluidoEm: String(r.concluidoEm).substring(0, 10),
  }))
}

export async function paralisados(params: {
  usuarioId: bigint
  hoje: string
  inicioPeriodo: string
}): Promise<CompromissoParalisado[]> {
  const rows = await db
    .selectFrom('compromissos as c')
    .leftJoin('registro_entradas as re', 're.compromisso_id', 'c.id')
    .select([
      'c.id',
      'c.titulo',
      'c.dono',
      'c.tipo',
      'c.status',
      'c.prazo',
      sql<number>`COALESCE(DATEDIFF(${params.hoje}, MAX(re.criada_em)), 999)`.as('diasSemAtualizacao'),
    ])
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
    .where('c.tipo', 'is not', null)
    .where('c.status', '=', 'nao_iniciada')
    .where(sql<boolean>`c.prazo IS NOT NULL AND c.prazo <= ${params.inicioPeriodo}`)
    .groupBy(['c.id', 'c.titulo', 'c.dono', 'c.tipo', 'c.status', 'c.prazo'])
    .having(sql<boolean>`COALESCE(DATEDIFF(${params.hoje}, MAX(re.criada_em)), 999) >= 7`)
    .orderBy('diasSemAtualizacao', 'desc')
    .execute()

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    dono: r.dono,
    tipo: r.tipo,
    status: r.status,
    prazo: r.prazo ? String(r.prazo).substring(0, 10) : null,
    diasSemAtualizacao: Number(r.diasSemAtualizacao),
  }))
}

export async function redelegados(params: {
  usuarioId: bigint
  inicioPeriodo: string
  fimPeriodo: string
}): Promise<CompromissoRedelegado[]> {
  const rows = await db
    .selectFrom('compromissos as c')
    .innerJoin('registro_entradas as re', 're.compromisso_id', 'c.id')
    .select([
      'c.id',
      'c.titulo',
      'c.dono',
      sql<string>`DATE(re.criada_em)`.as('dataRedelegacao'),
    ])
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
    .where('re.origem', '=', 'sistema')
    .where(sql<boolean>`re.texto LIKE 'Dono alterado de%'`)
    .where(sql<boolean>`DATE(re.criada_em) BETWEEN ${params.inicioPeriodo} AND ${params.fimPeriodo}`)
    .orderBy('re.criada_em', 'desc')
    .execute()

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    donoAtual: r.dono,
    dataRedelegacao: String(r.dataRedelegacao).substring(0, 10),
  }))
}

export async function donosEmSilencio(params: {
  usuarioId: bigint
  hoje: string
  limiarDias: number
}): Promise<DonoEmSilencio[]> {
  const rows = await db
    .selectFrom('compromissos as c')
    .leftJoin('registro_entradas as re', 're.compromisso_id', 'c.id')
    .select([
      'c.dono',
      sql<number>`COUNT(DISTINCT c.id)`.as('ativos'),
      sql<number>`COALESCE(DATEDIFF(${params.hoje}, MAX(re.criada_em)), 999)`.as('diasSemAtualizacao'),
    ])
    .where('c.usuario_id', '=', params.usuarioId)
    .where('c.descartada_em', 'is', null)
    .where('c.tipo', '=', 'delegada')
    .where('c.status', '!=', 'concluida')
    .where('c.dono', 'is not', null)
    .where(sql<boolean>`TRIM(c.dono) != ''`)
    .groupBy('c.dono')
    .having(sql<boolean>`COALESCE(DATEDIFF(${params.hoje}, MAX(re.criada_em)), 999) >= ${params.limiarDias}`)
    .orderBy('diasSemAtualizacao', 'desc')
    .execute() as unknown as Array<{ dono: string | null; ativos: number; diasSemAtualizacao: number }>

  return rows.map((r) => ({
    dono: r.dono!,
    ativos: Number(r.ativos),
    diasSemAtualizacao: Number(r.diasSemAtualizacao),
  }))
}

// ─── Cache de narrativas ──────────────────────────────────────────────────────

export async function buscarNarrativaCache(params: {
  usuarioId: bigint
  semana: string
}): Promise<NarrativaCache | undefined> {
  const row = await db
    .selectFrom('revisao_narrativas')
    .select(['narrativa', 'sugestoes', 'modelo_usado', 'dados_hash', 'gerado_em'])
    .where('usuario_id', '=', params.usuarioId)
    .where('semana', '=', params.semana)
    .executeTakeFirst()

  if (!row) return undefined

  return {
    narrativa: row.narrativa,
    sugestoes: JSON.parse(row.sugestoes) as string[],
    modeloUsado: row.modelo_usado,
    dadosHash: row.dados_hash,
    geradoEm: row.gerado_em,
  }
}

export async function salvarNarrativaCache(params: {
  usuarioId: bigint
  semana: string
  narrativa: string
  sugestoes: string[]
  modeloUsado: string
  dadosHash: string
}): Promise<void> {
  await db
    .insertInto('revisao_narrativas')
    .values({
      usuario_id: params.usuarioId,
      semana: params.semana,
      narrativa: params.narrativa,
      sugestoes: JSON.stringify(params.sugestoes),
      modelo_usado: params.modeloUsado,
      dados_hash: params.dadosHash,
    })
    .onDuplicateKeyUpdate({
      narrativa: params.narrativa,
      sugestoes: JSON.stringify(params.sugestoes),
      modelo_usado: params.modeloUsado,
      dados_hash: params.dadosHash,
    })
    .execute()
}
