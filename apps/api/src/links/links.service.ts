import type { LinkRow } from './links.repo.js'
import {
  listarLinks,
  criarLink,
  atualizarLink,
  excluirLink,
  registrarClique,
} from './links.repo.js'

// ─── Tipo de saída (camelCase para o cliente) ─────────────────────────────────

export interface LinkFavoritoApi {
  id:        number
  nome:      string
  url:       string
  descricao: string | null
  categoria: string | null
  cliques:   number
  criadaEm:  string
}

function mapToApi(row: LinkRow): LinkFavoritoApi {
  return {
    id:        Number(row.id),
    nome:      row.nome,
    url:       row.url,
    descricao: row.descricao,
    categoria: row.categoria,
    cliques:   row.cliques,
    criadaEm:  row.criada_em.toISOString(),
  }
}

function validarUrl(url: string): void {
  try {
    new URL(url)
  } catch {
    const err = Object.assign(new Error('URL inválida.'), { statusCode: 422, erro: 'I-12' })
    throw err
  }
}

// ─── Operações ────────────────────────────────────────────────────────────────

export async function listar(usuarioId: bigint): Promise<LinkFavoritoApi[]> {
  const rows = await listarLinks(usuarioId)
  return rows.map(mapToApi)
}

export async function criar(
  usuarioId: bigint,
  body: { url: string; nome: string; descricao?: string | null; categoria?: string | null },
): Promise<LinkFavoritoApi> {
  validarUrl(body.url)
  const row = await criarLink({
    usuarioId,
    nome:      body.nome,
    url:       body.url,
    descricao: body.descricao ?? null,
    categoria: body.categoria ?? null,
  })
  return mapToApi(row)
}

export async function atualizar(
  usuarioId: bigint,
  id: number,
  body: { url?: string; nome?: string; descricao?: string | null; categoria?: string | null },
): Promise<LinkFavoritoApi> {
  if (body.url !== undefined) validarUrl(body.url)

  const row = await atualizarLink({ id: BigInt(id), usuarioId, ...body })
  if (!row) {
    const err = Object.assign(new Error('Link não encontrado.'), { statusCode: 404 })
    throw err
  }
  return mapToApi(row)
}

export async function excluir(usuarioId: bigint, id: number): Promise<void> {
  const ok = await excluirLink(BigInt(id), usuarioId)
  if (!ok) {
    const err = Object.assign(new Error('Link não encontrado.'), { statusCode: 404 })
    throw err
  }
}

export async function clique(usuarioId: bigint, id: number): Promise<void> {
  const ok = await registrarClique(BigInt(id), usuarioId)
  if (!ok) {
    const err = Object.assign(new Error('Link não encontrado.'), { statusCode: 404 })
    throw err
  }
}
