/**
 * Teste de integração — A-17: POST /compromissos/:id/descartar (I-09, idempotente)
 * Cobre: descartar item, idempotência sem entrada duplicada, GET retorna 404 após descarte.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'a17-descartar@comp-test.dev'
const SENHA = 'senha1234'

let server: FastifyInstance
let token: string
let compId: number

beforeAll(async () => {
  server = await buildServer()
  await server.ready()

  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()

  const res = await server.inject({
    method: 'POST', url: '/auth/registro',
    payload: { nome: 'A17 Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token

  const capRes = await server.inject({
    method: 'POST', url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso para A-17' },
  })
  compId = capRes.json<{ id: number }>().id
})

afterAll(async () => {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('A-17 — descartar (I-09)', () => {
  it('200 — descartar item → { id, descartada: true } + entrada automática', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/descartar`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ id: number; descartada: boolean }>()
    expect(body.id).toBe(compId)
    expect(body.descartada).toBe(true)
  })

  it('200 — descartar duas vezes → apenas UMA entrada "Compromisso descartado." (idempotente)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/descartar`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)

    const entradas = await db
      .selectFrom('registro_entradas')
      .selectAll()
      .where('compromisso_id', '=', BigInt(compId))
      .execute()
    const count = entradas.filter((e) => e.texto === 'Compromisso descartado.').length
    expect(count).toBe(1)
  })

  it('404 — GET /compromissos/:id após descarte retorna 404 (I-09)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('404 — descartar id inexistente', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/compromissos/999999999/descartar',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('401 — sem token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/descartar`,
    })
    expect(res.statusCode).toBe(401)
  })
})
