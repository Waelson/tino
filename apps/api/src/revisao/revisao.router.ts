import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { revisaoQuerySchema, narrativaBodySchema } from './revisao.schemas.js'
import { obterRevisao, obterNarrativa, obterNarrativaCache } from './revisao.service.js'

export function revisaoRoutes(
  fastify: FastifyInstance,
  _opts: unknown,
  done: () => void,
): void {
  // GET /revisao — dados estruturados da semana (sem IA)
  fastify.get(
    '/',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: { querystring: revisaoQuerySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { semana } = request.query as { semana?: string }
      const dados = await obterRevisao(request.usuarioId, semana)
      return reply.send(dados)
    },
  )

  // GET /revisao/narrativa — retorna cache existente sem gerar nova
  fastify.get(
    '/narrativa',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: { querystring: revisaoQuerySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { semana } = request.query as { semana?: string }
      const resultado = await obterNarrativaCache(request.usuarioId, semana)
      return reply.send(resultado)
    },
  )

  // POST /revisao/narrativa — gera ou retorna cache se dados não mudaram
  fastify.post(
    '/narrativa',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: { body: narrativaBodySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { semana } = (request.body ?? {}) as { semana?: string }
      try {
        const narrativa = await obterNarrativa(request.usuarioId, semana)
        return reply.send(narrativa)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode === 503 && e.erro) {
          return reply.code(503).send({ erro: e.erro, mensagem: e.message })
        }
        throw err
      }
    },
  )

  done()
}
