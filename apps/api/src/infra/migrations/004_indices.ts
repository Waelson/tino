import type { Kysely } from 'kysely'
import { sql } from 'kysely'

// MySQL 8 não suporta CREATE INDEX IF NOT EXISTS.
// As migrations do Kysely são idempotentes por controle de versão — cada
// migration roda exatamente uma vez, portanto os índices não existirão ainda.
async function createIndex(
  db: Kysely<unknown>,
  name: string,
  table: string,
  columns: string,
): Promise<void> {
  await sql.raw(`CREATE INDEX ${name} ON ${table} (${columns})`).execute(db)
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await createIndex(db, 'idx_comp_listagem', 'compromissos', 'usuario_id, descartada_em, tipo, status')
  await createIndex(db, 'idx_comp_prazo', 'compromissos', 'usuario_id, prazo')
  await createIndex(db, 'idx_comp_checkpoint', 'compromissos', 'usuario_id, checkpoint')
  await createIndex(db, 'idx_reg_comp_data', 'registro_entradas', 'compromisso_id, data, id')
  // idx_ref_comp está na migration 005 (após criação da tabela referencias)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql.raw('DROP INDEX idx_comp_listagem   ON compromissos').execute(db)
  await sql.raw('DROP INDEX idx_comp_prazo      ON compromissos').execute(db)
  await sql.raw('DROP INDEX idx_comp_checkpoint ON compromissos').execute(db)
  await sql.raw('DROP INDEX idx_reg_comp_data   ON registro_entradas').execute(db)
}
