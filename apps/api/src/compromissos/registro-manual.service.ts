import { db } from '../infra/db.js'
import { findById } from './compromissos.repo.js'
import { hojeEmSP, mapRegistro, type RegistroEntradaApi } from './compromissos.service.js'

function erroHttp(statusCode: number, erro: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { statusCode, erro })
}

export async function adicionarEntradaManual(
  usuarioId: bigint,
  compromissoId: bigint,
  body: { texto: string; data?: string },
): Promise<RegistroEntradaApi> {
  const hoje = hojeEmSP()
  const comp = await findById({ id: compromissoId, usuarioId, hoje })

  if (!comp) {
    throw erroHttp(404, 'NAO_ENCONTRADO', 'Compromisso não encontrado.')
  }

  if (!body.texto.trim()) {
    throw erroHttp(422, 'TEXTO_OBRIGATORIO', 'Texto da entrada não pode ser vazio.')
  }

  const data = body.data ?? hoje

  const result = await db
    .insertInto('registro_entradas')
    .values({
      compromisso_id: compromissoId,
      data,
      texto: body.texto.trim(),
      origem: 'usuario',
    })
    .executeTakeFirstOrThrow()

  const entrada = await db
    .selectFrom('registro_entradas')
    .selectAll()
    .where('id', '=', result.insertId as bigint)
    .executeTakeFirstOrThrow()

  return mapRegistro(entrada)
}
