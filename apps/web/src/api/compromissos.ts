import { client } from './client.js'
import type { Compromisso, CompromissoDetalhe, ListaResponse, PatchBody, Referencia, RegistroEntrada, TriagemBody } from '../types/api.js'

export const capturar = (titulo: string): Promise<Compromisso> =>
  client.post<Compromisso>('/compromissos', { titulo })

export const listar = (filtro = 'ativas', q?: string | null): Promise<ListaResponse> => {
  const params = new URLSearchParams({ filtro })
  if (q?.trim()) params.set('q', q.trim())
  return client.get<ListaResponse>(`/compromissos?${params.toString()}`)
}

export const listarTriagem = (): Promise<ListaResponse> =>
  client.get<ListaResponse>('/compromissos/triagem')

export const triagem = (id: number, body: TriagemBody): Promise<Compromisso> =>
  client.post<Compromisso>(`/compromissos/${id}/triagem`, body)

export const detalhe = (id: number): Promise<CompromissoDetalhe> =>
  client.get<CompromissoDetalhe>(`/compromissos/${id}`)

export const atualizar = (id: number, body: PatchBody): Promise<Compromisso> =>
  client.patch<Compromisso>(`/compromissos/${id}`, body)

export const concluirComp = (id: number): Promise<Compromisso> =>
  client.post<Compromisso>(`/compromissos/${id}/concluir`, {})

export const descartarComp = (id: number): Promise<{ id: number; descartada: boolean }> =>
  client.post<{ id: number; descartada: boolean }>(`/compromissos/${id}/descartar`, {})

export const adicionarReferencia = (
  id: number,
  body: { url: string; descricao?: string | null },
): Promise<Referencia> =>
  client.post<Referencia>(`/compromissos/${id}/referencias`, body)

export const removerReferencia = (id: number, refId: number): Promise<void> =>
  client.delete<void>(`/compromissos/${id}/referencias/${refId}`)

export const adicionarRegistro = (
  id: number,
  body: { texto: string; data?: string },
): Promise<RegistroEntrada> =>
  client.post<RegistroEntrada>(`/compromissos/${id}/registro`, body)
