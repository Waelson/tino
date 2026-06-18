// Tipos espelhando os contratos de 03-api.md
// Não importar do servidor — espelho declarado da spec (feature 001 §5)

export interface Usuario {
  id: number
  nome: string
  email: string
}

export interface AuthResponse {
  token: string
  usuario: Usuario
}

export interface ApiError {
  status: number
  erro: string
  mensagem: string
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'erro' in value &&
    'mensagem' in value
  )
}

export interface Compromisso {
  id: number
  titulo: string
  dono: string | null
  tipo: 'fazer' | 'delegada' | 'adiada' | null
  prazo: string | null
  checkpoint: string | null
  status: string
  checkpointVencido: boolean
  prazoEstourado: boolean
  precisaAtencao: boolean
  comigo: boolean
  criadaEm: string
  atualizadaEm: string
}

export interface ListaResponse {
  itens: Compromisso[]
}

export interface TriagemBody {
  decisao: 'fazer' | 'delegar' | 'adiar' | 'descartar'
  dono?: string
  prazo?: string
  checkpoint?: string
}

export interface Referencia {
  id: number
  descricao: string | null
  url: string
  criadaEm: string
}

export interface RegistroEntrada {
  id: number
  data: string
  origem: 'usuario' | 'sistema'
  texto: string
  criadaEm: string
}

export interface CompromissoDetalhe extends Compromisso {
  referencias: Referencia[]
  registro: RegistroEntrada[]
}

export interface PatchBody {
  titulo?: string
  dono?: string | null
  prazo?: string | null
  checkpoint?: string | null
  status?: string
  tipo?: string
}

export interface DonoMetricas {
  dono: string
  ativos: number
  checkpointsVencidos: number
  prazosEstourados: number
  bloqueados: number
}

export interface EquipeResponse {
  membros: DonoMetricas[]
}

export interface Metricas {
  ativos: number
  checkpointsVencidos: number
  prazosEstourados: number
  comigo: number
  carga: number
  alertaCarga: boolean
  aguardandoTriagem: number
  precisamAtencao: number
}

export interface CompromissoConcluido {
  id: number
  titulo: string
  dono: string | null
  tipo: string | null
  concluidoEm: string
}

export interface CompromissoParalisado {
  id: number
  titulo: string
  dono: string | null
  tipo: string | null
  status: string
  prazo: string | null
  diasSemAtualizacao: number
}

export interface CompromissoRedelegado {
  id: number
  titulo: string
  donoAtual: string | null
  dataRedelegacao: string
}

export interface DonoSilencio {
  dono: string
  ativos: number
  diasSemAtualizacao: number
}

export interface RevisaoSemana {
  semana: string
  periodo: { inicio: string; fim: string }
  concluidos: CompromissoConcluido[]
  paralisados: CompromissoParalisado[]
  redelegados: CompromissoRedelegado[]
  donosEmSilencio: DonoSilencio[]
  resumo: {
    concluidos: number
    paralisados: number
    redelegados: number
    donosEmSilencio: number
  }
}

export interface NarrativaIA {
  semana: string
  narrativa: string
  sugestoes: string[]
  geradoEm: string
  modeloUsado: string
  estaAtualizada: boolean
}

export type NarrativaCacheResponse =
  | { disponivel: false; semana: string }
  | ({ disponivel: true } & NarrativaIA)
