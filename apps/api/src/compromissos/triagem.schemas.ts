// Schema JSON Schema para validação pelo Fastify — POST /:id/triagem
// Invariantes condicionais (I-02, I-04) são verificadas na camada de serviço.

export const triagemBodySchema = {
  type: 'object',
  required: ['decisao'],
  additionalProperties: false,
  properties: {
    decisao:    { type: 'string', enum: ['fazer', 'delegar', 'adiar', 'descartar'] },
    dono:       { type: 'string' },
    prazo:      { type: 'string' },
    checkpoint: { type: 'string' },
  },
} as const
