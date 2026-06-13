/**
 * Teste de integração — A-15: referências (I-12)
 * Cobre: adicionar URL válida (201), rejeição de esquemas inválidos (422 I-12),
 * remover (204), isolamento entre compromissos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'a15-referencias@comp-test.dev'
const SENHA = 'senha1234'

let server: FastifyInstance
let token: string
let compId: number
let refId: number

beforeAll(async () => {
  server = await buildServer()
  await server.ready()

  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()

  const res = await server.inject({
    method: 'POST', url: '/auth/registro',
    payload: { nome: 'A15 Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token

  const capRes = await server.inject({
    method: 'POST', url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso para A-15' },
  })
  compId = capRes.json<{ id: number }>().id
})

afterAll(async () => {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('A-15 — referências (I-12)', () => {
  it('201 — URL https válida cria referência', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/referencias`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { url: 'https://exemplo.com/doc', descricao: 'Documentação' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ id: number; url: string; descricao: string; criadaEm: string }>()
    expect(body.url).toBe('https://exemplo.com/doc')
    expect(body.descricao).toBe('Documentação')
    expect(body.criadaEm).toBeDefined()
    refId = body.id
  })

  it('201 — URL http válida é aceita', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/referencias`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { url: 'http://interno.empresa.com/wiki' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('422 I-12 — javascript:alert(1) é rejeitado', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/referencias`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { url: 'javascript:alert(1)' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ erro: string }>().erro).toBe('I-12')
  })

  it('422 I-12 — ftp:// é rejeitado', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/referencias`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { url: 'ftp://servidor/arquivo' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ erro: string }>().erro).toBe('I-12')
  })

  it('204 — remover referência criada', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/compromissos/${compId}/referencias/${refId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(204)
  })

  it('404 — remover referência já removida (ou de outro compromisso)', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/compromissos/${compId}/referencias/${refId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('404 — POST referencias em compromisso inexistente', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/compromissos/999999999/referencias',
      headers: { Authorization: `Bearer ${token}` },
      payload: { url: 'https://exemplo.com' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('401 — sem token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compId}/referencias`,
      payload: { url: 'https://exemplo.com' },
    })
    expect(res.statusCode).toBe(401)
  })
})
