/**
 * Testes de unidade — calcularResultado() (patch.service.ts)
 * Cobre: I-01, I-02, I-03, I-04, noop, entradas automáticas.
 * Sem banco: testa apenas a lógica pura de merge + validação.
 */
import { describe, expect, it } from 'vitest'
import { calcularResultado } from '../../src/compromissos/patch.service.js'

const BASE = {
  titulo: 'Compromisso base',
  tipo: 'delegada' as const,
  dono: 'João',
  prazo: '2026-12-31',
  checkpoint: '2026-12-15',
  status: 'nao_iniciada',
}

function erroCode(fn: () => unknown): string {
  try {
    fn()
    return ''
  } catch (e: unknown) {
    return (e as { erro?: string }).erro ?? ''
  }
}

describe('calcularResultado — invariantes', () => {
  it('I-01: título vazio → 422 I-01', () => {
    expect(erroCode(() => calcularResultado(BASE, { titulo: '   ' }))).toBe('I-01')
  })

  it('I-02: delegada sem dono → 422 I-02', () => {
    expect(erroCode(() => calcularResultado({ ...BASE, dono: null }, { tipo: 'delegada' }))).toBe('I-02')
  })

  it('I-02: delegada com dono "eu" → 422 I-02', () => {
    expect(erroCode(() => calcularResultado(BASE, { dono: 'eu' }))).toBe('I-02')
  })

  it('I-02: delegada sem prazo → 422 I-02', () => {
    expect(erroCode(() => calcularResultado(BASE, { prazo: null }))).toBe('I-02')
  })

  it('I-02: delegada sem checkpoint → 422 I-02', () => {
    expect(erroCode(() => calcularResultado(BASE, { checkpoint: null }))).toBe('I-02')
  })

  it('I-02: delegada com checkpoint >= prazo → 422 I-02', () => {
    expect(erroCode(() => calcularResultado(BASE, { checkpoint: '2026-12-31' }))).toBe('I-02')
  })

  it('I-03: tipo=fazer com dono enviado → dono vira "Eu"', () => {
    const comp = { ...BASE, tipo: 'fazer' as const, dono: 'Eu', checkpoint: null }
    const { resultado } = calcularResultado(comp, { dono: 'Outro' })
    expect(resultado.dono).toBe('Eu')
  })

  it('I-04: adiada sem prazo → 422 I-04', () => {
    const comp = { ...BASE, tipo: 'adiada' as const, dono: null, checkpoint: null }
    expect(erroCode(() => calcularResultado(comp, { prazo: null }))).toBe('I-04')
  })
})

describe('calcularResultado — entradas automáticas', () => {
  it('noop: nenhum campo mudado → sem entradas', () => {
    const { entradas } = calcularResultado(BASE, {})
    expect(entradas).toHaveLength(0)
  })

  it('status → valor normal → "Status: X → Y."', () => {
    const { entradas } = calcularResultado(BASE, { status: 'em_andamento' })
    expect(entradas).toContain('Status: nao_iniciada → em_andamento.')
  })

  it('status → concluida → "Compromisso concluído."', () => {
    const { entradas } = calcularResultado(BASE, { status: 'concluida' })
    expect(entradas).toContain('Compromisso concluído.')
  })

  it('prazo mudou com anterior → entrada "Prazo alterado de..."', () => {
    const { entradas } = calcularResultado(BASE, { prazo: '2027-01-31', checkpoint: '2027-01-15' })
    expect(entradas.some((e) => e.startsWith('Prazo alterado de'))).toBe(true)
  })

  it('dono mudou com anterior → entrada "Dono alterado de..."', () => {
    const { entradas } = calcularResultado(BASE, { dono: 'Maria' })
    expect(entradas.some((e) => e.startsWith('Dono alterado de'))).toBe(true)
  })

  it('checkpoint mudou com anterior → entrada "Checkpoint alterado de..."', () => {
    const { entradas } = calcularResultado(BASE, { checkpoint: '2026-12-01' })
    expect(entradas.some((e) => e.startsWith('Checkpoint alterado de'))).toBe(true)
  })

  it('dono sem anterior → sem entrada de dono', () => {
    const comp = { ...BASE, dono: null }
    const { entradas } = calcularResultado(comp, { dono: 'Maria', tipo: 'delegada', prazo: '2026-12-31', checkpoint: '2026-12-15' })
    expect(entradas.some((e) => e.startsWith('Dono alterado de'))).toBe(false)
  })
})
