/**
 * Teste de integração — I-09: descartar via triagem.
 * Compromisso descartado não aparece em ativas nem na fila de triagem.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance
let token: string
let descartadoId: number
const EMAIL = 'i09@comp-test.dev'
const SENHA = 'senha1234'

beforeAll(async () => {
  server = await buildServer()
  await server.ready()
  const existente = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (existente) await db.deleteFrom('compromissos').where('usuario_id', '=', existente.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  const res = await server.inject({
    method: 'POST',
    url: '/auth/registro',
    payload: { nome: 'I09 Teste', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token

  // Capturar e descartar um compromisso
  const capRes = await server.inject({
    method: 'POST',
    url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso a descartar' },
  })
  descartadoId = capRes.json<{ id: number }>().id

  await server.inject({
    method: 'POST',
    url: `/compromissos/${descartadoId}/triagem`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { decisao: 'descartar' },
  })
})

afterAll(async () => {
  const user = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (user) await db.deleteFrom('compromissos').where('usuario_id', '=', user.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('I-09 — descartar via triagem', () => {
  it('retorna 200 após descartar', async () => {
    const id = (await server.inject({
      method: 'POST',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
      payload: { titulo: 'Para descartar 2' },
    })).json<{ id: number }>().id

    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'descartar' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('item descartado NÃO aparece em GET /compromissos (ativas)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = res.json<{ itens: Array<{ id: number }> }>()
    expect(body.itens.map((i) => i.id)).not.toContain(descartadoId)
  })

  it('item descartado NÃO aparece em GET /compromissos/triagem', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos/triagem',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = res.json<{ itens: Array<{ id: number }> }>()
    expect(body.itens.map((i) => i.id)).not.toContain(descartadoId)
  })

  it('descartada_em está preenchido no banco e entrada de registro foi gravada', async () => {
    const comp = await db
      .selectFrom('compromissos')
      .select('descartada_em')
      .where('id', '=', BigInt(descartadoId))
      .executeTakeFirst()
    expect(comp?.descartada_em).not.toBeNull()

    const entradas = await db
      .selectFrom('registro_entradas')
      .selectAll()
      .where('compromisso_id', '=', BigInt(descartadoId))
      .execute()
    expect(entradas.some((e) => e.texto === 'Compromisso descartado.')).toBe(true)
  })
})
