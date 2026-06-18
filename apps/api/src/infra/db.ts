import { Kysely, MysqlDialect, Generated, Insertable, Selectable, Updateable } from 'kysely'
import { createPool } from 'mysql2'
import { config } from './config.js'

// ─── Tipos das tabelas (snake_case = convenção do banco) ─────────────────────

export interface UsuariosTable {
  id: Generated<bigint>
  email: string
  nome: string
  senha_hash: string
  criada_em: Generated<Date>
  atualizada_em: Generated<Date>
}

export type Tipo = 'fazer' | 'delegada' | 'adiada'
export type Status = 'nao_iniciada' | 'em_andamento' | 'bloqueada' | 'aguardando' | 'concluida'
export type Origem = 'usuario' | 'sistema'

export interface CompromissosTable {
  id: Generated<bigint>
  usuario_id: bigint
  titulo: string
  dono: string | null
  tipo: Tipo | null
  prazo: string | null       // DATE → string 'YYYY-MM-DD'
  checkpoint: string | null  // DATE → string 'YYYY-MM-DD'
  status: Status
  critica: Generated<number>  // TINYINT(1) — DEFAULT 0
  descartada_em: Date | null
  criada_em: Generated<Date>
  atualizada_em: Generated<Date>
}

export interface ReferenciasTable {
  id: Generated<bigint>
  compromisso_id: bigint
  descricao: string | null
  url: string
  criada_em: Generated<Date>
}

export interface RegistroEntradasTable {
  id: Generated<bigint>
  compromisso_id: bigint
  data: string  // DATE → string 'YYYY-MM-DD'
  texto: string
  origem: Origem
  criada_em: Generated<Date>
}

export interface RevisaoNarrativasTable {
  id: Generated<bigint>
  usuario_id: bigint
  semana: string        // ex.: '2026-W25'
  narrativa: string
  sugestoes: string     // JSON serializado — array de strings
  modelo_usado: string
  dados_hash: string | null
  gerado_em: Generated<Date>
}

export interface Database {
  usuarios: UsuariosTable
  compromissos: CompromissosTable
  referencias: ReferenciasTable
  registro_entradas: RegistroEntradasTable
  revisao_narrativas: RevisaoNarrativasTable
}

// ─── Tipos derivados para uso na aplicação ───────────────────────────────────

export type Usuario = Selectable<UsuariosTable>
export type NovoUsuario = Insertable<UsuariosTable>

export type Compromisso = Selectable<CompromissosTable>
export type NovoCompromisso = Insertable<CompromissosTable>
export type AtualizacaoCompromisso = Updateable<CompromissosTable>

export type Referencia = Selectable<ReferenciasTable>
export type NovaReferencia = Insertable<ReferenciasTable>

export type RegistroEntrada = Selectable<RegistroEntradasTable>
export type NovaRegistroEntrada = Insertable<RegistroEntradasTable>

// ─── Instância singleton ─────────────────────────────────────────────────────

export const db = new Kysely<Database>({
  dialect: new MysqlDialect({
    pool: createPool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      timezone: '+00:00',
      decimalNumbers: true,
    }) as any,
  }),
})
