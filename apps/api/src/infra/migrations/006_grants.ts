/**
 * Migration 006 — GRANTs de segurança para o usuário radar_app.
 * Deve rodar com credenciais de admin (root em dev), pois exige GRANT OPTION.
 * Garante I-05 em três camadas:
 *   1. Aplicação: repositório append-only
 *   2. API: sem rotas PATCH/DELETE para registro_entradas
 *   3. Banco (esta migration): radar_app sem UPDATE/DELETE em registro_entradas
 */
import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Tabelas mutáveis: acesso completo
  await sql.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON radar.usuarios          TO 'radar_app'@'%'`).execute(db)
  await sql.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON radar.compromissos      TO 'radar_app'@'%'`).execute(db)
  await sql.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON radar.referencias       TO 'radar_app'@'%'`).execute(db)

  // I-05: registro_entradas é append-only — UPDATE e DELETE negados ao radar_app
  await sql.raw(`GRANT SELECT, INSERT                 ON radar.registro_entradas TO 'radar_app'@'%'`).execute(db)

  await sql.raw(`FLUSH PRIVILEGES`).execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Revoga todos os privilégios específicos de tabela (não remove o usuário)
  await sql.raw(`REVOKE ALL PRIVILEGES ON radar.usuarios          FROM 'radar_app'@'%'`).execute(db)
  await sql.raw(`REVOKE ALL PRIVILEGES ON radar.compromissos      FROM 'radar_app'@'%'`).execute(db)
  await sql.raw(`REVOKE ALL PRIVILEGES ON radar.referencias       FROM 'radar_app'@'%'`).execute(db)
  await sql.raw(`REVOKE ALL PRIVILEGES ON radar.registro_entradas FROM 'radar_app'@'%'`).execute(db)
  await sql.raw(`FLUSH PRIVILEGES`).execute(db)
}
