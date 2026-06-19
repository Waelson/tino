import type { FastifyInstance } from 'fastify'
import { criarLinkSchema, atualizarLinkSchema } from './links.schemas.js'
import { listar, criar, atualizar, excluir, clique } from './links.service.js'

export async function linksRoutes(fastify: FastifyInstance) {
  // GET /links — listar todos do usuário
  fastify.get('/', { preHandler: [fastify.autenticar] }, async (request, reply) => {
    const itens = await listar(request.usuarioId)
    return reply.send({ itens })
  })

  // POST /links — criar link
  fastify.post(
    '/',
    { preHandler: [fastify.autenticar], schema: criarLinkSchema },
    async (request, reply) => {
      const body = request.body as {
        url: string
        nome: string
        descricao?: string | null
        categoria?: string | null
      }
      try {
        const item = await criar(request.usuarioId, body)
        return reply.code(201).send(item)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message: string }
        if (e.statusCode === 422) {
          return reply.code(422).send({ erro: e.erro ?? 'I-12', mensagem: e.message })
        }
        throw err
      }
    },
  )

  // PUT /links/:id — atualizar link
  fastify.put(
    '/:id',
    { preHandler: [fastify.autenticar], schema: atualizarLinkSchema },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        url?: string
        nome?: string
        descricao?: string | null
        categoria?: string | null
      }
      try {
        const item = await atualizar(request.usuarioId, Number(id), body)
        return reply.send(item)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message: string }
        if (e.statusCode === 422) {
          return reply.code(422).send({ erro: e.erro ?? 'I-12', mensagem: e.message })
        }
        if (e.statusCode === 404) {
          return reply.code(404).send({ erro: 'NAO_ENCONTRADO', mensagem: e.message })
        }
        throw err
      }
    },
  )

  // DELETE /links/:id — excluir link
  fastify.delete('/:id', { preHandler: [fastify.autenticar] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await excluir(request.usuarioId, Number(id))
      return reply.code(204).send()
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      if (e.statusCode === 404) {
        return reply.code(404).send({ erro: 'NAO_ENCONTRADO', mensagem: e.message })
      }
      throw err
    }
  })

  // POST /links/:id/clique — incrementar cliques
  fastify.post('/:id/clique', { preHandler: [fastify.autenticar] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await clique(request.usuarioId, Number(id))
      return reply.code(204).send()
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      if (e.statusCode === 404) {
        return reply.code(404).send({ erro: 'NAO_ENCONTRADO', mensagem: e.message })
      }
      throw err
    }
  })
}
