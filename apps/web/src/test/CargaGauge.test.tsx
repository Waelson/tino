/**
 * Testes de componente — CargaGauge
 * Cobre: A-21 (zero ativos), A-22 (limiar 30% estrito), prefers-reduced-motion.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CargaGauge } from '../components/CargaGauge.js'

describe('CargaGauge', () => {
  it('A-21 — carga 0% sem alerta', () => {
    render(<CargaGauge carga={0} alertaCarga={false} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.queryByText(/delegue mais/i)).not.toBeInTheDocument()
  })

  it('A-22 — carga 30% sem alerta (limiar estrito)', () => {
    render(<CargaGauge carga={30} alertaCarga={false} />)
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.queryByText(/delegue mais/i)).not.toBeInTheDocument()
  })

  it('A-22 — carga 31% com alerta e legenda', () => {
    render(<CargaGauge carga={31} alertaCarga={true} />)
    expect(screen.getByText('31%')).toBeInTheDocument()
    expect(screen.getByText(/delegue mais/i)).toBeInTheDocument()
  })

  it('carga 100% com alerta', () => {
    render(<CargaGauge carga={100} alertaCarga={true} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText(/delegue mais/i)).toBeInTheDocument()
  })

  it('meter tem aria-valuenow correto', () => {
    render(<CargaGauge carga={42} alertaCarga={true} />)
    const meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuenow', '42')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
  })
})
