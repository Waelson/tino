/**
 * Testes de integração — POST /compromissos/:id/registro (Feature 005)
 * Cobre: fluxo feliz, origem sempre 'usuario', data explícita, data padrão,
 *        texto vazio, texto longo, formato de data inválido, 404, 401.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'
import { hojeEmSP } from '../../src/compromissos/compromissos.service.js'

const EMAIL = 'registro-manual@test.dev'
const SENHA = 'senha1234'

let server: FastifyInstance
let token: string
let comprId: number

async function limpar() {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
}

beforeAll(async () => {
  server = await buildServer()
  await server.ready()

  await limpar()

  const reg = await server.inject({
    method: 'POST', url: '/auth/registro',
    payload: { nome: 'Registro Manual Test', email: EMAIL, senha: SENHA },
  })
  token = reg.json<{ token: string }>().token

  // Captura um compromisso e faz triagem para ter tipo definido
  const cap = await server.inject({
    method: 'POST', url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'API de pagamentos estável em produção' },
  })
  comprId = cap.json<{ id: number }>().id

  await server.inject({
    method: 'POST', url: `/compromissos/${comprId}/triagem`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { tipo: 'fazer' },
  })
})

afterAll(async () => {
  await limpar()
  await server.close()
})

async function post(id: number, payload: object) {
  return server.inject({
    method: 'POST', url: `/compromissos/${id}/registro`,
    headers: { Authorization: `Bearer ${token}` },
    payload,
  })
}

describe('POST /compromissos/:id/registro — entrada manual (Feature 005)', () => {
  it('201 — cria entrada e retorna a entrada criada', async () => {
    const res = await post(comprId, { texto: 'Checkpoint realizado, prazo confirmado.' })
    expect(res.statusCode).toBe(201)
    const entrada = res.json<{ id: number; data: string; origem: string; texto: string; criadaEm: string }>()
    expect(entrada.id).toBeTypeOf('number')
    expect(entrada.texto).toBe('Checkpoint realizado, prazo confirmado.')
    expect(entrada.criadaEm).toBeTypeOf('string')
  })

  it('origem é sempre "usuario"', async () => {
    const res = await post(comprId, { texto: 'Nota de acompanhamento.' })
    expect(res.statusCode).toBe(201)
    expect(res.json<{ origem: string }>().origem).toBe('usuario')
  })

  it('sem data — usa hoje no fuso SP', async () => {
    const res = await post(comprId, { texto: 'Sem data explícita.' })
    expect(res.statusCode).toBe(201)
    expect(res.json<{ data: string }>().data).toBe(hojeEmSP())
  })

  it('com data explícita — usa a data informada', async () => {
    const res = await post(comprId, { texto: 'Com data explícita.', data: '2026-01-15' })
    expect(res.statusCode).toBe(201)
    expect(res.json<{ data: string }>().data).toBe('2026-01-15')
  })

  it('entrada aparece no GET /:id (detalhe)', async () => {
    const texto = 'Nota que deve aparecer no detalhe.'
    await post(comprId, { texto })
    const det = await server.inject({
      method: 'GET', url: `/compromissos/${comprId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    const { registro } = det.json<{ registro: { texto: string; origem: string }[] }>()
    const encontrada = registro.find((e) => e.texto === texto && e.origem === 'usuario')
    expect(encontrada).toBeDefined()
  })

  it('400 — texto vazio rejeitado pelo schema', async () => {
    const res = await post(comprId, { texto: '' })
    expect(res.statusCode).toBe(400)
  })

  it('400 — texto com 2001 chars rejeitado pelo schema', async () => {
    const res = await post(comprId, { texto: 'a'.repeat(2001) })
    expect(res.statusCode).toBe(400)
  })

  it('400 — data com formato inválido rejeitada pelo schema', async () => {
    const res = await post(comprId, { texto: 'Nota.', data: '15/01/2026' })
    expect(res.statusCode).toBe(400)
  })

  it('404 — compromisso inexistente', async () => {
    const res = await post(999999, { texto: 'Nota.' })
    expect(res.statusCode).toBe(404)
  })

  it('401 — sem token', async () => {
    const res = await server.inject({
      method: 'POST', url: `/compromissos/${comprId}/registro`,
      payload: { texto: 'Nota.' },
    })
    expect(res.statusCode).toBe(401)
  })
})
