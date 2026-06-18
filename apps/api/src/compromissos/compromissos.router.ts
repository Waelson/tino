import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { capturaBodySchema, filtroQuerySchema } from './compromissos.schemas.js'
import { triagemBodySchema } from './triagem.schemas.js'
import { capturar, listar, listarTriagem, buscarDetalhe, type FiltroLista } from './compromissos.service.js'
import { processarTriagem, type TriagemBody } from './triagem.service.js'
import { editarCompromisso, type PatchBody } from './patch.service.js'
import { patchBodySchema } from './patch.schemas.js'
import { concluir, descartar } from './acoes.service.js'
import { adicionar as adicionarRef, remover as removerRef } from './referencias.service.js'
import { adicionarEntradaManual } from './registro-manual.service.js'
import { referenciaBodySchema, registroManualBodySchema } from './acoes.schemas.js'

export function compromissosRoutes(
  fastify: FastifyInstance,
  _opts: unknown,
  done: () => void,
): void {
  // POST / — captura (C-01)
  fastify.post(
    '/',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: { body: capturaBodySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { titulo } = request.body as { titulo: string }
      try {
        const compromisso = await capturar(request.usuarioId, titulo)
        return reply.code(201).send(compromisso)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode === 422 && e.erro) {
          return reply.code(422).send({ erro: e.erro, mensagem: e.message })
        }
        throw err
      }
    },
  )

  // GET /triagem — fila FIFO (deve preceder /:id futuro)
  fastify.get(
    '/triagem',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const itens = await listarTriagem(request.usuarioId)
      return reply.send({ itens })
    },
  )

  // GET / — lista com filtro (default: ativas)
  fastify.get(
    '/',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: { querystring: filtroQuerySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { filtro, q, dono } = request.query as { filtro?: FiltroLista; q?: string; dono?: string }
      const itens = await listar(request.usuarioId, filtro, q, dono)
      return reply.send({ itens })
    },
  )

  // POST /:id/triagem — decisão de triagem (C-02)
  fastify.post(
    '/:id/triagem',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
          required: ['id'],
        },
        body: triagemBodySchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = request.body as TriagemBody
      try {
        const compromisso = await processarTriagem(request.usuarioId, BigInt(id), body)
        return reply.send(compromisso)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode && e.erro) {
          return reply.code(e.statusCode).send({ erro: e.erro, mensagem: e.message })
        }
        throw err
      }
    },
  )

  // GET /:id — ficha do compromisso (CompromissoDetalhe)
  fastify.get(
    '/:id',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const detalhe = await buscarDetalhe(request.usuarioId, BigInt(id))
        return reply.send(detalhe)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode === 404) {
          return reply.code(404).send({ erro: 'NAO_ENCONTRADO', mensagem: e.message })
        }
        throw err
      }
    },
  )

  // POST /:id/concluir — conclui compromisso (I-08, idempotente)
  fastify.post(
    '/:id/concluir',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const compromisso = await concluir(request.usuarioId, BigInt(id))
        return reply.send(compromisso)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode && e.erro) {
          return reply.code(e.statusCode).send({ erro: e.erro, mensagem: e.message })
        }
        throw err
      }
    },
  )

  // POST /:id/descartar — descarta compromisso (I-09, idempotente)
  fastify.post(
    '/:id/descartar',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      try {
        const result = await descartar(request.usuarioId, BigInt(id))
        return reply.send(result)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode && e.erro) {
          return reply.code(e.statusCode).send({ erro: e.erro, mensagem: e.message })
        }
        throw err
      }
    },
  )

  // POST /:id/referencias — adiciona referência (I-12)
  fastify.post(
    '/:id/referencias',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
          required: ['id'],
        },
        body: referenciaBodySchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = request.body as { url: string; descricao?: string | null }
      try {
        const ref = await adicionarRef(request.usuarioId, BigInt(id), body)
        return reply.code(201).send(ref)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode && e.erro) {
          return reply.code(e.statusCode).send({ erro: e.erro, mensagem: e.message })
        }
        throw err
      }
    },
  )

  // DELETE /:id/referencias/:refId — remove referência
  fastify.delete(
    '/:id/referencias/:refId',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: {
        params: {
          type: 'object',
          properties: {
            id:    { type: 'string', pattern: '^[0-9]+$' },
            refId: { type: 'string', pattern: '^[0-9]+$' },
          },
          required: ['id', 'refId'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, refId } = request.params as { id: string; refId: string }
      try {
        await removerRef(request.usuarioId, BigInt(id), BigInt(refId))
        return reply.code(204).send()
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode && e.erro) {
          return reply.code(e.statusCode).send({ erro: e.erro, mensagem: e.message })
        }
        throw err
      }
    },
  )

  // POST /:id/registro — adiciona entrada manual (I-05: append-only)
  fastify.post(
    '/:id/registro',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
          required: ['id'],
        },
        body: registroManualBodySchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = request.body as { texto: string; data?: string }
      try {
        const entrada = await adicionarEntradaManual(request.usuarioId, BigInt(id), body)
        return reply.code(201).send(entrada)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode && e.erro) {
          return reply.code(e.statusCode).send({ erro: e.erro, mensagem: e.message })
        }
        throw err
      }
    },
  )

  // PATCH /:id — edição de compromisso (estado resultante + entradas automáticas)
  fastify.patch(
    '/:id',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.autenticar,
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
          required: ['id'],
        },
        body: patchBodySchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = request.body as PatchBody
      try {
        const compromisso = await editarCompromisso(request.usuarioId, BigInt(id), body)
        return reply.send(compromisso)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; erro?: string; message?: string }
        if (e.statusCode && e.erro) {
          return reply.code(e.statusCode).send({ erro: e.erro, mensagem: e.message })
        }
        throw err
      }
    },
  )

  done()
}
