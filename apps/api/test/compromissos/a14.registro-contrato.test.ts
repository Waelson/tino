/**
 * Teste de contrato — A-14 (I-05): rotas de mutação do registro NÃO existem.
 * `03-api.md` §6: PATCH/PUT/DELETE /registro/* devem responder 404/405.
 * O update/delete em banco já é coberto por A-08.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'

let server: FastifyInstance

beforeAll(async () => {
  server = await buildServer()
  await server.ready()
})

afterAll(async () => {
  await server.close()
})

describe('A-14 — contrato: rotas de mutação do registro não existem (I-05)', () => {
  it('PATCH /compromissos/1/registro → 404', async () => {
    const res = await server.inject({ method: 'PATCH', url: '/compromissos/1/registro' })
    expect([404, 405]).toContain(res.statusCode)
  })

  it('PUT /compromissos/1/registro/1 → 404', async () => {
    const res = await server.inject({ method: 'PUT', url: '/compromissos/1/registro/1' })
    expect([404, 405]).toContain(res.statusCode)
  })

  it('DELETE /compromissos/1/registro/1 → 404', async () => {
    const res = await server.inject({ method: 'DELETE', url: '/compromissos/1/registro/1' })
    expect([404, 405]).toContain(res.statusCode)
  })

  it('DELETE /compromissos/1 (hard delete) → 404', async () => {
    const res = await server.inject({ method: 'DELETE', url: '/compromissos/1' })
    expect([404, 405]).toContain(res.statusCode)
  })
})
