import { client } from './client.js'
import type { RiscoBriefing, RiscoBriefingResponse } from '../types/api.js'

export function getRiscoBriefingCache(): Promise<RiscoBriefingResponse> {
  return client.get<RiscoBriefingResponse>('/risco/briefing-cache')
}

export function gerarRiscoBriefing(): Promise<RiscoBriefing> {
  return client.post<RiscoBriefing>('/risco/briefing', {})
}
