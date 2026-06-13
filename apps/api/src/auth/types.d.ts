// Declaration merging para adicionar usuarioId ao FastifyRequest
import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string }
    user: { sub: string; email: string }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    usuarioId: bigint
  }
}
