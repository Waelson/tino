/**
 * Teste de integração — I-01: título obrigatório em POST /compromissos
 * Cobre: título vazio, título só espaços, título válido.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance
let token: string
const EMAIL = 'i01@comp-test.dev'
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
    payload: { nome: 'I01 Teste', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
})

afterAll(async () => {
  const user = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (user) await db.deleteFrom('compromissos').where('usuario_id', '=', user.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('POST /compromissos — I-01 (título obrigatório)', () => {
  it('retorna 422 I-01 para título vazio', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
      payload: { titulo: '' },
    })
    expect(res.statusCode).toBe(422)
    const body = res.json<{ erro: string }>()
    expect(body.erro).toBe('I-01')
  })

  it('retorna 422 I-01 para título com apenas espaços', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
      payload: { titulo: '   ' },
    })
    expect(res.statusCode).toBe(422)
    const body = res.json<{ erro: string }>()
    expect(body.erro).toBe('I-01')
  })

  it('retorna 201 para título válido', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
      payload: { titulo: 'API de billing estável em produção' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ id: number; titulo: string; tipo: null }>()
    expect(body.tipo).toBeNull()
    expect(body.titulo).toBe('API de billing estável em produção')
  })
})
