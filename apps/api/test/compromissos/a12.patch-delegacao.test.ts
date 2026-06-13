/**
 * Teste de integração — A-12: PATCH checkpoint em delegada
 * Cobre: checkpoint >= prazo → 422 I-02 (sem persistir); checkpoint válido → 200 + entrada automática.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'a12-delegacao@comp-test.dev'
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
    payload: { nome: 'A12 Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token

  // Capturar e triar como delegada
  const capRes = await server.inject({
    method: 'POST', url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso para A-12' },
  })
  compId = capRes.json<{ id: number }>().id

  await server.inject({
    method: 'POST', url: `/compromissos/${compId}/triagem`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { decisao: 'delegar', dono: 'Fulano', prazo: '2026-12-31', checkpoint: '2026-12-15' },
  })
})

afterAll(async () => {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('A-12 — PATCH checkpoint em delegada', () => {
  it('422 I-02 — checkpoint >= prazo não é aceito', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { checkpoint: '2026-12-31' }, // igual ao prazo
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ erro: string }>().erro).toBe('I-02')
  })

  it('422 I-02 — nada persistido após rejeição', async () => {
    // Verificar que o checkpoint permanece o original
    const res = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ checkpoint: string }>().checkpoint).toBe('2026-12-15')
  })

  it('200 — checkpoint válido aceito + entrada automática no registro', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { checkpoint: '2026-12-01' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ checkpoint: string }>().checkpoint).toBe('2026-12-01')

    // Verificar entrada automática via GET detalhe
    const det = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    const registro = det.json<{ registro: Array<{ texto: string }> }>().registro
    expect(registro.some((r) => r.texto.startsWith('Checkpoint alterado de'))).toBe(true)
  })
})
