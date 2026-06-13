import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

// Plugin que expõe o preHandler `autenticar` para rotas protegidas.
// Uso: fastify.addHook('preHandler', fastify.autenticar)  nas rotas que precisam

function autenticarPlugin(fastify: FastifyInstance, _opts: unknown, done: () => void): void {
  fastify.decorate(
    'autenticar',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify()
        request.usuarioId = BigInt(request.user.sub)
      } catch {
        return reply.code(401).send({
          erro: 'NAO_AUTENTICADO',
          mensagem: 'Token ausente, inválido ou expirado.',
        })
      }
    },
  )
  done()
}

export const autenticar = fp(autenticarPlugin)

// Augment do tipo FastifyInstance para expor o decorator
declare module 'fastify' {
  interface FastifyInstance {
    autenticar: (request: FastifyRequest, reply: FastifyReply) => void | Promise<void>
  }
}
