/**
 * Teste de integração — A-13: dono travado em tipo=fazer (I-03)
 * Cobre: PATCH com dono diferente em fazer → dono permanece 'Eu'.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'a13-fazer-dono@comp-test.dev'
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
    payload: { nome: 'A13 Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token

  // Capturar e triar como fazer
  const capRes = await server.inject({
    method: 'POST', url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso para A-13' },
  })
  compId = capRes.json<{ id: number }>().id

  await server.inject({
    method: 'POST', url: `/compromissos/${compId}/triagem`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { decisao: 'fazer' },
  })
})

afterAll(async () => {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('A-13 — PATCH dono em tipo=fazer (I-03)', () => {
  it('200 — dono enviado é ignorado, permanece "Eu"', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { dono: 'Outro' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ dono: string }>().dono).toBe('Eu')
  })

  it('200 — comigo=true permanece após tentativa de trocar dono', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ dono: string; comigo: boolean }>().dono).toBe('Eu')
    expect(res.json<{ comigo: boolean }>().comigo).toBe(true)
  })
})
