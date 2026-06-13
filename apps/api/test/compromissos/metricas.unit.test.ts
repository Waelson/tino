/**
 * Testes de unidade — calcularCargaEAlerta
 * Cobre: A-21 (zero ativos), A-22 (limiar 30% estrito), arredondamento (I-11).
 */
import { describe, it, expect } from 'vitest'
import { calcularCargaEAlerta } from '../../src/compromissos/compromissos.service.js'

describe('calcularCargaEAlerta', () => {
  it('A-21 — zero ativos → carga 0, alertaCarga false', () => {
    expect(calcularCargaEAlerta(0, 0)).toEqual({ carga: 0, alertaCarga: false })
  })

  it('A-22 — 3 comigo / 10 ativos → carga 30, alertaCarga false (limiar estrito)', () => {
    expect(calcularCargaEAlerta(10, 3)).toEqual({ carga: 30, alertaCarga: false })
  })

  it('A-22 — 4 comigo / 13 ativos → carga 31, alertaCarga true', () => {
    expect(calcularCargaEAlerta(13, 4)).toEqual({ carga: 31, alertaCarga: true })
  })

  it('arredondamento — 1 comigo / 3 ativos → round(33.33) = 33, alertaCarga true', () => {
    expect(calcularCargaEAlerta(3, 1)).toEqual({ carga: 33, alertaCarga: true })
  })

  it('carga total — 10 comigo / 10 ativos → carga 100, alertaCarga true', () => {
    expect(calcularCargaEAlerta(10, 10)).toEqual({ carga: 100, alertaCarga: true })
  })
})
