import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS revisao_narrativas (
      id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      usuario_id    BIGINT UNSIGNED NOT NULL,
      semana        CHAR(8)         NOT NULL,
      narrativa     TEXT            NOT NULL,
      sugestoes     JSON            NOT NULL,
      modelo_usado  VARCHAR(50)     NOT NULL,
      gerado_em     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

      UNIQUE KEY uq_usuario_semana (usuario_id, semana),
      CONSTRAINT fk_rn_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('revisao_narrativas').ifExists().execute()
}
