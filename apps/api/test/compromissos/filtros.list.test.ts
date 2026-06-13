/**
 * Testes de integração — GET /compromissos?filtro= (I-06, I-07)
 * Cobre: filtros comigo, delegadas, atencao, concluidas; A-26 (flags zeradas em concluídos);
 *        I-07 (triagem fora de todos os filtros); 400 para filtro inválido.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'filtros-list@test.dev'
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

async function inserir(params: {
  titulo: string
  tipo?: 'fazer' | 'delegada' | 'adiada' | null
  dono?: string | null
  status?: string
  prazo?: string | null
  checkpoint?: string | null
}) {
  await db.insertInto('compromissos').values({
    usuario_id: usuarioId,
    titulo: params.titulo,
    tipo: params.tipo ?? 'fazer',
    dono: params.dono ?? 'Eu',
    status: params.status ?? 'nao_iniciada',
    prazo: params.prazo ?? null,
    checkpoint: params.checkpoint ?? null,
  }).execute()
}

async function listar(filtro?: string) {
  const url = filtro ? `/compromissos?filtro=${filtro}` : '/compromissos'
  const res = await server.inject({
    method: 'GET', url,
    headers: { Authorization: `Bearer ${token}` },
  })
  return res
}

beforeAll(async () => {
  server = await buildServer()
  await server.ready()

  await limpar()

  const res = await server.inject({
    method: 'POST', url: '/auth/registro',
    payload: { nome: 'Filtros Test', email: EMAIL, senha: SENHA },
  })
  token = res.json<{ token: string }>().token
  const u = await db.selectFrom('usuarios').select('id').where('email', '=', EMAIL).executeTakeFirst()
  usuarioId = u!.id
})

afterAll(async () => {
  await limpar()
  await server.close()
})

type CompItem = {
  titulo: string; tipo: string | null; dono: string | null; status: string
  checkpointVencido: boolean; prazoEstourado: boolean; precisaAtencao: boolean
}

describe('GET /compromissos — filtros (I-06, I-07)', () => {
  it('?filtro=comigo → retorna somente itens com tipo=fazer OU dono=eu', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    const hj = hoje()
    await inserir({ titulo: 'Fazer Eu', tipo: 'fazer', dono: 'Eu' })
    await inserir({ titulo: 'Delegada Eu', tipo: 'delegada', dono: 'eu', prazo: addDias(hj, 10), checkpoint: addDias(hj, 5) })
    await inserir({ titulo: 'Delegada Marina', tipo: 'delegada', dono: 'Marina', prazo: addDias(hj, 10), checkpoint: addDias(hj, 5) })

    const res = await listar('comigo')
    expect(res.statusCode).toBe(200)
    const itens = res.json<{ itens: CompItem[] }>().itens
    expect(itens).toHaveLength(2)
    expect(itens.map((i) => i.titulo)).toEqual(expect.arrayContaining(['Fazer Eu', 'Delegada Eu']))
    expect(itens.some((i) => i.titulo === 'Delegada Marina')).toBe(false)
  })

  it('?filtro=delegadas → retorna somente tipo=delegada', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    const hj = hoje()
    await inserir({ titulo: 'Fazer', tipo: 'fazer', dono: 'Eu' })
    await inserir({ titulo: 'Delegada', tipo: 'delegada', dono: 'Ana', prazo: addDias(hj, 10), checkpoint: addDias(hj, 5) })

    const res = await listar('delegadas')
    expect(res.statusCode).toBe(200)
    const itens = res.json<{ itens: CompItem[] }>().itens
    expect(itens).toHaveLength(1)
    expect(itens[0].titulo).toBe('Delegada')
    expect(itens[0].tipo).toBe('delegada')
  })

  it('?filtro=atencao → retorna checkpoint_vencido OU prazo_estourado OU bloqueada; exclui concluídos', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    const hj = hoje()
    // checkpoint vencido
    await inserir({ titulo: 'Checkpoint vencido', tipo: 'delegada', dono: 'X', prazo: addDias(hj, 10), checkpoint: addDias(hj, -1) })
    // prazo estourado
    await inserir({ titulo: 'Prazo estourado', tipo: 'fazer', dono: 'Eu', prazo: addDias(hj, -1) })
    // bloqueada (sem datas)
    await inserir({ titulo: 'Bloqueada', tipo: 'fazer', dono: 'Eu', status: 'bloqueada' })
    // normal — NÃO deve aparecer
    await inserir({ titulo: 'Normal', tipo: 'fazer', dono: 'Eu', prazo: addDias(hj, 30) })
    // concluída com prazo passado — NÃO deve aparecer (A-25)
    await inserir({ titulo: 'Concluída', tipo: 'fazer', dono: 'Eu', status: 'concluida', prazo: addDias(hj, -1) })

    const res = await listar('atencao')
    expect(res.statusCode).toBe(200)
    const itens = res.json<{ itens: CompItem[] }>().itens
    const titulos = itens.map((i) => i.titulo)
    expect(titulos).toEqual(expect.arrayContaining(['Checkpoint vencido', 'Prazo estourado', 'Bloqueada']))
    expect(titulos).not.toContain('Normal')
    expect(titulos).not.toContain('Concluída')
  })

  it('?filtro=concluidas → retorna só status=concluida; flags zeradas (A-26)', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    const hj = hoje()
    await inserir({ titulo: 'Concluída passada', tipo: 'fazer', dono: 'Eu', status: 'concluida', prazo: addDias(hj, -10) })
    await inserir({ titulo: 'Ativa', tipo: 'fazer', dono: 'Eu', status: 'nao_iniciada' })

    const res = await listar('concluidas')
    expect(res.statusCode).toBe(200)
    const itens = res.json<{ itens: CompItem[] }>().itens
    expect(itens).toHaveLength(1)
    expect(itens[0].titulo).toBe('Concluída passada')
    // A-26: flags zeradas para concluídos
    expect(itens[0].checkpointVencido).toBe(false)
    expect(itens[0].prazoEstourado).toBe(false)
    expect(itens[0].precisaAtencao).toBe(false)
  })

  it('I-07 — item em triagem (tipo=null) NÃO aparece em nenhum filtro', async () => {
    await db.deleteFrom('compromissos').where('usuario_id', '=', usuarioId).execute()

    await db.insertInto('compromissos').values({
      usuario_id: usuarioId,
      titulo: 'Em triagem',
      tipo: null,
      status: 'nao_iniciada',
    }).execute()

    for (const filtro of ['ativas', 'comigo', 'delegadas', 'atencao', 'concluidas'] as const) {
      const res = await listar(filtro)
      expect(res.statusCode).toBe(200)
      const itens = res.json<{ itens: CompItem[] }>().itens
      expect(itens.some((i) => i.titulo === 'Em triagem')).toBe(false)
    }
  })

  it('?filtro=invalido → 400', async () => {
    const res = await listar('invalido')
    expect(res.statusCode).toBe(400)
  })
})
