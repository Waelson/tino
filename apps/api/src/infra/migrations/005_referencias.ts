import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS referencias (
      id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      compromisso_id  BIGINT UNSIGNED NOT NULL,
      descricao       VARCHAR(140)    NULL,
      url             VARCHAR(2048)   NOT NULL,
      criada_em       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

      CONSTRAINT fk_referencias_compromisso
        FOREIGN KEY (compromisso_id) REFERENCES compromissos (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db)

  // idx_ref_comp criado aqui (após a tabela existir)
  await sql.raw('CREATE INDEX idx_ref_comp ON referencias (compromisso_id)').execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql.raw('DROP INDEX idx_ref_comp ON referencias').execute(db)
  await db.schema.dropTable('referencias').ifExists().execute()
}
