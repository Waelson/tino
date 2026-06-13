import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { obterMetricas } from './compromissos.service.js'

export function metricasRoutes(
  fastify: FastifyInstance,
  _opts: unknown,
  done: () => void,
): void {
  // GET /metricas — painel de métricas do usuário (I-06, I-07, I-11)
  fastify.get(
    '/metricas',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const m = await obterMetricas(request.usuarioId)
      return reply.send(m)
    },
  )

  done()
}
