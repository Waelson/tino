// Schema JSON Schema para validação pelo Fastify — PATCH /compromissos/:id
// Invariantes condicionais (I-01…I-04) são verificadas na camada de serviço.

export const patchBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    titulo:     { type: 'string' },
    dono:       { type: ['string', 'null'] },
    prazo:      { type: ['string', 'null'] },
    checkpoint: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: ['nao_iniciada', 'em_andamento', 'bloqueada', 'aguardando', 'concluida'],
    },
    tipo: {
      type: 'string',
      enum: ['fazer', 'delegada', 'adiada'],
    },
    critica: { type: 'boolean' },
  },
} as const
