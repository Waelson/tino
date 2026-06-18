/**
 * Seed de desenvolvimento — 02-dados.md §8
 * Cobre os 3 compromissos canônicos do protótipo + usuário de teste.
 * Idempotente: limpa e recria os dados a cada execução.
 * NUNCA executar em produção.
 */
import bcrypt from 'bcryptjs'
import { db } from './db.js'

// "Hoje" parametrizado no fuso do usuário (America/Sao_Paulo) — I-10
function hoje(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function addDias(base: string, dias: number): string {
  const d = new Date(base + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

const hj = hoje()

// ─── Limpar dados existentes (ordem respeitando FKs) ────────────────────────
// radar_app não tem DELETE em registro_entradas (I-05). O DELETE em compromissos
// aciona CASCADE que apaga registro_entradas e referencias automaticamente
// — a cascata é executada pelo mecanismo de FK do MySQL, não pelo usuário.
await db.deleteFrom('compromissos').execute()
await db.deleteFrom('usuarios').execute()

// ─── Usuário de teste ────────────────────────────────────────────────────────
const senhaHash = await bcrypt.hash('senha123', 12)
const [usuarioResult] = await db
  .insertInto('usuarios')
  .values({
    email: 'test@radar.dev',
    nome: 'Usuário Teste',
    senha_hash: senhaHash,
  })
  .execute()

const usuarioId = usuarioResult!.insertId as bigint

// ─── Compromisso 1: delegado · em_andamento · checkpoint futuro ──────────────
// Cobre o caso "feliz" de delegação — sem alertas.
const [c1] = await db
  .insertInto('compromissos')
  .values({
    usuario_id: usuarioId,
    titulo: 'API de billing estável em produção',
    dono: 'Ana Lima',
    tipo: 'delegada',
    prazo: addDias(hj, 30),
    checkpoint: addDias(hj, 7),
    status: 'em_andamento',
  })
  .execute()

const c1Id = c1!.insertId as bigint

await db
  .insertInto('registro_entradas')
  .values({
    compromisso_id: c1Id,
    data: addDias(hj, -5),
    texto: 'Capturada.',
    origem: 'sistema',
  })
  .execute()

await db
  .insertInto('registro_entradas')
  .values({
    compromisso_id: c1Id,
    data: addDias(hj, -5),
    texto: `Delegada para Ana Lima. Prazo ${addDias(hj, 30)}, checkpoint ${addDias(hj, 7)}.`,
    origem: 'sistema',
  })
  .execute()

// ─── Compromisso 2: próprio (fazer) · prazo amanhã ───────────────────────────
// Cobre I-03 (dono = Eu) e prazo próximo.
const [c2] = await db
  .insertInto('compromissos')
  .values({
    usuario_id: usuarioId,
    titulo: 'Revisar proposta de arquitetura do time de dados',
    dono: 'Eu',
    tipo: 'fazer',
    prazo: addDias(hj, 1),
    checkpoint: null,
    status: 'nao_iniciada',
  })
  .execute()

const c2Id = c2!.insertId as bigint

await db
  .insertInto('registro_entradas')
  .values({
    compromisso_id: c2Id,
    data: addDias(hj, -2),
    texto: 'Capturada.',
    origem: 'sistema',
  })
  .execute()

await db
  .insertInto('registro_entradas')
  .values({
    compromisso_id: c2Id,
    data: addDias(hj, -2),
    texto: 'Triagem: execução própria.',
    origem: 'sistema',
  })
  .execute()

// ─── Compromisso 3: delegado · bloqueada · checkpoint vencido · prazo estourado ─
// Cobre C-04 (registro conta a história): delegação + mudança de prazo + mudança de status.
const prazoOriginal = addDias(hj, -10)
const prazoNovo = addDias(hj, -3)
const checkpointVencido = addDias(hj, -15)

const [c3] = await db
  .insertInto('compromissos')
  .values({
    usuario_id: usuarioId,
    titulo: 'Migração do banco legado para RDS concluída',
    dono: 'Carlos Mendes',
    tipo: 'delegada',
    prazo: prazoNovo,
    checkpoint: checkpointVencido,
    status: 'bloqueada',
  })
  .execute()

const c3Id = c3!.insertId as bigint

await db
  .insertInto('registro_entradas')
  .values([
    {
      compromisso_id: c3Id,
      data: addDias(hj, -20),
      texto: 'Capturada.',
      origem: 'sistema',
    },
    {
      compromisso_id: c3Id,
      data: addDias(hj, -20),
      texto: `Delegada para Carlos Mendes. Prazo ${prazoOriginal}, checkpoint ${checkpointVencido}.`,
      origem: 'sistema',
    },
    {
      compromisso_id: c3Id,
      data: addDias(hj, -12),
      texto: `Prazo alterado de ${prazoOriginal} para ${prazoNovo}.`,
      origem: 'sistema',
    },
    {
      compromisso_id: c3Id,
      data: addDias(hj, -8),
      texto: 'Status: em_andamento → bloqueada.',
      origem: 'sistema',
    },
  ])
  .execute()

console.log('Seed concluído:')
console.log(`  Usuário: test@radar.dev / senha123`)
console.log(`  Compromissos: 3 (delegado ativo, próprio prazo amanhã, delegado bloqueado vencido)`)

await db.destroy()
