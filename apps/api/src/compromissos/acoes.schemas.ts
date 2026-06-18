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
    texto: { type: 'string', minLength: 1, maxLength: 2000 },
    data:  { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  },
} as const
