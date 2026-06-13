import { execSync } from 'child_process'
import path from 'path'

export default async function globalSetup() {
  const root = path.resolve(__dirname, '../..')
  execSync('npm run seed --workspace=apps/api', {
    cwd: root,
    stdio: 'inherit',
  })
}
