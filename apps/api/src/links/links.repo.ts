import { db } from '../infra/db.js'
import { sql } from 'kysely'

export interface LinkRow {
  id:            bigint
  usuario_id:    bigint
  nome:          string
  url:           string
  descricao:     string | null
  categoria:     string | null
  cliques:       number
  criada_em:     Date
  atualizada_em: Date
}

export async function listarLinks(usuarioId: bigint): Promise<LinkRow[]> {
  return db
    .selectFrom('links_favoritos')
    .selectAll()
    .where('usuario_id', '=', usuarioId)
    .orderBy('cliques', 'desc')
    .orderBy('criada_em', 'asc')
    .execute() as Promise<LinkRow[]>
}

export async function criarLink(params: {
  usuarioId: bigint
  nome:      string
  url:       string
  descricao: string | null
  categoria: string | null
}): Promise<LinkRow> {
  const result = await db
    .insertInto('links_favoritos')
    .values({
      usuario_id: params.usuarioId,
      nome:       params.nome,
      url:        params.url,
      descricao:  params.descricao,
      categoria:  params.categoria,
    })
    .executeTakeFirstOrThrow()

  const id = result.insertId!
  const row = await db
    .selectFrom('links_favoritos')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

  return row as LinkRow
}

export async function atualizarLink(params: {
  id:        bigint
  usuarioId: bigint
  nome?:     string
  url?:      string
  descricao?: string | null
  categoria?: string | null
}): Promise<LinkRow | null> {
  const { id, usuarioId, ...campos } = params
  if (Object.keys(campos).length === 0) {
    return buscarLink(id, usuarioId)
  }

  await db
    .updateTable('links_favoritos')
    .set(campos)
    .where('id', '=', id)
    .where('usuario_id', '=', usuarioId)
    .execute()

  return buscarLink(id, usuarioId)
}

export async function excluirLink(id: bigint, usuarioId: bigint): Promise<boolean> {
  const result = await db
    .deleteFrom('links_favoritos')
    .where('id', '=', id)
    .where('usuario_id', '=', usuarioId)
    .executeTakeFirst()

  return (result.numDeletedRows ?? BigInt(0)) > BigInt(0)
}

export async function registrarClique(id: bigint, usuarioId: bigint): Promise<boolean> {
  const result = await db
    .updateTable('links_favoritos')
    .set({ cliques: sql<number>`cliques + 1` })
    .where('id', '=', id)
    .where('usuario_id', '=', usuarioId)
    .executeTakeFirst()

  return (result.numUpdatedRows ?? BigInt(0)) > BigInt(0)
}

async function buscarLink(id: bigint, usuarioId: bigint): Promise<LinkRow | null> {
  const row = await db
    .selectFrom('links_favoritos')
    .selectAll()
    .where('id', '=', id)
    .where('usuario_id', '=', usuarioId)
    .executeTakeFirst()

  return (row as LinkRow | undefined) ?? null
}
