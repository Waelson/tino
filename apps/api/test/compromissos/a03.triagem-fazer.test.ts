/**
 * Teste de integração — A-03 (parte triagem): decisão "fazer"
 * Item sai da fila, aparece em ativas com dono="Eu" e registro contém as duas entradas.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance
let token: string
let fazerId: number
const EMAIL = 'a03f@comp-test.dev'
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
    payload: { nome: 'A03 Fazer', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token

  // Capturar e decidir "fazer"
  const capRes = await server.inject({
    method: 'POST',
    url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Resultado esperado A-03' },
  })
  fazerId = capRes.json<{ id: number }>().id

  await server.inject({
    method: 'POST',
    url: `/compromissos/${fazerId}/triagem`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { decisao: 'fazer' },
  })
})

afterAll(async () => {
  const user = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (user) await db.deleteFrom('compromissos').where('usuario_id', '=', user.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('A-03 — triagem "fazer"', () => {
  it('retorna tipo=fazer e dono=Eu (I-03)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${fazerId}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'fazer' },
    })
    // Já foi triado no beforeAll → 409
    expect(res.statusCode).toBe(409)

    // Verificar via banco que os valores estão corretos
    const comp = await db
      .selectFrom('compromissos')
      .select(['tipo', 'dono'])
      .where('id', '=', BigInt(fazerId))
      .executeTakeFirst()
    expect(comp?.tipo).toBe('fazer')
    expect(comp?.dono).toBe('Eu')
  })

  it('item aparece em GET /compromissos (ativas) após triagem "fazer"', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = res.json<{ itens: Array<{ id: number; tipo: string }> }>()
    const item = body.itens.find((i) => i.id === fazerId)
    expect(item).toBeDefined()
    expect(item?.tipo).toBe('fazer')
  })

  it('item NÃO aparece mais em GET /compromissos/triagem', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos/triagem',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = res.json<{ itens: Array<{ id: number }> }>()
    expect(body.itens.map((i) => i.id)).not.toContain(fazerId)
  })

  it('registro contém "Capturada." e "Triagem: execução própria." (A-03)', async () => {
    const entradas = await db
      .selectFrom('registro_entradas')
      .select('texto')
      .where('compromisso_id', '=', BigInt(fazerId))
      .orderBy('id', 'asc')
      .execute()
    const textos = entradas.map((e) => e.texto)
    expect(textos).toContain('Capturada.')
    expect(textos).toContain('Triagem: execução própria.')
    expect(textos).toHaveLength(2)
  })
})
