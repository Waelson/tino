/**
 * Script de migrations — usa credenciais de admin (DB_MIGRATE_USER / DB_MIGRATE_PASSWORD),
 * pois o Kysely Migrator precisa de CREATE para suas tabelas de controle interno.
 * O usuário radar_app (runtime da aplicação) tem apenas SELECT/INSERT em registro_entradas.
 * Em desenvolvimento, DB_MIGRATE_USER=root por padrão.
 */
import { FileMigrationProvider, Kysely, Migrator, MysqlDialect } from 'kysely'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool } from 'mysql2'
import { config } from './config.js'
import type { Database } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Conexão privilegiada para migrations (root em dev, DBA em prod)
const migrateDb = new Kysely<Database>({
  dialect: new MysqlDialect({
    pool: createPool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      user: process.env['DB_MIGRATE_USER'] ?? 'root',
      password: process.env['DB_MIGRATE_PASSWORD'] ?? process.env['DB_ROOT_PASSWORD'] ?? '',
      timezone: '+00:00',
    }),
  }),
})

const migrator = new Migrator({
  db: migrateDb,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(__dirname, 'migrations'),
  }),
})

const { error, results } = await migrator.migrateToLatest()

for (const result of results ?? []) {
  if (result.status === 'Success') {
    console.log(`✓ migration "${result.migrationName}" aplicada`)
  } else if (result.status === 'Error') {
    console.error(`✗ migration "${result.migrationName}" falhou`)
  }
}

if (error) {
  console.error('Erro durante migrations:', error)
  process.exit(1)
}

console.log('Migrations concluídas.')
await migrateDb.destroy()
