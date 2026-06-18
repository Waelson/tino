/**
 * Testes de componente — DelegarPopover
 * Cobre: submit guard, mapa de 422 I-02
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DelegarPopover } from '../components/DelegarPopover.js'
import { renderWithProviders } from './renderWithProviders.js'
import * as api from '../api/compromissos.js'
import type { ApiError } from '../types/api.js'

vi.mock('../api/compromissos.js', () => ({
  capturar: vi.fn(),
  listar: vi.fn(),
  listarTriagem: vi.fn(),
  triagem: vi.fn(),
}))

const mockTriagem = vi.mocked(api.triagem)
const onClose = vi.fn()
const onSuccess = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPopover() {
  return renderWithProviders(
    <DelegarPopover id={42} onClose={onClose} onSuccess={onSuccess} />,
  )
}

describe('DelegarPopover', () => {
  it('submit desabilitado quando campos vazios', () => {
    renderPopover()
    expect(screen.getByRole('button', { name: 'Delegar' })).toBeDisabled()
  })

  it('submit desabilitado quando apenas dono preenchido', async () => {
    const user = userEvent.setup()
    renderPopover()
    await user.type(screen.getByLabelText(/dono/i), 'Marina')
    expect(screen.getByRole('button', { name: 'Delegar' })).toBeDisabled()
  })

  it('submit desabilitado quando checkpoint >= prazo', async () => {
    const user = userEvent.setup()
    renderPopover()
    await user.type(screen.getByLabelText(/dono/i), 'Marina')
    await user.type(screen.getByLabelText(/prazo/i), '2026-12-31')
    await user.type(screen.getByLabelText(/checkpoint/i), '2026-12-31')
    expect(screen.getByRole('button', { name: 'Delegar' })).toBeDisabled()
  })

  it('submit habilitado com campos válidos e checkpoint < prazo', async () => {
    const user = userEvent.setup()
    renderPopover()
    await user.type(screen.getByLabelText(/dono/i), 'Marina')
    await user.type(screen.getByLabelText(/prazo/i), '2026-12-31')
    await user.type(screen.getByLabelText(/checkpoint/i), '2026-12-15')
    expect(screen.getByRole('button', { name: 'Delegar' })).toBeEnabled()
  })

  it('exibe mensagem I-02 no campo checkpoint em resposta 422', async () => {
    const err: ApiError = {
      status: 422,
      erro: 'I-02',
      mensagem: 'Delegação exige checkpoint anterior ao prazo.',
    }
    mockTriagem.mockRejectedValue(err)

    const user = userEvent.setup()
    renderPopover()
    await user.type(screen.getByLabelText(/dono/i), 'Marina')
    await user.type(screen.getByLabelText(/prazo/i), '2026-12-31')
    await user.type(screen.getByLabelText(/checkpoint/i), '2026-12-15')
    await user.click(screen.getByRole('button', { name: 'Delegar' }))

    await waitFor(() => {
      expect(
        screen.getByText(/delegação exige dono, prazo e checkpoint anterior ao prazo/i),
      ).toBeInTheDocument()
    })
  })

  it('chama onSuccess após delegação bem-sucedida', async () => {
    const compromissoMock = {
      id: 42, titulo: 'T', dono: 'Marina', tipo: 'delegada' as const,
      prazo: '2026-12-31', checkpoint: '2026-12-15', status: 'nao_iniciada',
      checkpointVencido: false, prazoEstourado: false, prazoEmRisco: false,
      precisaAtencao: false, comigo: false,
      criadaEm: new Date().toISOString(), atualizadaEm: new Date().toISOString(),
    }
    mockTriagem.mockResolvedValue(compromissoMock)

    const user = userEvent.setup()
    renderPopover()
    await user.type(screen.getByLabelText(/dono/i), 'Marina')
    await user.type(screen.getByLabelText(/prazo/i), '2026-12-31')
    await user.type(screen.getByLabelText(/checkpoint/i), '2026-12-15')
    await user.click(screen.getByRole('button', { name: 'Delegar' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })
})
