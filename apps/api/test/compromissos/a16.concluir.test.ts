/**
 * Teste de integração — A-16: POST /compromissos/:id/concluir (I-08, idempotente)
 * Cobre: concluir item ativo, idempotência sem entrada duplicada, 404.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'a16-concluir@comp-test.dev'
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
    payload: { nome: 'A16 Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token

  const capRes = await server.inject({
    method: 'POST', url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso para A-16' },
  })
  compId = capRes.json<{ id: number }>().id

  // Triar como fazer para sair da triagem
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

describe('A-16 — concluir (I-08)', () => {
  it('200 — concluir item ativo → status=concluida + entrada automática', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/concluir`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ status: string }>().status).toBe('concluida')

    // Verificar entrada automática
    const det = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    const registro = det.json<{ registro: Array<{ texto: string }> }>().registro
    expect(registro.some((r) => r.texto === 'Compromisso concluído.')).toBe(true)
  })

  it('200 — concluir duas vezes → apenas UMA entrada "Compromisso concluído." (idempotente)', async () => {
    await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/concluir`,
      headers: { Authorization: `Bearer ${token}` },
    })

    const det = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    const registro = det.json<{ registro: Array<{ texto: string }> }>().registro
    const count = registro.filter((r) => r.texto === 'Compromisso concluído.').length
    expect(count).toBe(1)
  })

  it('404 — concluir id inexistente', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/compromissos/999999999/concluir',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('401 — sem token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/concluir`,
    })
    expect(res.statusCode).toBe(401)
  })
})
