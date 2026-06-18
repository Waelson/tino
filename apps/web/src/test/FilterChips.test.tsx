/**
 * Testes de componente — FilterChips
 * Cobre: A-23 (filtro na URL), contadores, chip ativo, default 'ativas'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterChips } from '../components/FilterChips.js'
import { renderWithRouter } from './renderWithProviders.js'
import * as metricasApi from '../api/metricas.js'

vi.mock('../api/metricas.js', () => ({
  getMetricas: vi.fn(),
}))

const mockGetMetricas = vi.mocked(metricasApi.getMetricas)

const metricasMock = {
  ativos: 10,
  checkpointsVencidos: 1,
  prazosEstourados: 2,
  comigo: 3,
  carga: 30,
  alertaCarga: false,
  aguardandoTriagem: 0,
  precisamAtencao: 4,
  emRisco: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMetricas.mockResolvedValue(metricasMock)
})

describe('FilterChips', () => {
  it('chip "Ativas" ativo por padrão (sem ?filtro=)', async () => {
    renderWithRouter(<FilterChips />, { initialEntries: ['/'] })
    const btn = screen.getByRole('tab', { name: /ativas/i })
    expect(btn).toHaveAttribute('aria-selected', 'true')
  })

  it('chip "Atenção" ativo quando ?filtro=atencao', () => {
    renderWithRouter(<FilterChips />, { initialEntries: ['/?filtro=atencao'] })
    expect(screen.getByRole('tab', { name: /atenção/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /ativas/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('A-23 — clicar Comigo atualiza URL para ?filtro=comigo', async () => {
    const user = userEvent.setup()
    renderWithRouter(<FilterChips />, { initialEntries: ['/'] })
    await user.click(screen.getByRole('tab', { name: /comigo/i }))
    // O chip Comigo deve ficar ativo
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /comigo/i })).toHaveAttribute('aria-selected', 'true')
    )
  })

  it('A-23 — clicar Ativas remove ?filtro= da URL', async () => {
    const user = userEvent.setup()
    renderWithRouter(<FilterChips />, { initialEntries: ['/?filtro=delegadas'] })
    await user.click(screen.getByRole('tab', { name: /ativas/i }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /ativas/i })).toHaveAttribute('aria-selected', 'true')
    )
  })

  it('exibe contador de Ativas quando metricas carregadas', async () => {
    renderWithRouter(<FilterChips />, { initialEntries: ['/'] })
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument())
  })

  it('exibe contador de Atenção (precisamAtencao)', async () => {
    renderWithRouter(<FilterChips />, { initialEntries: ['/'] })
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
  })

  it('Delegadas e Concluídas não exibem contador', async () => {
    renderWithRouter(<FilterChips />, { initialEntries: ['/'] })
    await waitFor(() => mockGetMetricas.mock.calls.length > 0)
    // Delegadas e Concluídas aparecem mas sem número extra além do label
    const delegadas = screen.getByRole('tab', { name: 'Delegadas' })
    expect(delegadas.textContent).toBe('Delegadas')
    const concluidas = screen.getByRole('tab', { name: 'Concluídas' })
    expect(concluidas.textContent).toBe('Concluídas')
  })
})
