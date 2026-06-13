import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS registro_entradas (
      id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      compromisso_id  BIGINT UNSIGNED NOT NULL,
      data            DATE            NOT NULL,
      texto           VARCHAR(2000)   NOT NULL,
      origem          VARCHAR(10)     NOT NULL,
      criada_em       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

      CONSTRAINT fk_registro_compromisso
        FOREIGN KEY (compromisso_id) REFERENCES compromissos (id)
        ON DELETE CASCADE,

      CONSTRAINT ck_registro_origem CHECK (origem IN ('usuario','sistema')),
      CONSTRAINT ck_registro_texto  CHECK (CHAR_LENGTH(TRIM(texto)) > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db)
  // Nota: GRANTs de imutabilidade (I-05) estão em docker/init.sql
  // e são aplicados no primeiro start do container.
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('registro_entradas').ifExists().execute()
}
