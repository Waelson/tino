import { defineConfig } from 'vitest/config'
import { config as loadDotenv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Carrega .env antes que qualquer módulo de teste importe src/infra/config.ts
const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: path.resolve(__dirname, '../../.env') })

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/infra/migrations/**', 'src/infra/seed.ts', 'src/infra/migrate.ts'],
    },
    // Testes de integração precisam do banco — rodar com `docker compose up -d && npm run migrate`
    include: ['test/**/*.test.ts'],
  },
})
