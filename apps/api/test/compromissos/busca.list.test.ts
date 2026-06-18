/**
 * Testes de integração — GET /compromissos?q= (Feature 004)
 * Cobre: busca case-insensitive por substring no titulo; combinação com filtro;
 *        q vazio equivale a ausente; q sem match retorna lista vazia.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'busca-list@test.dev'
const SENHA = 'senha1234'

let server: FastifyInstance
let token: string
let usuarioId: bigint

async function limpar() {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
}

async function inserir(
  titulo: string,
  tipo: 'fazer' | 'delegada' = 'fazer',
  dono = 'Eu',
  status: 'nao_iniciada' | 'concluida' = 'nao_iniciada',
) {
  await db.insertInto('compromissos').values({
    usuario_id: usuarioId,
    titulo,
    tipo,
    dono,
    status,
    prazo: null,
    checkpoint: null,
  }).execute()
}

beforeAll(async () => {
  server = await buildServer()
  await server.ready()

  await limpar()

  const res = await server.inject({
    method: 'POST', url: '/auth/registro',
    payload: { nome: 'Busca Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  usuarioId = u!.id

  // Dados de teste
  await inserir('API de billing estável em produção', 'fazer')
  await inserir('Migração do banco legado concluída', 'fazer')
  await inserir('Revisão de arquitetura do time', 'delegada', 'Marina')
  await inserir('Deploy automatizado via CI/CD', 'fazer')
  await inserir('Billing legado desativado', 'fazer', 'Eu', 'concluida')
})

afterAll(async () => {
  await limpar()
  await server.close()
})

async function get(qs: string) {
  const res = await server.inject({
    method: 'GET', url: `/compromissos?${qs}`,
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json<{ itens: { titulo: string }[] }>()
}

describe('GET /compromissos?q= — busca por resultado esperado', () => {
  it('q=billing retorna apenas itens com "billing" no título', async () => {
    const { itens } = await get('q=billing')
    expect(itens.length).toBe(1)
    expect(itens[0]!.titulo).toContain('billing')
  })

  it('q=BILLING é case-insensitive', async () => {
    const { itens } = await get('q=BILLING')
    expect(itens.length).toBe(1)
    expect(itens[0]!.titulo.toLowerCase()).toContain('billing')
  })

  it('q= (vazio) retorna todos os itens do filtro', async () => {
    const semQ = await get('filtro=ativas')
    const comQVazio = await get('filtro=ativas&q=')
    expect(comQVazio.itens.length).toBe(semQ.itens.length)
  })

  it('q sem match retorna lista vazia', async () => {
    const { itens } = await get('q=xyz_inexistente_abc')
    expect(itens).toHaveLength(0)
  })

  it('q combinado com filtro=delegadas retorna intersecção', async () => {
    const { itens } = await get('filtro=delegadas&q=arquitetura')
    expect(itens.length).toBe(1)
    expect(itens[0]!.titulo).toContain('arquitetura')
  })

  it('q combinado com filtro onde não há match retorna vazio', async () => {
    const { itens } = await get('filtro=delegadas&q=billing')
    expect(itens).toHaveLength(0)
  })

  it('sem q — comportamento existente inalterado', async () => {
    const { itens } = await get('filtro=ativas')
    expect(itens.length).toBeGreaterThan(0)
  })

  it('401 — sem token', async () => {
    const res = await server.inject({ method: 'GET', url: '/compromissos?q=test' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /compromissos?filtro=todas — busca centralizada', () => {
  it('filtro=todas&q=billing retorna itens de qualquer status com "billing"', async () => {
    const { itens } = await get('filtro=todas&q=billing')
    expect(itens.length).toBe(2)
    for (const item of itens) {
      expect(item.titulo.toLowerCase()).toContain('billing')
    }
  })

  it('filtro=todas sem q retorna ativos e concluídos', async () => {
    const { itens: todas } = await get('filtro=todas')
    const { itens: ativas } = await get('filtro=ativas')
    const { itens: concluidas } = await get('filtro=concluidas')
    expect(todas.length).toBe(ativas.length + concluidas.length)
  })

  it('filtro=ativas não retorna itens concluídos', async () => {
    const { itens } = await get('filtro=ativas&q=billing')
    expect(itens.length).toBe(1)
    expect(itens[0]!.titulo).toContain('billing')
  })
})
