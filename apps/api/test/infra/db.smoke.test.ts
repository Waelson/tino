/**
 * Smoke test de infraestrutura — gate da Etapa 1.
 * Confirma que a conexão com o banco está funcionando e as tabelas existem.
 * Requer o banco rodando: docker compose up -d && npm run migrate
 */
import { describe, expect, it } from 'vitest'
import { db } from '../../src/infra/db.js'

describe('infra/db', () => {

  it('conecta ao banco e lê tabela usuarios', async () => {
    const rows = await db.selectFrom('usuarios').selectAll().execute()
    expect(Array.isArray(rows)).toBe(true)
  })

  it('tabela compromissos existe e é acessível', async () => {
    const rows = await db.selectFrom('compromissos').selectAll().limit(1).execute()
    expect(Array.isArray(rows)).toBe(true)
  })

  it('tabela registro_entradas existe e é acessível', async () => {
    const rows = await db.selectFrom('registro_entradas').selectAll().limit(1).execute()
    expect(Array.isArray(rows)).toBe(true)
  })

  it('tabela referencias existe e é acessível', async () => {
    const rows = await db.selectFrom('referencias').selectAll().limit(1).execute()
    expect(Array.isArray(rows)).toBe(true)
  })
})
