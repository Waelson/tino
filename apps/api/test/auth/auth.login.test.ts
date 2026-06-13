/**
 * Testes de integração — POST /auth/login + middleware Bearer
 * Cobrem: login válido, credenciais inválidas, rota protegida sem/com token errado.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

let server: FastifyInstance
const EMAIL = 'login@login-test.dev'
const SENHA = 'senhavalida123'

beforeAll(async () => {
  server = await buildServer()
  await server.ready()
  // Criar usuário de teste via endpoint de registro
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.inject({
    method: 'POST',
    url: '/auth/registro',
    payload: { nome: 'Login Teste', email: EMAIL, senha: SENHA },
  })
})

afterAll(async () => {
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
  await server.close()
})

describe('POST /auth/login', () => {
  it('retorna 200 com token e usuario para credenciais válidas', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: EMAIL, senha: SENHA },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ token: string; usuario: { email: string } }>()
    expect(typeof body.token).toBe('string')
    expect(body.usuario.email).toBe(EMAIL)
  })

  it('retorna 401 CREDENCIAIS_INVALIDAS para e-mail inexistente', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'naoexiste@login-test.dev', senha: SENHA },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json<{ erro: string; mensagem: string }>()
    expect(body.erro).toBe('CREDENCIAIS_INVALIDAS')
  })

  it('retorna 401 CREDENCIAIS_INVALIDAS para senha errada', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: EMAIL, senha: 'senhaerrada99' },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json<{ erro: string; mensagem: string }>()
    expect(body.erro).toBe('CREDENCIAIS_INVALIDAS')
    // Mesmo erro para email inexistente e senha errada — não diferenciar (segurança)
  })

  it('mensagem de erro é idêntica para e-mail inexistente e senha errada', async () => {
    const [r1, r2] = await Promise.all([
      server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'x@login-test.dev', senha: SENHA },
      }),
      server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: EMAIL, senha: 'errada' },
      }),
    ])
    const b1 = r1.json<{ mensagem: string }>()
    const b2 = r2.json<{ mensagem: string }>()
    expect(b1.mensagem).toBe(b2.mensagem)
  })
})

describe('Middleware Bearer (A-09 parcial)', () => {
  it('GET /compromissos sem token retorna 401 NAO_AUTENTICADO', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos',
    })

    expect(res.statusCode).toBe(401)
    const body = res.json<{ erro: string }>()
    expect(body.erro).toBe('NAO_AUTENTICADO')
  })

  it('GET /compromissos com token adulterado retorna 401 NAO_AUTENTICADO', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos',
      headers: { Authorization: 'Bearer token.invalido.qualquer' },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json<{ erro: string }>()
    expect(body.erro).toBe('NAO_AUTENTICADO')
  })

  it('GET /compromissos com token válido retorna 200 (lista vazia)', async () => {
    // Obter token real
    const loginRes = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: EMAIL, senha: SENHA },
    })
    const { token } = loginRes.json<{ token: string }>()

    const res = await server.inject({
      method: 'GET',
      url: '/compromissos',
      headers: { Authorization: `Bearer ${token}` },
    })

    // A rota /compromissos ainda não existe na etapa 2 — mas o middleware
    // de auth deve deixar passar (404 de rota, não 401 de auth)
    expect(res.statusCode).not.toBe(401)
  })
})
