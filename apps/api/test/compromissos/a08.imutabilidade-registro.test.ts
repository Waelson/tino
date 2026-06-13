/**
 * Teste de integração — A-08 (I-05): registro_entradas é imutável.
 * O usuário radar_app não possui GRANT de UPDATE ou DELETE na tabela.
 */
import { describe, expect, it } from 'vitest'
import { db } from '../../src/infra/db.js'

describe('A-08 — imutabilidade do registro (I-05)', () => {
  it('UPDATE em registro_entradas falha por falta de privilégio', async () => {
    await expect(
      // eslint-disable-next-line no-restricted-syntax
      db
        .updateTable('registro_entradas')
        .set({ texto: 'adulterado' })
        .where('id', '=', BigInt(1))
        .execute(),
    ).rejects.toThrow()
  })

  it('DELETE em registro_entradas falha por falta de privilégio', async () => {
    await expect(
      // eslint-disable-next-line no-restricted-syntax
      db
        .deleteFrom('registro_entradas')
        .where('id', '=', BigInt(1))
        .execute(),
    ).rejects.toThrow()
  })
})
