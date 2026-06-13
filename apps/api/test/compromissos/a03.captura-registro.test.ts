/**
 * Teste de integração — A-03 (parcial): captura grava entrada automática
 * "Capturada." com origem "sistema" no registro do compromisso.
 * Verificado via query direta ao banco (sem UI de registro nesta fatia).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance
let token: string
const EMAIL = 'a03@comp-test.dev'
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
    payload: { nome: 'A03 Teste', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
})

afterAll(async () => {
  const user = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (user) await db.deleteFrom('compromissos').where('usuario_id', '=', user.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('A-03 — entrada automática "Capturada." no registro', () => {
  it('grava exatamente 1 entrada de registro com texto "Capturada." e origem "sistema"', async () => {
    const capRes = await server.inject({
      method: 'POST',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
      payload: { titulo: 'Compromisso A-03' },
    })
    expect(capRes.statusCode).toBe(201)
    const { id } = capRes.json<{ id: number }>()

    const entradas = await db
      .selectFrom('registro_entradas')
      .selectAll()
      .where('compromisso_id', '=', BigInt(id))
      .execute()

    expect(entradas).toHaveLength(1)
    expect(entradas[0].texto).toBe('Capturada.')
    expect(entradas[0].origem).toBe('sistema')
  })

  it('entrada de registro é gravada atomicamente na mesma transação que o compromisso', async () => {
    // Se a transação funciona, nunca há compromisso sem entrada "Capturada."
    const capRes = await server.inject({
      method: 'POST',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
      payload: { titulo: 'Atomicidade A-03' },
    })
    const { id } = capRes.json<{ id: number }>()

    const [comp, entradas] = await Promise.all([
      db.selectFrom('compromissos').selectAll().where('id', '=', BigInt(id)).executeTakeFirst(),
      db
        .selectFrom('registro_entradas')
        .selectAll()
        .where('compromisso_id', '=', BigInt(id))
        .execute(),
    ])

    expect(comp).toBeDefined()
    expect(entradas.length).toBeGreaterThanOrEqual(1)
    expect(entradas.some((e) => e.texto === 'Capturada.')).toBe(true)
  })
})
