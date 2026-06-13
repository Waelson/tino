/**
 * Testes de componente — CommitmentList (flags A-24, empty states A-28)
 * Cobre: A-24 (precedência de flag prazo > checkpoint), A-28 (mensagens de estado vazio por filtro).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { CommitmentList } from '../components/CommitmentList.js'
import { renderWithRouter } from './renderWithProviders.js'
import * as api from '../api/compromissos.js'

vi.mock('../api/compromissos.js', () => ({
  listar: vi.fn(),
  capturar: vi.fn(),
  listarTriagem: vi.fn(),
  triagem: vi.fn(),
}))

const mockListar = vi.mocked(api.listar)

function makeItem(overrides: Partial<ReturnType<typeof baseMock>> = {}) {
  return { ...baseMock(), ...overrides }
}

function baseMock() {
  return {
    id: 1, titulo: 'Item teste', dono: 'Eu', tipo: 'fazer' as const,
    prazo: null, checkpoint: null, status: 'nao_iniciada',
    checkpointVencido: false, prazoEstourado: false,
    precisaAtencao: false, comigo: true,
    criadaEm: '2026-01-01T00:00:00Z', atualizadaEm: '2026-01-01T00:00:00Z',
  }
}

beforeEach(() => vi.clearAllMocks())

describe('CommitmentList — flags (A-24)', () => {
  it('A-24 — apenas prazoEstourado → exibe "prazo estourado" (não "checkpoint vencido")', async () => {
    mockListar.mockResolvedValue({
      itens: [makeItem({ prazoEstourado: true, checkpointVencido: false })],
    })
    renderWithRouter(<CommitmentList />, { initialEntries: ['/'] })
    await waitFor(() => expect(screen.getByText('prazo estourado')).toBeInTheDocument())
    expect(screen.queryByText('checkpoint vencido')).not.toBeInTheDocument()
  })

  it('A-24 — prazoEstourado E checkpointVencido → exibe apenas "prazo estourado"', async () => {
    mockListar.mockResolvedValue({
      itens: [makeItem({ prazoEstourado: true, checkpointVencido: true })],
    })
    renderWithRouter(<CommitmentList />, { initialEntries: ['/'] })
    await waitFor(() => expect(screen.getByText('prazo estourado')).toBeInTheDocument())
    expect(screen.queryByText('checkpoint vencido')).not.toBeInTheDocument()
  })

  it('apenas checkpointVencido → exibe "checkpoint vencido"', async () => {
    mockListar.mockResolvedValue({
      itens: [makeItem({ prazoEstourado: false, checkpointVencido: true })],
    })
    renderWithRouter(<CommitmentList />, { initialEntries: ['/'] })
    await waitFor(() => expect(screen.getByText('checkpoint vencido')).toBeInTheDocument())
    expect(screen.queryByText('prazo estourado')).not.toBeInTheDocument()
  })

  it('sem flags → nenhuma sinalização exibida', async () => {
    mockListar.mockResolvedValue({
      itens: [makeItem({ prazoEstourado: false, checkpointVencido: false })],
    })
    renderWithRouter(<CommitmentList />, { initialEntries: ['/'] })
    await waitFor(() => expect(screen.getByText('Item teste')).toBeInTheDocument())
    expect(screen.queryByText('prazo estourado')).not.toBeInTheDocument()
    expect(screen.queryByText('checkpoint vencido')).not.toBeInTheDocument()
  })
})

describe('CommitmentList — empty states (A-28)', () => {
  it('A-28 — filtro atencao vazio → "Nada precisa de atenção. Bom sinal."', async () => {
    mockListar.mockResolvedValue({ itens: [] })
    renderWithRouter(<CommitmentList />, { initialEntries: ['/?filtro=atencao'] })
    await waitFor(() =>
      expect(screen.getByText('Nada precisa de atenção. Bom sinal.')).toBeInTheDocument()
    )
  })

  it('A-28 — filtro ativas vazio → convite à captura', async () => {
    mockListar.mockResolvedValue({ itens: [] })
    renderWithRouter(<CommitmentList />, { initialEntries: ['/'] })
    await waitFor(() =>
      expect(screen.getByText('Nenhum compromisso por aqui ainda.')).toBeInTheDocument()
    )
    expect(screen.getByText(/capture a primeira demanda/i)).toBeInTheDocument()
  })

  it('filtro delegadas vazio → mensagem específica', async () => {
    mockListar.mockResolvedValue({ itens: [] })
    renderWithRouter(<CommitmentList />, { initialEntries: ['/?filtro=delegadas'] })
    await waitFor(() =>
      expect(screen.getByText('Nenhuma delegação no momento.')).toBeInTheDocument()
    )
  })
})
