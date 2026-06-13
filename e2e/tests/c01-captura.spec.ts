import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', 'test@radar.dev')
  await page.fill('#senha', 'senha123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

/**
 * C-01 — Captura sem fricção
 * Dado o campo de captura, quando o usuário envia apenas um título,
 * então o compromisso é criado com tipo=null, aparece na fila de triagem
 * e nenhum outro campo é exigido.
 */
test('C-01 — captura sem fricção', async ({ page }) => {
  await login(page)

  const input = page.getByRole('textbox', { name: 'Nova demanda' })
  await input.fill('Resultado esperado C01')
  await page.getByRole('button', { name: 'Capturar' }).click()

  // Toast de confirmação
  await expect(page.getByRole('status')).toHaveText('Capturada. Faça a triagem quando puder.')

  // Item aparece na fila de triagem
  const triagem = page.getByRole('region', { name: 'Triagem pendente' })
  await expect(triagem.getByText('Resultado esperado C01').first()).toBeVisible()

  // Input voltou vazio
  await expect(input).toHaveValue('')
})

/**
 * A-02 — Captura em rajada (FIFO)
 * Enviar 3 títulos seguidos e a fila exibe os 3 em ordem FIFO.
 *
 * Nota: o comportamento de focus (input.focus() após cada captura) é verificado
 * pelos testes de componente CaptureBar.test.tsx (linhas 55-102). Aqui testamos
 * a integração ponta a ponta: 3 capturas → 3 itens na ordem correta no banco/UI.
 */
test('A-02 — captura em rajada exibe os 3 itens em ordem FIFO', async ({ page }) => {
  await login(page)

  const triagem = page.getByRole('region', { name: 'Triagem pendente' })
  const input = page.getByRole('textbox', { name: 'Nova demanda' })

  // Captura 1
  await input.fill('Demanda FIFO 1')
  await input.press('Enter')
  await expect(triagem.getByText('Demanda FIFO 1')).toBeVisible()

  // Captura 2
  await input.fill('Demanda FIFO 2')
  await input.press('Enter')
  await expect(triagem.getByText('Demanda FIFO 2')).toBeVisible()

  // Captura 3
  await input.fill('Demanda FIFO 3')
  await input.press('Enter')
  await expect(triagem.getByText('Demanda FIFO 3')).toBeVisible()

  // Verificar ordem FIFO: mais antigo = topo da lista
  const titulos = triagem.locator('span').filter({ hasText: /^Demanda FIFO \d$/ })
  await expect(titulos).toHaveCount(3)
  await expect(titulos.nth(0)).toHaveText('Demanda FIFO 1')
  await expect(titulos.nth(1)).toHaveText('Demanda FIFO 2')
  await expect(titulos.nth(2)).toHaveText('Demanda FIFO 3')
})