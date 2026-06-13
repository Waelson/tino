/**
 * Teste de integração — I-04: adiamento exige prazo.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance
let token: string
const EMAIL = 'i04@comp-test.dev'
const SENHA = 'senha1234'

async function capturar() {
  const res = await server.inject({
    method: 'POST',
    url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso I-04' },
  })
  return res.json<{ id: number }>().id
}

beforeAll(async () => {
  server = await buildServer()
  await server.ready()
  const existente = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (existente) await db.deleteFrom('compromissos').where('usuario_id', '=', existente.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  const res = await server.inject({
    method: 'POST',
    url: '/auth/registro',
    payload: { nome: 'I04 Teste', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
})

afterAll(async () => {
  const user = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (user) await db.deleteFrom('compromissos').where('usuario_id', '=', user.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('POST /compromissos/:id/triagem — I-04 (adiamento exige prazo)', () => {
  it('retorna 422 I-04 quando prazo está ausente em decisão adiar', async () => {
    const id = await capturar()
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'adiar' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ erro: string }>().erro).toBe('I-04')
  })

  it('retorna 200 com tipo=adiada quando prazo está presente', async () => {
    const id = await capturar()
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'adiar', prazo: '2026-12-31' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ tipo: string; prazo: string }>()
    expect(body.tipo).toBe('adiada')
    expect(body.prazo).toBe('2026-12-31')
  })

  it('retorna 409 ESTADO_INVALIDO ao tentar triar compromisso já triado', async () => {
    const id = await capturar()
    // Primeira triagem
    await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'adiar', prazo: '2026-12-31' },
    })
    // Segunda tentativa
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'fazer' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json<{ erro: string }>().erro).toBe('ESTADO_INVALIDO')
  })
})
