import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE compromissos ADD COLUMN critica TINYINT(1) NOT NULL DEFAULT 0 AFTER status`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE compromissos DROP COLUMN critica`.execute(db)
}
