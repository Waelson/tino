import { db } from '../infra/db.js'
import type { Usuario } from '../infra/db.js'

export async function findByEmail(email: string): Promise<Usuario | undefined> {
  return db
    .selectFrom('usuarios')
    .selectAll()
    .where('email', '=', email.toLowerCase().trim())
    .executeTakeFirst()
}

export async function criarUsuario(dados: {
  nome: string
  email: string
  senhaHash: string
}): Promise<bigint> {
  const result = await db
    .insertInto('usuarios')
    .values({
      nome: dados.nome.trim(),
      email: dados.email.toLowerCase().trim(),
      senha_hash: dados.senhaHash,
    })
    .executeTakeFirstOrThrow()

  return result.insertId as bigint
}
