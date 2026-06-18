import type { FastifyInstance } from 'fastify'
import { obterBriefingCache, obterBriefing } from './risco.service.js'

export async function riscoRoutes(fastify: FastifyInstance) {
  // GET /risco/briefing-cache — retorna cache sem chamar IA
  fastify.get(
    '/briefing-cache',
    { preHandler: [fastify.autenticar] },
    async (request, reply) => {
      const resultado = await obterBriefingCache(request.usuarioId)
      return reply.send(resultado)
    },
  )

  // POST /risco/briefing — gera ou retorna cache se hash bater
  fastify.post(
    '/briefing',
    { preHandler: [fastify.autenticar] },
    async (request, reply) => {
      const resultado = await obterBriefing(request.usuarioId)
      return reply.send(resultado)
    },
  )
}
