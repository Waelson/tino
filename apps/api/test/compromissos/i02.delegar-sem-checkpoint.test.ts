/**
 * Teste de integração — I-02: delegação exige checkpoint anterior ao prazo.
 * Também cobre A-04: transação revertida — nada persiste após 422.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance
let token: string
const EMAIL = 'i02@comp-test.dev'
const SENHA = 'senha1234'

async function capturar(titulo = 'Compromisso I-02') {
  const res = await server.inject({
    method: 'POST',
    url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo },
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
    payload: { nome: 'I02 Teste', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
})

afterAll(async () => {
  const user = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (user) await db.deleteFrom('compromissos').where('usuario_id', '=', user.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('POST /compromissos/:id/triagem — I-02 (delegação completa)', () => {
  it('retorna 422 I-02 quando checkpoint está ausente', async () => {
    const id = await capturar()
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'delegar', dono: 'Marina', prazo: '2026-12-31' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ erro: string }>().erro).toBe('I-02')
  })

  it('retorna 422 I-02 quando checkpoint é igual ao prazo', async () => {
    const id = await capturar()
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'delegar', dono: 'Marina', prazo: '2026-12-31', checkpoint: '2026-12-31' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ erro: string }>().erro).toBe('I-02')
  })

  it('retorna 422 I-02 quando checkpoint é posterior ao prazo', async () => {
    const id = await capturar()
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'delegar', dono: 'Marina', prazo: '2026-12-30', checkpoint: '2026-12-31' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ erro: string }>().erro).toBe('I-02')
  })

  it('retorna 422 I-02 quando dono é "Eu" (case-insensitive)', async () => {
    const id = await capturar()
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'delegar', dono: 'EU', prazo: '2026-12-31', checkpoint: '2026-12-01' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ erro: string }>().erro).toBe('I-02')
  })

  it('retorna 422 I-02 quando dono está ausente', async () => {
    const id = await capturar()
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'delegar', prazo: '2026-12-31', checkpoint: '2026-12-01' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json<{ erro: string }>().erro).toBe('I-02')
  })

  it('A-04: após 422, tipo do compromisso ainda é null (transação revertida)', async () => {
    const id = await capturar()
    await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'delegar', dono: 'Marina', prazo: '2026-12-31' }, // sem checkpoint → 422
    })
    const comp = await db
      .selectFrom('compromissos')
      .select('tipo')
      .where('id', '=', BigInt(id))
      .executeTakeFirst()
    expect(comp?.tipo).toBeNull()
  })

  it('retorna 200 com delegação válida', async () => {
    const id = await capturar()
    const res = await server.inject({
      method: 'POST',
      url: `/compromissos/${id}/triagem`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { decisao: 'delegar', dono: 'Marina', prazo: '2026-12-31', checkpoint: '2026-12-01' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ tipo: string; dono: string }>()
    expect(body.tipo).toBe('delegada')
    expect(body.dono).toBe('Marina')
  })
})
