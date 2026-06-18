import { db } from '../infra/db.js'
import type { Status } from '../infra/db.js'
import { criarEntrada } from '../registro/registro.repo.js'
import { findByIdTrx, atualizarPatch } from './compromissos.repo.js'
import { hojeEmSP, mapToApi, type CompromissoApi } from './compromissos.service.js'

// ─── Helper de erros tipados ──────────────────────────────────────────────────

function erroHttp(statusCode: number, erro: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { statusCode, erro })
}

// ─── Tipo do body PATCH ───────────────────────────────────────────────────────

export interface PatchBody {
  titulo?: string
  dono?: string | null
  prazo?: string | null
  checkpoint?: string | null
  status?: string
  tipo?: string
  critica?: boolean
}

// ─── Estado resultante (interno) ─────────────────────────────────────────────

interface EstadoResultante {
  titulo: string
  tipo: 'fazer' | 'delegada' | 'adiada' | null
  dono: string | null
  prazo: string | null
  checkpoint: string | null
  status: string
}

// ─── Validação exportada para testes de unidade ───────────────────────────────

export function calcularResultado(
  comp: { titulo: string; tipo: string | null; dono: string | null; prazo: string | null; checkpoint: string | null; status: string },
  body: PatchBody,
): { resultado: EstadoResultante; entradas: string[] } {
  const resultado: EstadoResultante = {
    titulo:     body.titulo     ?? comp.titulo,
    tipo:       (body.tipo      ?? comp.tipo) as EstadoResultante['tipo'],
    dono:       body.dono       !== undefined ? body.dono       : comp.dono,
    prazo:      body.prazo      !== undefined ? body.prazo      : comp.prazo,
    checkpoint: body.checkpoint !== undefined ? body.checkpoint : comp.checkpoint,
    status:     body.status     ?? comp.status,
  }

  // I-03: tipo=fazer → dono sempre 'Eu'
  if (resultado.tipo === 'fazer') {
    resultado.dono = 'Eu'
  }

  // I-01: título não pode ser vazio
  if (!resultado.titulo.trim()) {
    throw erroHttp(422, 'I-01', 'Título não pode ser vazio.')
  }

  // I-02: delegada exige dono ≠ 'eu', prazo e checkpoint < prazo
  if (resultado.tipo === 'delegada') {
    const dono = resultado.dono?.trim() ?? ''
    if (!dono) {
      throw erroHttp(422, 'I-02', 'Delegação exige um dono.')
    }
    if (dono.toLowerCase() === 'eu') {
      throw erroHttp(422, 'I-02', 'Dono de delegação não pode ser "Eu".')
    }
    if (!resultado.prazo) {
      throw erroHttp(422, 'I-02', 'Delegação exige prazo.')
    }
    if (!resultado.checkpoint) {
      throw erroHttp(422, 'I-02', 'Delegação exige checkpoint anterior ao prazo.')
    }
    if (resultado.checkpoint >= resultado.prazo) {
      throw erroHttp(422, 'I-02', 'Delegação exige checkpoint anterior ao prazo.')
    }
  }

  // I-04: adiada exige prazo
  if (resultado.tipo === 'adiada' && !resultado.prazo) {
    throw erroHttp(422, 'I-04', 'Adiamento exige prazo.')
  }

  // Detectar mudanças reais
  const mudou = {
    titulo:     resultado.titulo     !== comp.titulo,
    tipo:       resultado.tipo       !== comp.tipo,
    dono:       resultado.dono       !== comp.dono,
    prazo:      resultado.prazo      !== comp.prazo,
    checkpoint: resultado.checkpoint !== comp.checkpoint,
    status:     resultado.status     !== comp.status,
  }

  // Entradas automáticas (ordem determinística)
  const hoje = '' // preenchido pelo chamador no contexto de banco
  const entradas: string[] = []

  if (mudou.dono && comp.dono !== null) {
    entradas.push(`Dono alterado de ${comp.dono} para ${resultado.dono}.`)
  }
  if (mudou.prazo && comp.prazo !== null) {
    entradas.push(`Prazo alterado de ${comp.prazo} para ${resultado.prazo}.`)
  }
  if (mudou.checkpoint && comp.checkpoint !== null) {
    entradas.push(`Checkpoint alterado de ${comp.checkpoint} para ${resultado.checkpoint}.`)
  }
  if (mudou.status) {
    if (resultado.status === 'concluida') {
      entradas.push('Compromisso concluído.')
    } else {
      entradas.push(`Status: ${comp.status} → ${resultado.status}.`)
    }
  }

  return { resultado, entradas }
}

// ─── Normalização de datas vindas do banco (mysql2 pode retornar Date) ────────

function toDateStr(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().substring(0, 10)
  return String(val).substring(0, 10)
}

// ─── Operação principal ───────────────────────────────────────────────────────

export async function editarCompromisso(
  usuarioId: bigint,
  id: bigint,
  body: PatchBody,
): Promise<CompromissoApi> {
  const hoje = hojeEmSP()

  return db.transaction().execute(async (trx) => {
    const comp = await findByIdTrx(trx, { id, usuarioId, hoje })

    if (!comp) {
      throw erroHttp(404, 'NAO_ENCONTRADO', 'Compromisso não encontrado.')
    }

    // Normalizar datas do banco para string antes de usar em comparações
    const compNorm = {
      titulo:     comp.titulo,
      tipo:       comp.tipo,
      dono:       comp.dono,
      prazo:      toDateStr(comp.prazo),
      checkpoint: toDateStr(comp.checkpoint),
      status:     comp.status,
    }

    const { resultado, entradas } = calcularResultado(compNorm, body)

    // Detectar mudanças reais (usando valores normalizados)
    const mudou = {
      titulo:     resultado.titulo     !== compNorm.titulo,
      tipo:       resultado.tipo       !== compNorm.tipo,
      dono:       resultado.dono       !== compNorm.dono,
      prazo:      resultado.prazo      !== compNorm.prazo,
      checkpoint: resultado.checkpoint !== compNorm.checkpoint,
      status:     resultado.status     !== compNorm.status,
    }

    const algumaMudanca = Object.values(mudou).some(Boolean)

    // critica é fato de negócio — detectado separadamente (I-06 não se aplica)
    const criticaMudou =
      body.critica !== undefined && Boolean(body.critica) !== Boolean(comp.critica)

    // Noop: nenhum campo realmente mudou
    if (!algumaMudanca && !criticaMudou) {
      const atual = await findByIdTrx(trx, { id, usuarioId, hoje })
      if (!atual) throw new Error('Erro interno.')
      return mapToApi(atual)
    }

    // UPDATE com apenas os campos que mudaram
    await atualizarPatch(trx, {
      id,
      ...(mudou.titulo     && { titulo:     resultado.titulo }),
      ...(mudou.tipo       && resultado.tipo != null && { tipo: resultado.tipo }),
      ...(mudou.dono       && { dono:       resultado.dono }),
      ...(mudou.prazo      && { prazo:      resultado.prazo }),
      ...(mudou.checkpoint && { checkpoint: resultado.checkpoint }),
      ...(mudou.status     && { status:     resultado.status as Status }),
      ...(criticaMudou     && { critica:    body.critica ? 1 : 0 }),
    })

    // Entradas automáticas
    for (const texto of entradas) {
      await criarEntrada(trx, { compromissoId: id, data: hoje, texto, origem: 'sistema' })
    }

    // Log de criticidade (I-05 — append-only, só quando muda)
    if (criticaMudou) {
      const texto = body.critica ? 'Marcado como crítico.' : 'Criticidade removida.'
      await criarEntrada(trx, { compromissoId: id, data: hoje, texto, origem: 'sistema' })
    }

    const updated = await findByIdTrx(trx, { id, usuarioId, hoje })
    if (!updated) throw new Error('Erro interno após atualização.')
    return mapToApi(updated)
  })
}
