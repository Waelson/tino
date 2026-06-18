import { client } from './client.js'
import type { RevisaoSemana, NarrativaIA, NarrativaCacheResponse } from '../types/api.js'

export function getRevisao(semana?: string): Promise<RevisaoSemana> {
  const qs = semana ? `?semana=${encodeURIComponent(semana)}` : ''
  return client.get<RevisaoSemana>(`/revisao${qs}`)
}

export function getNarrativaCache(semana?: string): Promise<NarrativaCacheResponse> {
  const qs = semana ? `?semana=${encodeURIComponent(semana)}` : ''
  return client.get<NarrativaCacheResponse>(`/revisao/narrativa${qs}`)
}

export function gerarNarrativa(semana?: string): Promise<NarrativaIA> {
  return client.post<NarrativaIA>('/revisao/narrativa', semana ? { semana } : {})
}
