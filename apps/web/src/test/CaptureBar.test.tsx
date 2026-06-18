/**
 * Testes de componente — CaptureBar
 * Cobre: input vazio → botão desabilitado, A-02 (foco persistente em rajada)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CaptureBar } from '../components/CaptureBar.js'
import { renderWithProviders } from './renderWithProviders.js'
import * as api from '../api/compromissos.js'

vi.mock('../api/compromissos.js', () => ({
  capturar: vi.fn(),
  listar: vi.fn(),
  listarTriagem: vi.fn(),
  triagem: vi.fn(),
}))

const mockCapturar = vi.mocked(api.capturar)

const compromissoMock = {
  id: 1, titulo: 'T', dono: null, tipo: null as null,
  prazo: null, checkpoint: null, status: 'nao_iniciada',
  checkpointVencido: false, prazoEstourado: false, prazoEmRisco: false,
  critica: false, precisaAtencao: false, comigo: false,
  criadaEm: new Date().toISOString(), atualizadaEm: new Date().toISOString(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CaptureBar', () => {
  it('botão Capturar desabilitado com input vazio', () => {
    renderWithProviders(<CaptureBar />)
    expect(screen.getByRole('button', { name: 'Capturar' })).toBeDisabled()
  })

  it('botão habilitado após digitar texto', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CaptureBar />)
    const input = screen.getByRole('textbox', { name: /nova demanda/i })
    await user.type(input, 'Resultado esperado')
    expect(screen.getByRole('button', { name: 'Capturar' })).toBeEnabled()
  })

  it('botão continua desabilitado com apenas espaços', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CaptureBar />)
    const input = screen.getByRole('textbox', { name: /nova demanda/i })
    await user.type(input, '   ')
    expect(screen.getByRole('button', { name: 'Capturar' })).toBeDisabled()
  })

  it('(A-02) limpa input e chama focus após captura bem-sucedida', async () => {
    mockCapturar.mockResolvedValue(compromissoMock)
    const user = userEvent.setup()
    renderWithProviders(<CaptureBar />)

    const input = screen.getByRole('textbox', { name: /nova demanda/i })
    const focusSpy = vi.spyOn(input, 'focus')

    await user.type(input, 'Primeiro item')
    await user.click(screen.getByRole('button', { name: 'Capturar' }))

    await waitFor(() => expect(input).toHaveValue(''))
    expect(focusSpy).toHaveBeenCalled()
  })

  it('(A-02) captura 3 títulos em sequência — focus chamado e input limpo após cada um', async () => {
    mockCapturar.mockResolvedValue(compromissoMock)
    const user = userEvent.setup()
    renderWithProviders(<CaptureBar />)

    const input = screen.getByRole('textbox', { name: /nova demanda/i })
    const btn = screen.getByRole('button', { name: 'Capturar' })
    const focusSpy = vi.spyOn(input, 'focus')

    for (const titulo of ['Item 1', 'Item 2', 'Item 3']) {
      await user.type(input, titulo)
      await user.click(btn)
      await waitFor(() => expect(input).toHaveValue(''))
    }

    expect(mockCapturar).toHaveBeenCalledTimes(3)
    // focus é chamado pelo menos 1× por captura (pode ser mais pelo userEvent)
    expect(focusSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('(A-02) captura via Enter chama focus no input', async () => {
    mockCapturar.mockResolvedValue(compromissoMock)
    const user = userEvent.setup()
    renderWithProviders(<CaptureBar />)

    const input = screen.getByRole('textbox', { name: /nova demanda/i })
    const focusSpy = vi.spyOn(input, 'focus')

    await user.type(input, 'Via Enter{Enter}')

    await waitFor(() => expect(input).toHaveValue(''))
    expect(focusSpy).toHaveBeenCalled()
  })
})
