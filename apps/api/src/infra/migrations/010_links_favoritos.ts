import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE links_favoritos (
      id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      usuario_id    BIGINT UNSIGNED NOT NULL,
      nome          VARCHAR(120)    NOT NULL,
      url           TEXT            NOT NULL,
      descricao     VARCHAR(280)    NULL,
      categoria     VARCHAR(80)     NULL,
      cliques       INT UNSIGNED    NOT NULL DEFAULT 0,
      criada_em     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      atualizada_em DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      CONSTRAINT fk_lf_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE links_favoritos`.execute(db)
}
