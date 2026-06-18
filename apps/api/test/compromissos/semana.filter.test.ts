/**
 * Testes de integração — GET /compromissos?filtro=semana (Feature 007)
 * Cobre: prazo dentro de 7 dias, prazo no limite (dia 7), prazo no dia 8 excluído,
 *        checkpoint dentro de 7 dias, em_andamento sem prazo, concluída excluída,
 *        prazo vencido incluso, nao_iniciada sem prazo excluída, 401.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'
import { hojeEmSP } from '../../src/compromissos/compromissos.service.js'

const EMAIL = 'semana-filter@test.dev'
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
  status?: 'nao_iniciada' | 'em_andamento' | 'concluida' | 'bloqueada' | 'aguardando'
  prazo?: string | null
  checkpoint?: string | null
}) {
  await db.insertInto('compromissos').values({
    usuario_id: usuarioId,
    titulo: item.titulo,
    tipo: item.tipo,
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
    payload: { nome: 'Semana Filter Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  usuarioId = u!.id

  const hoje = hojeEmSP()

  await inserir({ titulo: 'Prazo em 3 dias',        tipo: 'fazer',    prazo: addDias(hoje, 3) })
  await inserir({ titulo: 'Prazo exato dia 7',       tipo: 'fazer',    prazo: addDias(hoje, 7) })
  await inserir({ titulo: 'Prazo no dia 8',          tipo: 'fazer',    prazo: addDias(hoje, 8) })
  await inserir({ titulo: 'Checkpoint em 2 dias',    tipo: 'delegada', checkpoint: addDias(hoje, 2) })
  await inserir({ titulo: 'Em andamento sem prazo',  tipo: 'fazer',    status: 'em_andamento' })
  await inserir({ titulo: 'Concluída com prazo',     tipo: 'fazer',    prazo: addDias(hoje, 2), status: 'concluida' })
  await inserir({ titulo: 'Prazo vencido ontem',     tipo: 'fazer',    prazo: addDias(hoje, -1) })
  await inserir({ titulo: 'Sem prazo nao_iniciada',  tipo: 'fazer' })
})

afterAll(async () => {
  await limpar()
  await server.close()
})

async function getSemana() {
  const res = await server.inject({
    method: 'GET', url: '/compromissos?filtro=semana',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json<{ itens: { titulo: string; status: string; prazo: string | null }[] }>()
}

describe('GET /compromissos?filtro=semana (Feature 007)', () => {
  it('item com prazo = hoje + 3 aparece', async () => {
    const { itens } = await getSemana()
    expect(itens.some((i) => i.titulo === 'Prazo em 3 dias')).toBe(true)
  })

  it('item com prazo = hoje + 7 aparece (limite inclusivo)', async () => {
    const { itens } = await getSemana()
    expect(itens.some((i) => i.titulo === 'Prazo exato dia 7')).toBe(true)
  })

  it('item com prazo = hoje + 8 não aparece', async () => {
    const { itens } = await getSemana()
    expect(itens.some((i) => i.titulo === 'Prazo no dia 8')).toBe(false)
  })

  it('item com checkpoint = hoje + 2 aparece', async () => {
    const { itens } = await getSemana()
    expect(itens.some((i) => i.titulo === 'Checkpoint em 2 dias')).toBe(true)
  })

  it('item com status em_andamento sem prazo aparece', async () => {
    const { itens } = await getSemana()
    expect(itens.some((i) => i.titulo === 'Em andamento sem prazo')).toBe(true)
  })

  it('item concluído não aparece', async () => {
    const { itens } = await getSemana()
    expect(itens.some((i) => i.titulo === 'Concluída com prazo')).toBe(false)
  })

  it('item com prazo vencido ontem aparece', async () => {
    const { itens } = await getSemana()
    expect(itens.some((i) => i.titulo === 'Prazo vencido ontem')).toBe(true)
  })

  it('item nao_iniciada sem prazo próximo não aparece', async () => {
    const { itens } = await getSemana()
    expect(itens.some((i) => i.titulo === 'Sem prazo nao_iniciada')).toBe(false)
  })

  it('401 — sem token', async () => {
    const res = await server.inject({ method: 'GET', url: '/compromissos?filtro=semana' })
    expect(res.statusCode).toBe(401)
  })
})
