// Schemas JSON Schema para validação pelo Fastify

export const capturaBodySchema = {
  type: 'object',
  required: ['titulo'],
  additionalProperties: false,
  properties: {
    titulo: { type: 'string' },
  },
} as const

export const filtroQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    filtro: { type: 'string', enum: ['ativas', 'comigo', 'delegadas', 'atencao', 'concluidas', 'todas', 'semana'] },
    q:     { type: 'string', maxLength: 280 },
    dono:  { type: 'string', maxLength: 80 },
  },
} as const
