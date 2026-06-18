import type { Transaction } from 'kysely'
import { db } from '../infra/db.js'
import type { Database } from '../infra/db.js'
import { criarEntrada } from '../registro/registro.repo.js'
import { findByIdTrx, atualizarTriagem } from './compromissos.repo.js'
import { hojeEmSP, mapToApi, type CompromissoApi } from './compromissos.service.js'

// ─── Helper de erros tipados ──────────────────────────────────────────────────

function erroHttp(statusCode: number, erro: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { statusCode, erro })
}

// ─── Tipo do body de triagem ──────────────────────────────────────────────────

export interface TriagemBody {
  decisao: 'fazer' | 'delegar' | 'adiar' | 'descartar'
  dono?: string
  prazo?: string
  checkpoint?: string
}

// ─── Lógica de triagem ────────────────────────────────────────────────────────

export async function processarTriagem(
  usuarioId: bigint,
  id: bigint,
  body: TriagemBody,
): Promise<CompromissoApi> {
  const hoje = hojeEmSP()

  return db.transaction().execute(async (trx) => {
    const comp = await findByIdTrx(trx, { id, usuarioId, hoje })

    if (!comp) {
      throw erroHttp(404, 'NAO_ENCONTRADO', 'Compromisso não encontrado.')
    }

    if (comp.tipo !== null) {
      throw erroHttp(
        409,
        'ESTADO_INVALIDO',
        'Este compromisso já passou pela triagem.',
      )
    }

    switch (body.decisao) {
      case 'fazer':
        return processarFazer(trx, id, body, hoje, usuarioId)
      case 'delegar':
        return processarDelegar(trx, id, body, hoje, usuarioId)
      case 'adiar':
        return processarAdiar(trx, id, body, hoje, usuarioId)
      case 'descartar':
        return processarDescartar(trx, id, comp.titulo, hoje)
    }
  })
}

// ─── Decisão: fazer ───────────────────────────────────────────────────────────

async function processarFazer(
  trx: Transaction<Database>,
  id: bigint,
  body: TriagemBody,
  hoje: string,
  usuarioId: bigint,
): Promise<CompromissoApi> {
  await atualizarTriagem(trx, {
    id,
    tipo: 'fazer',
    dono: 'Eu',
    prazo: body.prazo ?? null,
  })
  await criarEntrada(trx, {
    compromissoId: id,
    data: hoje,
    texto: 'Triagem: execução própria.',
    origem: 'sistema',
  })
  const updated = await findByIdTrx(trx, { id, usuarioId, hoje })
  if (!updated) throw new Error('Erro interno após atualização.')
  return mapToApi(updated)
}

// ─── Decisão: delegar (I-02) ──────────────────────────────────────────────────

async function processarDelegar(
  trx: Transaction<Database>,
  id: bigint,
  body: TriagemBody,
  hoje: string,
  usuarioId: bigint,
): Promise<CompromissoApi> {
  const dono = body.dono?.trim()
  const prazo = body.prazo?.trim()
  const checkpoint = body.checkpoint?.trim()

  // I-02: dono obrigatório e não pode ser "eu"
  if (!dono) {
    throw erroHttp(422, 'I-02', 'Delegação exige um dono.')
  }
  if (dono.toLowerCase() === 'eu') {
    throw erroHttp(422, 'I-02', 'Dono de delegação não pode ser "Eu".')
  }
  // I-02: prazo obrigatório
  if (!prazo) {
    throw erroHttp(422, 'I-02', 'Delegação exige prazo.')
  }
  // I-02: checkpoint obrigatório
  if (!checkpoint) {
    throw erroHttp(422, 'I-02', 'Delegação exige checkpoint anterior ao prazo.')
  }
  // I-02: checkpoint deve ser estritamente anterior ao prazo
  if (checkpoint >= prazo) {
    throw erroHttp(422, 'I-02', 'Delegação exige checkpoint anterior ao prazo.')
  }

  await atualizarTriagem(trx, {
    id,
    tipo: 'delegada',
    dono,
    prazo,
    checkpoint,
  })
  await criarEntrada(trx, {
    compromissoId: id,
    data: hoje,
    texto: `Delegada para ${dono}. Prazo ${prazo}, checkpoint ${checkpoint}.`,
    origem: 'sistema',
  })
  const updated = await findByIdTrx(trx, { id, usuarioId, hoje })
  if (!updated) throw new Error('Erro interno após atualização.')
  return mapToApi(updated)
}

// ─── Decisão: adiar (I-04) ───────────────────────────────────────────────────

async function processarAdiar(
  trx: Transaction<Database>,
  id: bigint,
  body: TriagemBody,
  hoje: string,
  usuarioId: bigint,
): Promise<CompromissoApi> {
  const prazo = body.prazo?.trim()

  // I-04: prazo obrigatório para adiamento
  if (!prazo) {
    throw erroHttp(422, 'I-04', 'Adiamento exige prazo.')
  }

  await atualizarTriagem(trx, {
    id,
    tipo: 'adiada',
    prazo,
  })
  await criarEntrada(trx, {
    compromissoId: id,
    data: hoje,
    texto: `Triagem: adiada para ${prazo}.`,
    origem: 'sistema',
  })
  const updated = await findByIdTrx(trx, { id, usuarioId, hoje })
  if (!updated) throw new Error('Erro interno após atualização.')
  return mapToApi(updated)
}

// ─── Decisão: descartar (I-09) ────────────────────────────────────────────────

async function processarDescartar(
  trx: Transaction<Database>,
  id: bigint,
  titulo: string,
  hoje: string,
): Promise<CompromissoApi> {
  await atualizarTriagem(trx, {
    id,
    descartada_em: new Date(),
  })
  await criarEntrada(trx, {
    compromissoId: id,
    data: hoje,
    texto: 'Compromisso descartado.',
    origem: 'sistema',
  })
  // Item descartado: tipo=null, descartada_em set
  // Retorna shape mínimo compatível com CompromissoApi
  return {
    id: Number(id),
    titulo,
    dono: null,
    tipo: null,
    prazo: null,
    checkpoint: null,
    status: 'nao_iniciada',
    checkpointVencido: false,
    prazoEstourado: false,
    prazoEmRisco: false,
    precisaAtencao: false,
    comigo: false,
    criadaEm: new Date().toISOString(),
    atualizadaEm: new Date().toISOString(),
  }
}
