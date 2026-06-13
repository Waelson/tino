/**
 * Testes de integração — GET /metricas (I-06, I-07, I-10, I-11)
 * Cobre: A-21 (zero ativos), A-22 (limiar 30%), A-25 (concluído fora das métricas),
 *        A-27 (fronteira do dia — I-10: hoje parametrizado no fuso do usuário),
 *        I-07 (triagem fora das métricas), precisamAtencao distinto.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'i06-metricas@test.dev'
const SENHA = 'senha1234'

let server: FastifyInstance
let token: string
let usuarioId: bigint

function addDias(base: string, dias: number): string {
  const d = new Date(base + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function hoje(): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

async function limpar() {
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
  await db.deleteFrom('usuarios').where('email', '=', EMAIL).execute()
}

async function criarAtivo(params: {
  titulo?: string
  tipo?: 'fazer' | 'delegada' | 'adiada'
  dono?: string
  status?: string
  prazo?: string | null
  checkpoint?: string | null
}) {
  await db.insertInto('compromissos').values({
    usuario_id: usuarioId,
    titulo: params.titulo ?? 'Compromisso teste',
    tipo: params.tipo ?? 'fazer',
    dono: params.dono ?? 'Eu',
    status: params.status ?? 'nao_iniciada',
    prazo: params.prazo ?? null,
    checkpoint: params.checkpoint ?? null,
  }).execute()
}

beforeAll(async () => {
  server = await buildServer()
  await server.ready()

  await limpar()

  const res = await server.inject({
    method: 'POST', url: '/auth/registro',
    payload: { nome: 'I06 Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  usuarioId = u!.id
})

afterAll(async () => {
  await limpar()
  await server.close()
})

async function getMetricas() {
  const res = await server.inject({
    method: 'GET', url: '/metricas',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json<{
    ativos: number; checkpointsVencidos: number; prazosEstourados: number
    comigo: number; carga: number; alertaCarga: boolean
    aguardandoTriagem: number; precisamAtencao: number
  }>()
}

describe('GET /metricas — I-06, I-07, I-11', () => {
  it('A-21 — zero ativos → carga 0, alertaCarga false, ativos 0', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    const m = await getMetricas()
    expect(m.ativos).toBe(0)
    expect(m.carga).toBe(0)
    expect(m.alertaCarga).toBe(false)
    expect(m.checkpointsVencidos).toBe(0)
    expect(m.prazosEstourados).toBe(0)
    expect(m.precisamAtencao).toBe(0)
  })

  it('A-22 — 10 ativos, 3 comigo → carga 30, alertaCarga false (limiar estrito)', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    // 3 itens "comigo" (fazer/dono=Eu)
    for (let i = 0; i < 3; i++) {
      await criarAtivo({ tipo: 'fazer', dono: 'Eu' })
    }
    // 7 itens delegados (não comigo)
    for (let i = 0; i < 7; i++) {
      await criarAtivo({ tipo: 'delegada', dono: 'Marina', prazo: addDias(hoje(), 10), checkpoint: addDias(hoje(), 5) })
    }

    const m = await getMetricas()
    expect(m.ativos).toBe(10)
    expect(m.comigo).toBe(3)
    expect(m.carga).toBe(30)
    expect(m.alertaCarga).toBe(false)
  })

  it('A-22 — 13 ativos, 4 comigo → carga 31, alertaCarga true', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    for (let i = 0; i < 4; i++) {
      await criarAtivo({ tipo: 'fazer', dono: 'Eu' })
    }
    for (let i = 0; i < 9; i++) {
      await criarAtivo({ tipo: 'delegada', dono: 'Carlos', prazo: addDias(hoje(), 10), checkpoint: addDias(hoje(), 5) })
    }

    const m = await getMetricas()
    expect(m.ativos).toBe(13)
    expect(m.comigo).toBe(4)
    expect(m.carga).toBe(31)
    expect(m.alertaCarga).toBe(true)
  })

  it('I-07 — item em triagem não conta em ativos; aparece em aguardandoTriagem', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    // 1 item em triagem (tipo=null)
    await db.insertInto('compromissos').values({
      usuario_id: usuarioId,
      titulo: 'Aguarda triagem',
      tipo: null,
      status: 'nao_iniciada',
    }).execute()

    const m = await getMetricas()
    expect(m.ativos).toBe(0)
    expect(m.aguardandoTriagem).toBe(1)
    expect(m.precisamAtencao).toBe(0)
  })

  it('A-25 — item concluído não conta em ativos nem em precisamAtencao', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    // Concluído com prazo passado — NÃO deve contar em ativos nem precisamAtencao
    await criarAtivo({ tipo: 'fazer', dono: 'Eu', status: 'concluida', prazo: addDias(hoje(), -5) })

    const m = await getMetricas()
    expect(m.ativos).toBe(0)
    expect(m.prazosEstourados).toBe(0)
    expect(m.precisamAtencao).toBe(0)
  })

  it('A-27 / I-10 — checkpoint = hoje → NÃO vencido; checkpoint = ontem → vencido (hoje parametrizado no fuso)', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    const hj = hoje()
    // Item com checkpoint = hoje (não vencido: comparação estrita < hoje)
    await criarAtivo({
      tipo: 'delegada', dono: 'Ana', status: 'nao_iniciada',
      prazo: addDias(hj, 10), checkpoint: hj,
    })

    let m = await getMetricas()
    expect(m.checkpointsVencidos).toBe(0)

    // Substitui por checkpoint = ontem (vencido)
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()
    await criarAtivo({
      tipo: 'delegada', dono: 'Ana', status: 'nao_iniciada',
      prazo: addDias(hj, 10), checkpoint: addDias(hj, -1),
    })

    m = await getMetricas()
    expect(m.checkpointsVencidos).toBe(1)
  })

  it('precisamAtencao distinto — item bloqueado + prazo passado conta 1× (não 2×)', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    // Item com status=bloqueada E prazo vencido — deve contar como 1 (não 2)
    await criarAtivo({
      tipo: 'fazer', dono: 'Eu', status: 'bloqueada',
      prazo: addDias(hoje(), -2),
    })

    const m = await getMetricas()
    expect(m.ativos).toBe(1)
    expect(m.precisamAtencao).toBe(1)
  })

  it('401 — sem token', async () => {
    const res = await server.inject({ method: 'GET', url: '/metricas' })
    expect(res.statusCode).toBe(401)
  })
})
