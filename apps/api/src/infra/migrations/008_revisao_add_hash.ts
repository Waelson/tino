import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE revisao_narrativas
      ADD COLUMN dados_hash VARCHAR(64) NULL AFTER modelo_usado
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE revisao_narrativas
      DROP COLUMN dados_hash
  `.execute(db)
}
