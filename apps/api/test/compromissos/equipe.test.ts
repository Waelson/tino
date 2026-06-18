/**
 * Testes de integração — GET /compromissos/equipe (Feature 008)
 * Cobre: contagem de ativos por dono, flags de vencimento, bloqueados,
 *        exclusão de concluídos, dono null/vazio, ordenação, 401.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'
import { hojeEmSP } from '../../src/compromissos/compromissos.service.js'

const EMAIL = 'equipe-test@test.dev'
const SENHA = 'senha1234'

let server: FastifyInstance
let token: string
let usuarioId: bigint

function addDias(base: string, dias: number): string {
  const d = new Date(base + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

async function limpar() {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
}

async function inserir(item: {
  titulo: string
  tipo: 'fazer' | 'delegada' | 'adiada'
  dono?: string | null
  status?: 'nao_iniciada' | 'em_andamento' | 'concluida' | 'bloqueada' | 'aguardando'
  prazo?: string | null
  checkpoint?: string | null
}) {
  await db.insertInto('compromissos').values({
    usuario_id: usuarioId,
    titulo: item.titulo,
    tipo: item.tipo,
    dono: item.dono ?? null,
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
    payload: { nome: 'Equipe Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  usuarioId = u!.id

  const hoje = hojeEmSP()

  // Marina — 3 ativos: 1 com checkpoint vencido, 1 normal, 1 normal
  await inserir({ titulo: 'Marina ativo 1', tipo: 'delegada', dono: 'Marina', checkpoint: addDias(hoje, -2) })
  await inserir({ titulo: 'Marina ativo 2', tipo: 'delegada', dono: 'Marina' })
  await inserir({ titulo: 'Marina ativo 3', tipo: 'delegada', dono: 'Marina' })
  // Marina — 1 concluído (não conta)
  await inserir({ titulo: 'Marina concluida', tipo: 'delegada', dono: 'Marina', status: 'concluida' })

  // Carlos — 1 ativo com prazo estourado
  await inserir({ titulo: 'Carlos ativo 1', tipo: 'delegada', dono: 'Carlos', prazo: addDias(hoje, -5) })

  // Ana — 1 ativo bloqueado
  await inserir({ titulo: 'Ana bloqueada', tipo: 'delegada', dono: 'Ana', status: 'bloqueada' })

  // Sem dono (não deve aparecer)
  await inserir({ titulo: 'Sem dono', tipo: 'fazer', dono: null })
  // Dono string vazia (não deve aparecer)
  await inserir({ titulo: 'Dono vazio', tipo: 'fazer', dono: '' })
})

afterAll(async () => {
  await limpar()
  await server.close()
})

async function getEquipe() {
  const res = await server.inject({
    method: 'GET', url: '/compromissos/equipe',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json<{ membros: { dono: string; ativos: number; checkpointsVencidos: number; prazosEstourados: number; bloqueados: number }[] }>()
}

describe('GET /compromissos/equipe (Feature 008)', () => {
  it('Marina aparece com ativos = 3', async () => {
    const { membros } = await getEquipe()
    const marina = membros.find((m) => m.dono === 'Marina')
    expect(marina).toBeDefined()
    expect(marina!.ativos).toBe(3)
  })

  it('item concluído de Marina não conta nos ativos', async () => {
    const { membros } = await getEquipe()
    const marina = membros.find((m) => m.dono === 'Marina')
    expect(marina!.ativos).toBe(3) // não é 4
  })

  it('Marina tem checkpointsVencidos ≥ 1', async () => {
    const { membros } = await getEquipe()
    const marina = membros.find((m) => m.dono === 'Marina')
    expect(marina!.checkpointsVencidos).toBeGreaterThanOrEqual(1)
  })

  it('Carlos aparece com prazosEstourados ≥ 1', async () => {
    const { membros } = await getEquipe()
    const carlos = membros.find((m) => m.dono === 'Carlos')
    expect(carlos).toBeDefined()
    expect(carlos!.prazosEstourados).toBeGreaterThanOrEqual(1)
  })

  it('Ana aparece com bloqueados = 1', async () => {
    const { membros } = await getEquipe()
    const ana = membros.find((m) => m.dono === 'Ana')
    expect(ana).toBeDefined()
    expect(ana!.bloqueados).toBe(1)
  })

  it('dono = null não aparece', async () => {
    const { membros } = await getEquipe()
    expect(membros.some((m) => m.dono === null)).toBe(false)
  })

  it('dono = string vazia não aparece', async () => {
    const { membros } = await getEquipe()
    expect(membros.some((m) => m.dono === '')).toBe(false)
  })

  it('ordenação: Marina (3 ativos) aparece antes de Carlos (1 ativo)', async () => {
    const { membros } = await getEquipe()
    const idxMarina = membros.findIndex((m) => m.dono === 'Marina')
    const idxCarlos = membros.findIndex((m) => m.dono === 'Carlos')
    expect(idxMarina).toBeLessThan(idxCarlos)
  })

  it('usuário sem delegações retorna membros = []', async () => {
    // Cria usuário sem compromissos delegados
    const r = await server.inject({
      method: 'POST', url: '/auth/registro',
      payload: { nome: 'Vazio', email: 'equipe-vazio@test.dev', senha: 'senha1234' },
    })
    const t2 = r.json<{ token: string }>().token

    const res2 = await server.inject({
      method: 'GET', url: '/compromissos/equipe',
      headers: { Authorization: `Bearer ${t2}` },
    })
    const { membros } = res2.json<{ membros: unknown[] }>()
    expect(membros).toHaveLength(0)

    // limpeza
    const u2 = await db.selectFrom('usuarios').select('id').where('email', '=', 'equipe-vazio@test.dev').executeTakeFirst()
    if (u2) await db.deleteFrom('usuarios').where('id', '=', u2.id).execute()
  })

  it('401 — sem token', async () => {
    const res = await server.inject({ method: 'GET', url: '/compromissos/equipe' })
    expect(res.statusCode).toBe(401)
  })
})
