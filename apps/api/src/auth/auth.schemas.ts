// Schemas JSON Schema para validação pelo Fastify (validação declarativa no handler)

export const registroBodySchema = {
  type: 'object',
  required: ['nome', 'email', 'senha'],
  additionalProperties: false,
  properties: {
    nome:  { type: 'string', minLength: 1, maxLength: 120 },
    email: { type: 'string', format: 'email', maxLength: 254 },
    senha: { type: 'string', minLength: 8 },
  },
} as const

export const loginBodySchema = {
  type: 'object',
  required: ['email', 'senha'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email' },
    senha: { type: 'string', minLength: 1 },
  },
} as const

export const authResponseSchema = {
  type: 'object',
  properties: {
    token: { type: 'string' },
    usuario: {
      type: 'object',
      properties: {
        id:    { type: 'number' },
        nome:  { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
} as const
