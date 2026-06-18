/**
 * Testes de integração — GET /compromissos?dono= (Feature 006)
 * Cobre: filtro por dono case-insensitive, todos os status, exclusão de outros
 *        donos, combinação com ?q=, dono vazio equivale a sem filtro, 401.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'dono-filter@test.dev'
const SENHA = 'senha1234'

let server: FastifyInstance
let token: string
let usuarioId: bigint

async function limpar() {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
}

type ItemInsert = {
  titulo: string
  tipo: 'fazer' | 'delegada' | 'adiada'
  dono: string
  status?: 'nao_iniciada' | 'concluida'
  prazo?: string
  checkpoint?: string
}

async function inserir(item: ItemInsert) {
  await db.insertInto('compromissos').values({
    usuario_id: usuarioId,
    titulo: item.titulo,
    tipo: item.tipo,
    dono: item.dono,
    status: item.status ?? 'nao_iniciada',
    prazo: item.prazo ?? null,
    checkpoint: item.checkpoint ?? null,
  }).execute()
}

beforeAll(async () => {
  server = await buildServer()
  await server.ready()

  await limpar()

  const res = await server.inject({
    method: 'POST', url: '/auth/registro',
    payload: { nome: 'Dono Filter Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  usuarioId = u!.id

  // Dados de teste
  await inserir({ titulo: 'API de billing estável',     tipo: 'delegada', dono: 'Marina', prazo: '2026-12-01', checkpoint: '2026-11-15' })
  await inserir({ titulo: 'Migração do banco legado',   tipo: 'delegada', dono: 'Marina', prazo: '2026-11-01', checkpoint: '2026-10-15', status: 'concluida' })
  await inserir({ titulo: 'Deploy via CI/CD',           tipo: 'delegada', dono: 'Carlos', prazo: '2026-12-01', checkpoint: '2026-11-15' })
  await inserir({ titulo: 'Revisão de arquitetura api', tipo: 'delegada', dono: 'Marina', prazo: '2026-12-15', checkpoint: '2026-12-01' })
  await inserir({ titulo: 'Documentação interna',       tipo: 'fazer',    dono: 'Eu' })
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
  return res.json<{ itens: { titulo: string; dono: string | null; status: string }[] }>()
}

describe('GET /compromissos?dono= — filtro por dono (Feature 006)', () => {
  it('?dono=Marina retorna apenas itens de Marina', async () => {
    const { itens } = await get('dono=Marina')
    expect(itens.length).toBe(3)
    for (const item of itens) {
      expect(item.dono?.toLowerCase()).toBe('marina')
    }
  })

  it('?dono=marina é case-insensitive', async () => {
    const { itens: comMaiuscula } = await get('dono=Marina')
    const { itens: semMaiuscula } = await get('dono=marina')
    expect(semMaiuscula.length).toBe(comMaiuscula.length)
  })

  it('?dono=Marina inclui compromissos concluídos', async () => {
    const { itens } = await get('dono=Marina')
    const concluidos = itens.filter((i) => i.status === 'concluida')
    expect(concluidos.length).toBeGreaterThan(0)
  })

  it('?dono=Marina não retorna itens de Carlos', async () => {
    const { itens } = await get('dono=Marina')
    expect(itens.some((i) => i.dono === 'Carlos')).toBe(false)
  })

  it('?dono=Carlos retorna apenas itens de Carlos', async () => {
    const { itens } = await get('dono=Carlos')
    expect(itens.length).toBe(1)
    expect(itens[0]!.dono).toBe('Carlos')
  })

  it('?dono=Marina&q=api retorna intersecção', async () => {
    const { itens } = await get('dono=Marina&q=api')
    expect(itens.length).toBeGreaterThan(0)
    for (const item of itens) {
      expect(item.dono?.toLowerCase()).toBe('marina')
      expect(item.titulo.toLowerCase()).toContain('api')
    }
  })

  it('?dono= (vazio) não aplica filtro de dono', async () => {
    const semDono = await get('filtro=ativas')
    const comDonoVazio = await get('filtro=ativas&dono=')
    expect(comDonoVazio.itens.length).toBe(semDono.itens.length)
  })

  it('?dono=Ninguem sem match retorna lista vazia', async () => {
    const { itens } = await get('dono=Ninguem')
    expect(itens).toHaveLength(0)
  })

  it('401 — sem token', async () => {
    const res = await server.inject({ method: 'GET', url: '/compromissos?dono=Marina' })
    expect(res.statusCode).toBe(401)
  })
})
