import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS compromissos (
      id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      usuario_id     BIGINT UNSIGNED NOT NULL,
      titulo         VARCHAR(280)    NOT NULL,
      dono           VARCHAR(80)     NULL,
      tipo           VARCHAR(10)     NULL,
      prazo          DATE            NULL,
      checkpoint     DATE            NULL,
      status         VARCHAR(15)     NOT NULL DEFAULT 'nao_iniciada',
      descartada_em  DATETIME(3)     NULL,
      criada_em      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      atualizada_em  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                     ON UPDATE CURRENT_TIMESTAMP(3),

      CONSTRAINT fk_compromissos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id),

      CONSTRAINT ck_compromissos_tipo
        CHECK (tipo IN ('fazer','delegada','adiada')),

      CONSTRAINT ck_compromissos_status
        CHECK (status IN ('nao_iniciada','em_andamento','bloqueada','aguardando','concluida')),

      CONSTRAINT ck_compromissos_titulo
        CHECK (CHAR_LENGTH(TRIM(titulo)) > 0),

      CONSTRAINT ck_compromissos_checkpoint_antes_prazo
        CHECK (checkpoint IS NULL OR prazo IS NULL OR checkpoint < prazo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('compromissos').ifExists().execute()
}
