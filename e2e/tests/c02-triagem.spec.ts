import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', 'test@radar.dev')
  await page.fill('#senha', 'senha123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

/**
 * Faz login, captura um item e aguarda aparecer na fila de triagem.
 * Retorna o locator do div._item_ que contém o título.
 */
async function loginECapturar(page: Page, titulo: string) {
  await login(page)
  const input = page.getByRole('textbox', { name: 'Nova demanda' })
  await input.fill(titulo)
  await page.getByRole('button', { name: 'Capturar' }).click()
  const triagem = page.getByRole('region', { name: 'Triagem pendente' })
  await expect(triagem.getByText(titulo)).toBeVisible()
}

/**
 * Localiza o div._item_ que contém o título específico.
 * Navega pela span do título até o div pai (span._titulo_ → div._item_).
 */
function itemNaFila(page: Page, titulo: string) {
  const triagem = page.getByRole('region', { name: 'Triagem pendente' })
  return triagem.locator('span').filter({ hasText: titulo }).first().locator('xpath=..')
}

/**
 * C-02 — Delegação exige checkpoint válido (anterior ao prazo)
 * Quando checkpoint ≥ prazo, o botão de submit fica desabilitado (validação preventiva).
 * Quando checkpoint < prazo, o submit é habilitado e a delegação é aceita pela API.
 */
test('C-02 — delegação exige checkpoint anterior ao prazo', async ({ page }) => {
  await loginECapturar(page, 'Teste delegação C02')

  const item = itemNaFila(page, 'Teste delegação C02')
  await item.getByRole('button', { name: 'Delegar' }).click()

  const popover = page.getByRole('form', { name: 'Delegar compromisso' })
  await expect(popover).toBeVisible()

  const btnDelegar = popover.getByRole('button', { name: 'Delegar' })

  // checkpoint igual ao prazo → submit desabilitado (I-02)
  await popover.locator('[id^="dp-dono-"]').fill('Maria')
  await popover.locator('[id^="dp-prazo-"]').fill('2026-12-31')
  await popover.locator('[id^="dp-check-"]').fill('2026-12-31')
  await expect(btnDelegar).toBeDisabled()

  // checkpoint posterior ao prazo → também desabilitado
  await popover.locator('[id^="dp-check-"]').fill('2027-01-01')
  await expect(btnDelegar).toBeDisabled()

  // checkpoint anterior ao prazo → habilitado
  await popover.locator('[id^="dp-check-"]').fill('2026-12-30')
  await expect(btnDelegar).toBeEnabled()

  // Submeter delegação válida — item deve sair da fila
  await btnDelegar.click()
  await page.getByRole('status').filter({ hasText: 'Delegado.' }).waitFor()
  await expect(page.getByRole('region', { name: 'Triagem pendente' }).getByText('Teste delegação C02')).not.toBeVisible()
})

/**
 * A-03 — Triagem "Fazer"
 * Item sai da fila e aparece na lista de Ativas com dono "Eu".
 */
test('A-03 — triagem fazer: item vai para Ativas com dono Eu', async ({ page }) => {
  await loginECapturar(page, 'Compromisso para fazer A03')

  const item = itemNaFila(page, 'Compromisso para fazer A03')
  await item.getByRole('button', { name: 'Fazer' }).click()

  // Toast de confirmação
  await page.getByRole('status').filter({ hasText: 'Marcado para fazer.' }).waitFor()

  // Item sai da fila
  const triagem = page.getByRole('region', { name: 'Triagem pendente' })
  await expect(triagem.getByText('Compromisso para fazer A03')).not.toBeVisible()

  // Aparece na lista de compromissos com dono "Eu"
  const lista = page.getByRole('region', { name: 'Lista de compromissos' })
  const row = lista.locator('tr').filter({ hasText: 'Compromisso para fazer A03' })
  await expect(row).toBeVisible()
  await expect(row.getByText('Eu')).toBeVisible()
})

/**
 * A-06 — Descartar
 * Depois do confirm, item sai da fila e NÃO aparece na lista de Ativas.
 */
test('A-06 — descartar: item some da fila e não vai para Ativas', async ({ page }) => {
  await loginECapturar(page, 'Compromisso para descartar A06')

  // Aceitar o dialog de confirmação automaticamente
  page.on('dialog', (dialog) => dialog.accept())

  const item = itemNaFila(page, 'Compromisso para descartar A06')
  await item.getByRole('button', { name: 'Descartar' }).click()

  // Toast de confirmação
  await page.getByRole('status').filter({ hasText: 'Descartada.' }).waitFor()

  // Item some da fila
  const triagem = page.getByRole('region', { name: 'Triagem pendente' })
  await expect(triagem.getByText('Compromisso para descartar A06')).not.toBeVisible()

  // NÃO aparece na lista de Ativas (I-09)
  const lista = page.getByRole('region', { name: 'Lista de compromissos' })
  await expect(lista.getByText('Compromisso para descartar A06')).not.toBeVisible()
})
