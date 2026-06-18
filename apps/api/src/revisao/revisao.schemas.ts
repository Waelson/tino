export const revisaoQuerySchema = {
  type: 'object',
  properties: {
    semana: {
      type: 'string',
      pattern: '^\\d{4}-W(0[1-9]|[1-4]\\d|5[0-3])$',
      description: 'Semana ISO 8601, ex.: 2026-W25',
    },
  },
  additionalProperties: false,
} as const

export const narrativaBodySchema = {
  type: 'object',
  properties: {
    semana: {
      type: 'string',
      pattern: '^\\d{4}-W(0[1-9]|[1-4]\\d|5[0-3])$',
    },
  },
  additionalProperties: false,
} as const
