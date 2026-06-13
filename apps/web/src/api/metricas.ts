import { client } from './client.js'
import type { Metricas } from '../types/api.js'

export const getMetricas = (): Promise<Metricas> =>
  client.get<Metricas>('/metricas')
