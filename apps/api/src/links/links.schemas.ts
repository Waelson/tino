import type { FastifySchema } from 'fastify'

export const criarLinkSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['url', 'nome'],
    properties: {
      url:       { type: 'string', minLength: 1 },
      nome:      { type: 'string', minLength: 1, maxLength: 120 },
      descricao: { type: 'string', maxLength: 280, nullable: true },
      categoria: { type: 'string', maxLength: 80,  nullable: true },
    },
    additionalProperties: false,
  },
}

export const atualizarLinkSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      url:       { type: 'string', minLength: 1 },
      nome:      { type: 'string', minLength: 1, maxLength: 120 },
      descricao: { type: 'string', maxLength: 280, nullable: true },
      categoria: { type: 'string', maxLength: 80,  nullable: true },
    },
    additionalProperties: false,
  },
}
