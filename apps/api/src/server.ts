import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { config } from './infra/config.js'
import { autenticar } from './infra/autenticar.js'
import { authRoutes } from './auth/auth.router.js'
import { compromissosRoutes } from './compromissos/compromissos.router.js'
import { metricasRoutes } from './compromissos/metricas.router.js'

export async function buildServer() {
  const fastify = Fastify({
    logger: config.NODE_ENV !== 'test',
  })

  // ─── Plugins globais ────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? true,
  })

  await fastify.register(jwt, {
    secret: config.JWT_SECRET,
  })

  // Plugin que decora fastify.autenticar para uso como preHandler
  await fastify.register(autenticar)

  // ─── Handler global de erros (deve preceder o registro de rotas filhas) ─────
  fastify.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.code(400).send({
        erro: 'REQUISICAO_INVALIDA',
        mensagem: 'Dados da requisição inválidos.',
      })
    }
    fastify.log.error(error)
    return reply.code(500).send({
      erro: 'ERRO_INTERNO',
      mensagem: 'Erro interno do servidor.',
    })
  })

  // ─── Rotas públicas ─────────────────────────────────────────────────────────
  await fastify.register(authRoutes, { prefix: '/auth' })

  // ─── Rota de health check ───────────────────────────────────────────────────
  fastify.get('/health', () => ({ ok: true }))

  // ─── Rotas protegidas ───────────────────────────────────────────────────────
  await fastify.register(metricasRoutes)
  await fastify.register(compromissosRoutes, { prefix: '/compromissos' })

  return fastify
}

// ─── Inicialização (não executada nos testes) ────────────────────────────────
if (process.env['NODE_ENV'] !== 'test') {
  const server = await buildServer()
  await server.listen({ port: config.PORT, host: '0.0.0.0' })
}
