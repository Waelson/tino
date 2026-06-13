/**
 * Teste de integração — A-09: isolamento de usuários.
 * Usuário B não enxerga compromissos do usuário A (responde 404, não 403).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance
let tokenA: string
let tokenB: string
let compromissoDeA: number
const EMAIL_A = 'a09a@comp-test.dev'
const EMAIL_B = 'a09b@comp-test.dev'
const SENHA = 'senha1234'

async function limparUsuario(email: string) {
  const user = await db.selectFrom('usuarios').select('id').where('email', '=', email).executeTakeFirst()
  if (user) await db.deleteFrom('compromissos').where('usuario_id', '=', user.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', email).execute()
}

beforeAll(async () => {
  server = await buildServer()
  await server.ready()
  await limparUsuario(EMAIL_A)
  await limparUsuario(EMAIL_B)

  const resA = await server.inject({
    method: 'POST',
    url: '/auth/registro',
    payload: { nome: 'Usuário A', email: EMAIL_A, senha: SENHA },
  })
  tokenA = resA.json<{ token: string }>().token

  const resB = await server.inject({
    method: 'POST',
    url: '/auth/registro',
    payload: { nome: 'Usuário B', email: EMAIL_B, senha: SENHA },
  })
  tokenB = resB.json<{ token: string }>().token

  // Usuário A captura um compromisso
  const capRes = await server.inject({
    method: 'POST',
    url: '/compromissos',
    headers: { Authorization: `Bearer ${tokenA}` },
    payload: { titulo: 'Compromisso exclusivo do usuário A' },
  })
  compromissoDeA = capRes.json<{ id: number }>().id
})

afterAll(async () => {
  await limparUsuario(EMAIL_A)
  await limparUsuario(EMAIL_B)
  await server.close()
})

describe('A-09 — isolamento entre usuários', () => {
  it('GET /compromissos de B não contém compromisso de A', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${tokenB}` },
    })
    const body = res.json<{ itens: Array<{ id: number }> }>()
    expect(body.itens.map((i) => i.id)).not.toContain(compromissoDeA)
  })

  it('GET /compromissos/triagem de B não contém compromisso de A', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos/triagem',
      headers: { Authorization: `Bearer ${tokenB}` },
    })
    const body = res.json<{ itens: Array<{ id: number }> }>()
    expect(body.itens.map((i) => i.id)).not.toContain(compromissoDeA)
  })

  it('POST /compromissos/:id/triagem de B para compromisso de A retorna 404', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compromissoDeA}/triagem`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { decisao: 'fazer' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json<{ erro: string }>().erro).toBe('NAO_ENCONTRADO')
  })

  it('usuário A ainda consegue triar o próprio compromisso (integridade)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${compromissoDeA}/triagem`,
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { decisao: 'fazer' },
    })
    expect(res.statusCode).toBe(200)
  })
})
