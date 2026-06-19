import { client } from './client.js'
import type { LinkFavorito } from '../types/api.js'

export interface LinksResponse {
  itens: LinkFavorito[]
}

export interface LinkBody {
  url:       string
  nome:      string
  descricao?: string | null
  categoria?: string | null
}

export const listar = (): Promise<LinksResponse> =>
  client.get<LinksResponse>('/links')

export const criar = (body: LinkBody): Promise<LinkFavorito> =>
  client.post<LinkFavorito>('/links', body)

export const atualizar = (id: number, body: Partial<LinkBody>): Promise<LinkFavorito> =>
  client.put<LinkFavorito>(`/links/${id}`, body)

export const excluir = (id: number): Promise<void> =>
  client.delete<void>(`/links/${id}`)

export const registrarClique = (id: number): Promise<void> =>
  client.post<void>(`/links/${id}/clique`, {})
