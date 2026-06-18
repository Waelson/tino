/**
 * Testes de componente — TriageQueue
 * Cobre: renderiza/esconde conforme lista, 4 botões por item
 */
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { TriageQueue } from '../components/TriageQueue.js'
import { renderWithProviders } from './renderWithProviders.js'
import type { Compromisso } from '../types/api.js'

vi.mock('../api/compromissos.js', () => ({
  capturar: vi.fn(),
  listar: vi.fn(),
  listarTriagem: vi.fn(),
  triagem: vi.fn(),
}))

function makeItem(id: number, titulo: string): Compromisso {
  return {
    id, titulo, dono: null, tipo: null,
    prazo: null, checkpoint: null, status: 'nao_iniciada',
    checkpointVencido: false, prazoEstourado: false, prazoEmRisco: false,
    critica: false, precisaAtencao: false, comigo: false,
    criadaEm: new Date().toISOString(), atualizadaEm: new Date().toISOString(),
  }
}

describe('TriageQueue', () => {
  it('não renderiza nada quando lista vazia', () => {
    const { container } = renderWithProviders(<TriageQueue itens={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza o heading com contador correto', () => {
    const itens = [makeItem(1, 'Item A'), makeItem(2, 'Item B')]
    renderWithProviders(<TriageQueue itens={itens} />)
    expect(screen.getByText(/aguardando triagem/i)).toBeInTheDocument()
    expect(screen.getByText('(2)')).toBeInTheDocument()
  })

  it('renderiza os títulos dos itens', () => {
    const itens = [makeItem(1, 'Resultado esperado da API'), makeItem(2, 'Decisão de arquitetura')]
    renderWithProviders(<TriageQueue itens={itens} />)
    expect(screen.getByText('Resultado esperado da API')).toBeInTheDocument()
    expect(screen.getByText('Decisão de arquitetura')).toBeInTheDocument()
  })

  it('cada item tem 4 botões de triagem', () => {
    const itens = [makeItem(1, 'Item único')]
    renderWithProviders(<TriageQueue itens={itens} />)
    expect(screen.getByRole('button', { name: 'Fazer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delegar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adiar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument()
  })

  it('dois itens têm 8 botões no total', () => {
    const itens = [makeItem(1, 'A'), makeItem(2, 'B')]
    renderWithProviders(<TriageQueue itens={itens} />)
    expect(screen.getAllByRole('button', { name: 'Fazer' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Descartar' })).toHaveLength(2)
  })
})
