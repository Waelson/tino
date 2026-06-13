// Schemas JSON Schema para validação pelo Fastify — ações e coleções

export const referenciaBodySchema = {
  type: 'object',
  required: ['url'],
  additionalProperties: false,
  properties: {
    url:      { type: 'string' },
    descricao: { type: ['string', 'null'] },
  },
} as const

export const registroManualBodySchema = {
  type: 'object',
  required: ['texto'],
  additionalProperties: false,
  properties: {
    texto: { type: 'string' },
    data:  { type: 'string' },
  },
} as const
