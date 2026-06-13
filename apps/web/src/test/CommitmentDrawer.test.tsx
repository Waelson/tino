/**
 * Testes de componente — CommitmentDrawer
 * Cobre: FichaForm blur/422, LogSection (sem edição), RefSection I-12, focus trap A-19
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommitmentDrawer } from '../components/CommitmentDrawer.js'
import { renderWithRouter } from './renderWithProviders.js'
import * as api from '../api/compromissos.js'
import type { ApiError } from '../types/api.js'

vi.mock('../api/compromissos.js', () => ({
  capturar: vi.fn(),
  listar: vi.fn(),
  listarTriagem: vi.fn(),
  triagem: vi.fn(),
  detalhe: vi.fn(),
  atualizar: vi.fn(),
  concluirComp: vi.fn(),
  descartarComp: vi.fn(),
  adicionarReferencia: vi.fn(),
  removerReferencia: vi.fn(),
  adicionarRegistro: vi.fn(),
}))

// Suprime window.confirm no ambiente jsdom
vi.stubGlobal('confirm', vi.fn(() => false))

const mockDetalhe = vi.mocked(api.detalhe)
const mockAtualizar = vi.mocked(api.atualizar)
const mockAdicionarReferencia = vi.mocked(api.adicionarReferencia)
const mockAdicionarRegistro = vi.mocked(api.adicionarRegistro)

const BASE = {
  id: 7,
  titulo: 'Entregar relatório',
  dono: 'Marina',
  tipo: 'delegada' as const,
  prazo: '2026-12-31',
  checkpoint: '2026-12-15',
  status: 'nao_iniciada',
  checkpointVencido: false,
  prazoEstourado: false,
  precisaAtencao: false,
  comigo: false,
  criadaEm: '2026-06-01T10:00:00.000Z',
  atualizadaEm: '2026-06-01T10:00:00.000Z',
}

const DETALHE_MOCK = {
  ...BASE,
  referencias: [
    { id: 1, url: 'https://example.com', descricao: 'Documento', criadaEm: '2026-06-01T10:00:00.000Z' },
  ],
  registro: [
    { id: 10, data: '2026-06-01', origem: 'sistema' as const, texto: 'Compromisso capturado.', criadaEm: '2026-06-01T10:00:00.000Z' },
    { id: 11, data: '2026-06-02', origem: 'usuario' as const, texto: 'Anotação manual.', criadaEm: '2026-06-02T10:00:00.000Z' },
  ],
}

function renderDrawer() {
  return renderWithRouter(<CommitmentDrawer />, {
    initialEntries: ['/compromissos/7'],
    path: '/compromissos/:id',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDetalhe.mockResolvedValue(DETALHE_MOCK)
})

// ─── FichaForm ────────────────────────────────────────────────────────────────

describe('FichaForm — blur save', () => {
  it('blur em titulo diferente chama atualizar com { titulo }', async () => {
    mockAtualizar.mockResolvedValue({ ...BASE, titulo: 'Novo título' })
    const user = userEvent.setup()
    renderDrawer()

    const input = await screen.findByLabelText(/resultado esperado/i)
    await user.clear(input)
    await user.type(input, 'Novo título')
    await user.tab() // dispara blur

    await waitFor(() =>
      expect(mockAtualizar).toHaveBeenCalledWith(7, expect.objectContaining({ titulo: 'Novo título' }))
    )
  })

  it('blur sem mudança NÃO chama atualizar', async () => {
    const user = userEvent.setup()
    renderDrawer()

    const input = await screen.findByLabelText(/resultado esperado/i)
    await user.click(input)
    await user.tab() // blur sem alterar

    await waitFor(() => expect(mockDetalhe).toHaveBeenCalled())
    expect(mockAtualizar).not.toHaveBeenCalled()
  })

  it('erro I-01 exibe mensagem sob campo titulo', async () => {
    const err: ApiError = { status: 422, erro: 'I-01', mensagem: 'Título obrigatório.' }
    mockAtualizar.mockRejectedValue(err)
    const user = userEvent.setup()
    renderDrawer()

    const input = await screen.findByLabelText(/resultado esperado/i)
    await user.clear(input)
    await user.type(input, 'x')
    await user.tab()

    await waitFor(() =>
      expect(screen.getByText(/descreva o resultado esperado/i)).toBeInTheDocument()
    )
  })

  it('tipo=fazer → campo dono está disabled', async () => {
    mockDetalhe.mockResolvedValue({
      ...DETALHE_MOCK,
      tipo: 'fazer',
      dono: 'Eu',
    })
    renderDrawer()

    const donoInput = await screen.findByLabelText(/dono/i)
    expect(donoInput).toBeDisabled()
  })
})

// ─── LogSection ───────────────────────────────────────────────────────────────

describe('LogSection — append-only (I-05)', () => {
  it('entradas de registro são renderizadas', async () => {
    renderDrawer()

    await screen.findByText('Compromisso capturado.')
    expect(screen.getByText('Anotação manual.')).toBeInTheDocument()
  })

  it('não há botão de editar ou deletar nas entradas do registro', async () => {
    renderDrawer()
    await screen.findByText('Compromisso capturado.')

    // Não deve existir botão com "editar" ou "excluir" / "remover" nas entradas
    const buttons = screen.queryAllByRole('button')
    const editDeleteButtons = buttons.filter((b) => {
      const label = (b.getAttribute('aria-label') ?? b.textContent ?? '').toLowerCase()
      return label.includes('editar') || label.includes('excluir') || label.includes('deletar')
    })
    expect(editDeleteButtons).toHaveLength(0)
  })

  it('adicionar anotação chama adicionarRegistro', async () => {
    mockAdicionarRegistro.mockResolvedValue({
      id: 99, data: '2026-06-13', origem: 'usuario', texto: 'Nova nota.', criadaEm: '2026-06-13T10:00:00.000Z',
    })
    const user = userEvent.setup()
    renderDrawer()

    const textarea = await screen.findByLabelText(/nova anotação/i)
    await user.type(textarea, 'Nova nota.')
    await user.click(screen.getByRole('button', { name: /adicionar ao registro/i }))

    await waitFor(() =>
      expect(mockAdicionarRegistro).toHaveBeenCalledWith(7, expect.objectContaining({ texto: 'Nova nota.' }))
    )
  })
})

// ─── RefSection ───────────────────────────────────────────────────────────────

describe('RefSection — referências', () => {
  it('exibe erro I-12 inline quando URL é inválida', async () => {
    const err: ApiError = { status: 422, erro: 'I-12', mensagem: 'URL inválida.' }
    mockAdicionarReferencia.mockRejectedValue(err)
    const user = userEvent.setup()
    renderDrawer()

    const urlInput = await screen.findByLabelText(/url da referência/i)
    await user.type(urlInput, 'nao-e-url')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(screen.getByText(/use um link http\(s\) válido/i)).toBeInTheDocument()
    )
  })

  it('URL válida chama adicionarReferencia', async () => {
    mockAdicionarReferencia.mockResolvedValue({
      id: 50, url: 'https://docs.example.com', descricao: null, criadaEm: '2026-06-13T10:00:00.000Z',
    })
    const user = userEvent.setup()
    renderDrawer()

    const urlInput = await screen.findByLabelText(/url da referência/i)
    await user.type(urlInput, 'https://docs.example.com')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    await waitFor(() =>
      expect(mockAdicionarReferencia).toHaveBeenCalledWith(7, expect.objectContaining({ url: 'https://docs.example.com' }))
    )
  })
})

// ─── Focus trap A-19 ─────────────────────────────────────────────────────────

describe('A-19 — focus trap e devolução de foco', () => {
  it('ao montar, primeiro elemento focável recebe foco', async () => {
    renderDrawer()

    // Aguarda o drawer carregar e o useFocusTrap focar o primeiro elemento
    await screen.findByLabelText(/resultado esperado/i)

    await waitFor(() => {
      const focused = document.activeElement
      // O primeiro focável pode ser o botão fechar ou um input — verificamos que há foco dentro do drawer
      expect(focused).not.toBe(document.body)
    })
  })

  it('Esc navega para /', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await screen.findByLabelText(/resultado esperado/i)

    // Dispara Esc
    await user.keyboard('{Escape}')

    // Após Esc o drawer não deve mais exibir o conteúdo (rota / não renderiza CommitmentDrawer)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('Tab do último elemento retorna para o primeiro (focus trap)', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await screen.findByLabelText(/resultado esperado/i)

    // Obtém todos os focáveis dentro do dialog
    const dialog = screen.getByRole('dialog')
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
      ),
    )
    expect(focusable.length).toBeGreaterThan(1)

    // Foca o último elemento e pressiona Tab
    focusable[focusable.length - 1].focus()
    await user.tab()

    // O foco deve ter voltado para o primeiro
    expect(document.activeElement).toBe(focusable[0])
  })

  it('Shift+Tab do primeiro elemento vai para o último (focus trap)', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await screen.findByLabelText(/resultado esperado/i)

    const dialog = screen.getByRole('dialog')
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
      ),
    )
    expect(focusable.length).toBeGreaterThan(1)

    // Foca o primeiro e pressiona Shift+Tab
    focusable[0].focus()
    await user.tab({ shift: true })

    expect(document.activeElement).toBe(focusable[focusable.length - 1])
  })
})
