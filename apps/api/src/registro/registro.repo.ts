import type { Transaction } from 'kysely'
import type { Database } from '../infra/db.js'

export async function criarEntrada(
  trx: Transaction<Database>,
  params: {
    compromissoId: bigint
    data: string
    texto: string
    origem: 'sistema' | 'usuario'
  },
): Promise<void> {
  await trx
    .insertInto('registro_entradas')
    .values({
      compromisso_id: params.compromissoId,
      data: params.data,
      texto: params.texto,
      origem: params.origem,
    })
    .execute()
}
