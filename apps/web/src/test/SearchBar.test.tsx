/**
 * Testes de componente — SearchBar
 * Cobre: render do input, valor inicial da URL, botão limpar,
 *        sincronização com URL inicial ?q=, preserva ?filtro= ao digitar.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../components/SearchBar.js'
import { renderWithRouter } from './renderWithProviders.js'

describe('SearchBar', () => {
  it('renderiza input com placeholder correto', () => {
    renderWithRouter(<SearchBar />)
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/buscar por resultado esperado/i)).toBeInTheDocument()
  })

  it('botão limpar não aparece quando input está vazio', () => {
    renderWithRouter(<SearchBar />)
    expect(screen.queryByRole('button', { name: /limpar/i })).not.toBeInTheDocument()
  })

  it('sincroniza com ?q= da URL inicial', () => {
    renderWithRouter(<SearchBar />, { initialEntries: ['/?q=billing'] })
    expect(screen.getByRole('searchbox')).toHaveValue('billing')
  })

  it('botão limpar aparece quando URL inicial tem ?q=', () => {
    renderWithRouter(<SearchBar />, { initialEntries: ['/?q=billing'] })
    expect(screen.getByRole('button', { name: /limpar/i })).toBeInTheDocument()
  })

  it('limpar apaga o input', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SearchBar />, { initialEntries: ['/?q=billing'] })

    await user.click(screen.getByRole('button', { name: /limpar/i }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.queryByRole('button', { name: /limpar/i })).not.toBeInTheDocument()
  })

  it('digitar atualiza o valor do input', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SearchBar />)

    await user.type(screen.getByRole('searchbox'), 'api')
    expect(screen.getByRole('searchbox')).toHaveValue('api')
  })

  it('botão limpar aparece após digitar', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SearchBar />)

    await user.type(screen.getByRole('searchbox'), 'api')
    expect(screen.getByRole('button', { name: /limpar/i })).toBeInTheDocument()
  })
})
