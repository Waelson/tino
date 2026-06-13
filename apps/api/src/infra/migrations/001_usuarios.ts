import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('usuarios')
    .ifNotExists()
    .addColumn('id', 'bigint', (col) => col.unsigned().autoIncrement().primaryKey())
    .addColumn('email', 'varchar(254)', (col) => col.notNull())
    .addColumn('nome', 'varchar(120)', (col) => col.notNull())
    .addColumn('senha_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('criada_em', sql`DATETIME(3)`, (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3)`),
    )
    .addColumn('atualizada_em', sql`DATETIME(3)`, (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
    )
    .modifyEnd(sql`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`)
    .execute()

  await db.schema
    .alterTable('usuarios')
    .addUniqueConstraint('uq_usuarios_email', ['email'])
    .execute()
    .catch(() => {
      // constraint já existe — ignorar
    })
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('usuarios').ifExists().execute()
}
