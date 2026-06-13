import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'

const BCRYPT_COST = 12

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, BCRYPT_COST)
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

export function criarToken(
  fastify: FastifyInstance,
  usuarioId: bigint,
  email: string,
): string {
  // JWT com exp de 7 dias; @fastify/jwt assina com o secret configurado
  return fastify.jwt.sign(
    { sub: String(usuarioId), email },
    { expiresIn: '7d' },
  )
}
