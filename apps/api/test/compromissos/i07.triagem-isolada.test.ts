/**
 * Teste de integração — I-07: compromisso capturado (tipo=null)
 * aparece EXCLUSIVAMENTE na fila de triagem, nunca na lista de ativas.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance
let token: string
let compromissoId: number
const EMAIL = 'i07@comp-test.dev'
const SENHA = 'senha1234'

beforeAll(async () => {
  server = await buildServer()
  await server.ready()
  const existente = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (existente) await db.deleteFrom('compromissos').where('usuario_id', '=', existente.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  const regRes = await server.inject({
    method: 'POST',
    url: '/auth/registro',
    payload: { nome: 'I07 Teste', email: EMAIL, senha: SENHA },
  })
  token = regRes.json<{ token: string }>().token

  // Capturar um compromisso para usar nos testes
  const capRes = await server.inject({
    method: 'POST',
    url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Item para triagem I-07' },
  })
  compromissoId = capRes.json<{ id: number }>().id
})

afterAll(async () => {
  const user = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (user) await db.deleteFrom('compromissos').where('usuario_id', '=', user.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('I-07 — triagem isolada da lista principal', () => {
  it('item capturado NÃO aparece em GET /compromissos (ativas)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ itens: Array<{ id: number }> }>()
    const ids = body.itens.map((i) => i.id)
    expect(ids).not.toContain(compromissoId)
  })

  it('item capturado APARECE em GET /compromissos/triagem', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos/triagem',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ itens: Array<{ id: number; tipo: null }> }>()
    const item = body.itens.find((i) => i.id === compromissoId)
    expect(item).toBeDefined()
    expect(item?.tipo).toBeNull()
  })

  it('fila de triagem retorna itens em ordem FIFO (criação ASC)', async () => {
    // Capturar mais um item
    const capRes = await server.inject({
      method: 'POST',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
      payload: { titulo: 'Item posterior I-07' },
    })
    const segundoId = capRes.json<{ id: number }>().id

    const res = await server.inject({
      method: 'GET',
      url: '/compromissos/triagem',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = res.json<{ itens: Array<{ id: number }> }>()
    const ids = body.itens.map((i) => i.id)
    expect(ids.indexOf(compromissoId)).toBeLessThan(ids.indexOf(segundoId))
  })
})
