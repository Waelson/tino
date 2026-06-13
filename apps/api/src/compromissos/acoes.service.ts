import { db } from '../infra/db.js'
import type { Status } from '../infra/db.js'
import { criarEntrada } from '../registro/registro.repo.js'
import { findByIdTrx, findByIdParaDescartar, atualizarPatch, atualizarTriagem } from './compromissos.repo.js'
import { hojeEmSP, mapToApi, type CompromissoApi } from './compromissos.service.js'

function erroHttp(statusCode: number, erro: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { statusCode, erro })
}

// ─── Concluir (I-08) ─────────────────────────────────────────────────────────

export async function concluir(usuarioId: bigint, id: bigint): Promise<CompromissoApi> {
  const hoje = hojeEmSP()

  return db.transaction().execute(async (trx) => {
    const comp = await findByIdTrx(trx, { id, usuarioId, hoje })

    if (!comp) {
      throw erroHttp(404, 'NAO_ENCONTRADO', 'Compromisso não encontrado.')
    }

    // Idempotente: já concluída → sem UPDATE nem nova entrada
    if (comp.status === 'concluida') {
      return mapToApi(comp)
    }

    await atualizarPatch(trx, { id, status: 'concluida' as Status })
    await criarEntrada(trx, {
      compromissoId: id,
      data: hoje,
      texto: 'Compromisso concluído.',
      origem: 'sistema',
    })

    const updated = await findByIdTrx(trx, { id, usuarioId, hoje })
    if (!updated) throw new Error('Erro interno após conclusão.')
    return mapToApi(updated)
  })
}

// ─── Descartar (I-09) ────────────────────────────────────────────────────────

export async function descartar(
  usuarioId: bigint,
  id: bigint,
): Promise<{ id: number; descartada: boolean }> {
  const hoje = hojeEmSP()

  return db.transaction().execute(async (trx) => {
    const comp = await findByIdParaDescartar(trx, { id, usuarioId })

    if (!comp) {
      throw erroHttp(404, 'NAO_ENCONTRADO', 'Compromisso não encontrado.')
    }

    // Idempotente: já descartado → sem UPDATE nem nova entrada
    if (comp.descartada_em !== null) {
      return { id: Number(id), descartada: true }
    }

    await atualizarTriagem(trx, { id, descartada_em: new Date() })
    await criarEntrada(trx, {
      compromissoId: id,
      data: hoje,
      texto: 'Compromisso descartado.',
      origem: 'sistema',
    })

    return { id: Number(id), descartada: true }
  })
}
