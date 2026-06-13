import { db } from '../infra/db.js'
import { findById, adicionarReferencia as adicionarReferenciaRepo, removerReferencia as removerReferenciaRepo, findReferenciaById } from './compromissos.repo.js'
import { hojeEmSP, mapReferencia, type ReferenciaApi } from './compromissos.service.js'

function erroHttp(statusCode: number, erro: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { statusCode, erro })
}

function validarUrl(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error()
    }
  } catch {
    throw erroHttp(422, 'I-12', 'URL deve ter esquema http ou https.')
  }
}

export async function adicionar(
  usuarioId: bigint,
  compromissoId: bigint,
  body: { url: string; descricao?: string | null },
): Promise<ReferenciaApi> {
  const hoje = hojeEmSP()
  const comp = await findById({ id: compromissoId, usuarioId, hoje })

  if (!comp) {
    throw erroHttp(404, 'NAO_ENCONTRADO', 'Compromisso não encontrado.')
  }

  validarUrl(body.url)

  const refId = await adicionarReferenciaRepo({
    compromissoId,
    url: body.url,
    descricao: body.descricao ?? null,
  })

  const ref = await db
    .selectFrom('referencias')
    .selectAll()
    .where('id', '=', refId)
    .executeTakeFirstOrThrow()

  return mapReferencia(ref)
}

export async function remover(
  usuarioId: bigint,
  compromissoId: bigint,
  refId: bigint,
): Promise<void> {
  const hoje = hojeEmSP()
  const comp = await findById({ id: compromissoId, usuarioId, hoje })

  if (!comp) {
    throw erroHttp(404, 'NAO_ENCONTRADO', 'Compromisso não encontrado.')
  }

  const deleted = await removerReferenciaRepo({ refId, compromissoId })

  if (deleted === 0) {
    throw erroHttp(404, 'NAO_ENCONTRADO', 'Referência não encontrada.')
  }
}
