/**
 * Teste de integração — A-18: reabertura de compromisso concluído (I-08)
 * Cobre: concluir → PATCH status=em_andamento → 200 + entrada automática de transição.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'a18-reabertura@comp-test.dev'
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
    payload: { nome: 'A18 Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token

  const capRes = await server.inject({
    method: 'POST', url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso para A-18' },
  })
  compId = capRes.json<{ id: number }>().id

  // Triar como fazer
  await server.inject({
    method: 'POST', url: `/compromissos/${compId}/triagem`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { decisao: 'fazer' },
  })

  // Concluir
  await server.inject({
    method: 'POST', url: `/compromissos/${compId}/concluir`,
    headers: { Authorization: `Bearer ${token}` },
  })
})

afterAll(async () => {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('A-18 — reabertura registrada (I-08)', () => {
  it('200 — PATCH status=em_andamento em concluído é aceito', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { status: 'em_andamento' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ status: string }>().status).toBe('em_andamento')
  })

  it('entrada automática de transição gerada', async () => {
    const det = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    const registro = det.json<{ registro: Array<{ texto: string }> }>().registro
    expect(registro.some((r) => r.texto === 'Status: concluida → em_andamento.')).toBe(true)
  })
})
