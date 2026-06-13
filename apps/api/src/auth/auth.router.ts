import type { FastifyInstance } from 'fastify'
import { findByEmail, criarUsuario } from './auth.repo.js'
import { hashSenha, verificarSenha, criarToken } from './auth.service.js'
import { registroBodySchema, loginBodySchema, authResponseSchema } from './auth.schemas.js'

export function authRoutes(fastify: FastifyInstance, _opts: unknown, done: () => void): void {
  // POST /auth/registro
  fastify.post(
    '/registro',
    {
      schema: {
        body: registroBodySchema,
        response: { 201: authResponseSchema },
      },
    },
    async (request, reply) => {
      const { nome, email, senha } = request.body as {
        nome: string
        email: string
        senha: string
      }

      const existente = await findByEmail(email)
      if (existente) {
        return reply.code(422).send({
          erro: 'EMAIL_EM_USO',
          mensagem: 'Este e-mail já está cadastrado.',
        })
      }

      const senhaHash = await hashSenha(senha)
      const id = await criarUsuario({ nome, email, senhaHash })
      const token = criarToken(fastify, id, email.toLowerCase().trim())

      return reply.code(201).send({
        token,
        usuario: { id: Number(id), nome: nome.trim(), email: email.toLowerCase().trim() },
      })
    },
  )

  // POST /auth/login
  fastify.post(
    '/login',
    {
      schema: {
        body: loginBodySchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request, reply) => {
      const { email, senha } = request.body as { email: string; senha: string }

      const usuario = await findByEmail(email)
      if (!usuario) {
        return reply.code(401).send({
          erro: 'CREDENCIAIS_INVALIDAS',
          mensagem: 'E-mail ou senha inválidos.',
        })
      }

      const senhaOk = await verificarSenha(senha, usuario.senha_hash)
      if (!senhaOk) {
        return reply.code(401).send({
          erro: 'CREDENCIAIS_INVALIDAS',
          mensagem: 'E-mail ou senha inválidos.',
        })
      }

      const token = criarToken(fastify, usuario.id, usuario.email)

      return reply.code(200).send({
        token,
        usuario: { id: Number(usuario.id), nome: usuario.nome, email: usuario.email },
      })
    },
  )

  done()
}
