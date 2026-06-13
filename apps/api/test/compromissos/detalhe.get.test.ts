/**
 * Teste de integração — GET /compromissos/:id (etapa 1 feature 002)
 * Cobre: happy path, referencias, 404 inexistente, 404 outro usuário,
 * 404 descartado (I-09), 401 sem token.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../../src/server.js'
import { db } from '../../src/infra/db.js'

const EMAIL = 'detalhe-get@comp-test.dev'
const EMAIL2 = 'detalhe-get-outro@comp-test.dev'
const SENHA = 'senha1234'

let server: FastifyInstance
let token: string
let token2: string
let compId: number
let compDescartadoId: number

beforeAll(async () => {
  server = await buildServer()
  await server.ready()

  // Limpar dados anteriores
  for (const email of [EMAIL, EMAIL2]) {
    const u = await db.selectFrom('usuarios').select('id').where('email', '=', email).executeTakeFirst()
    if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
    await db.deleteFrom('usuarios').where('email', '=', email).execute()
  }

  // Usuário principal
  const res1 = await server.inject({
    method: 'POST', url: '/auth/registro',
    payload: { nome: 'Detalhe Get', email: EMAIL, senha: SENHA },
  })
  token = res1.json<{ token: string }>().token

  // Usuário secundário (teste de isolamento)
  const res2 = await server.inject({
    method: 'POST', url: '/auth/registro',
    payload: { nome: 'Detalhe Outro', email: EMAIL2, senha: SENHA },
  })
  token2 = res2.json<{ token: string }>().token

  // Capturar compromisso principal e triar (para ter registro)
  const capRes = await server.inject({
    method: 'POST', url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso para detalhe' },
  })
  compId = capRes.json<{ id: number }>().id

  // Inserir referência diretamente no banco
  await db.insertInto('referencias').values({
    compromisso_id: BigInt(compId),
    descricao: 'Documentação',
    url: 'https://exemplo.com/doc',
  }).execute()

  // Capturar e descartar outro compromisso
  const capDesc = await server.inject({
    method: 'POST', url: '/compromissos',
    headers: { Authorization: `Bearer ${token}` },
    payload: { titulo: 'Compromisso para descartar' },
  })
  compDescartadoId = capDesc.json<{ id: number }>().id
  await db.updateTable('compromissos')
    .set({ descartada_em: new Date() })
    .where('id', '=', BigInt(compDescartadoId))
    .execute()
})

afterAll(async () => {
  for (const email of [EMAIL, EMAIL2]) {
    const u = await db.selectFrom('usuarios').select('id').where('email', '=', email).executeTakeFirst()
    if (u) await db.deleteFrom('compromissos').where('usuario_id', '=', u.id).execute()
    await db.deleteFrom('usuarios').where('email', '=', email).execute()
  }
  await server.close()
})

describe('GET /compromissos/:id', () => {
  it('200 — retorna CompromissoDetalhe com campos base, referencias e registro', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{
      id: number
      titulo: string
      referencias: Array<{ id: number; url: string; descricao: string | null; criadaEm: string }>
      registro: Array<{ id: number; data: string; origem: string; texto: string }>
    }>()
    expect(body.id).toBe(compId)
    expect(body.titulo).toBe('Compromisso para detalhe')
    // Campos derivados presentes
    expect(body).toHaveProperty('checkpointVencido')
    expect(body).toHaveProperty('prazoEstourado')
    expect(body).toHaveProperty('comigo')
    // Referência inserida aparece
    expect(body.referencias).toHaveLength(1)
    expect(body.referencias[0].url).toBe('https://exemplo.com/doc')
    expect(body.referencias[0].descricao).toBe('Documentação')
    // Registro tem pelo menos a entrada "Capturada."
    expect(body.registro.length).toBeGreaterThanOrEqual(1)
    expect(body.registro.some((r) => r.texto === 'Capturada.')).toBe(true)
  })

  it('200 — registro ordenado do mais recente para o mais antigo', async () => {
    // Inserir segunda entrada com data anterior
    await db.insertInto('registro_entradas').values({
      compromisso_id: BigInt(compId),
      data: '2020-01-01',
      texto: 'Entrada antiga.',
      origem: 'sistema',
    }).execute()

    const res = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = res.json<{ registro: Array<{ data: string; texto: string }> }>()
    // Primeira entrada deve ser mais recente (data maior)
    const datas = body.registro.map((r) => r.data)
    for (let i = 1; i < datas.length; i++) {
      expect(datas[i - 1] >= datas[i]).toBe(true)
    }
  })

  it('404 — id inexistente', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/compromissos/999999999',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json<{ erro: string }>().erro).toBe('NAO_ENCONTRADO')
  })

  it('404 — compromisso de outro usuário (não vazar existência)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
      headers: { Authorization: `Bearer ${token2}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json<{ erro: string }>().erro).toBe('NAO_ENCONTRADO')
  })

  it('404 — compromisso descartado (I-09)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/compromissos/${compDescartadoId}`,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json<{ erro: string }>().erro).toBe('NAO_ENCONTRADO')
  })

  it('401 — sem token de autenticação', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/compromissos/${compId}`,
    })
    expect(res.statusCode).toBe(401)
  })
})
