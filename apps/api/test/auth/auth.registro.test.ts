/**
 * Testes de integração — POST /auth/registro
 * Cobrem: registro bem-sucedido, email duplicado, senha curta.
 * Usam buildServer() sem porta real (injecção Fastify).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance

beforeAll(async () => {
  server = await buildServer()
  await server.ready()
  // Limpar usuários de teste antes de rodar
  await db.deleteFrom('usuarios').where('email', 'like', '%@reg-test.dev').execute()
})

afterAll(async () => {
  await db.deleteFrom('usuarios').where('email', 'like', '%@reg-test.dev').execute()
  await server.close()
})

describe('POST /auth/registro', () => {
  it('cria conta e retorna token + usuario', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: {
        nome: 'Usuário Teste',
        email: 'novo@reg-test.dev',
        senha: 'senha123',
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json<{ token: string; usuario: { id: number; nome: string; email: string } }>()
    expect(typeof body.token).toBe('string')
    expect(body.token.length).toBeGreaterThan(10)
    expect(body.usuario.email).toBe('novo@reg-test.dev')
    expect(body.usuario.nome).toBe('Usuário Teste')
    expect(typeof body.usuario.id).toBe('number')
  })

  it('retorna 422 EMAIL_EM_USO ao tentar registrar e-mail duplicado', async () => {
    // Primeiro registro
    await server.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: { nome: 'A', email: 'dup@reg-test.dev', senha: 'senha123' },
    })

    // Segundo registro com mesmo e-mail
    const res = await server.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: { nome: 'B', email: 'dup@reg-test.dev', senha: 'senha456' },
    })

    expect(res.statusCode).toBe(422)
    const body = res.json<{ erro: string }>()
    expect(body.erro).toBe('EMAIL_EM_USO')
  })

  it('retorna 400 quando senha tem menos de 8 caracteres', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: { nome: 'X', email: 'curta@reg-test.dev', senha: '1234567' },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json<{ erro: string }>()
    expect(body.erro).toBe('REQUISICAO_INVALIDA')
  })

  it('retorna 400 quando campo obrigatório está ausente', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/registro',
      payload: { email: 'sem-nome@reg-test.dev', senha: 'senha123' },
    })

    expect(res.statusCode).toBe(400)
  })
})
