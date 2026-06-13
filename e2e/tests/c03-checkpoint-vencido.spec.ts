import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', 'test@radar.dev')
  await page.fill('#senha', 'senha123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

function addDias(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * C-03 — Checkpoint vencido aparece sozinho
 * Dado um compromisso delegado com checkpoint anterior a hoje e prazo futuro,
 * quando a lista é carregada, então o item exibe a sinalização de checkpoint
 * vencido e entra no filtro Atenção — sem qualquer ação do usuário.
 */
test('C-03 — checkpoint vencido sinaliza na lista e entra no filtro Atenção', async ({ page }) => {
  await login(page)

  // ── Capturar um item ──────────────────────────────────────────────────────
  const input = page.getByRole('textbox', { name: 'Nova demanda' })
  await input.fill('Delegada checkpoint C03')
  await page.getByRole('button', { name: 'Capturar' }).click()

  const triagem = page.getByRole('region', { name: 'Triagem pendente' })
  await expect(triagem.getByText('Delegada checkpoint C03')).toBeVisible()

  // ── Delegar com checkpoint no passado, prazo no futuro ────────────────────
  const item = triagem.locator('span').filter({ hasText: 'Delegada checkpoint C03' }).first().locator('xpath=..')
  await item.getByRole('button', { name: 'Delegar' }).click()

  const popover = page.getByRole('form', { name: 'Delegar compromisso' })
  await expect(popover).toBeVisible()

  await popover.locator('[id^="dp-dono-"]').fill('Bot C03')
  await popover.locator('[id^="dp-prazo-"]').fill(addDias(30))
  await popover.locator('[id^="dp-check-"]').fill(addDias(-1))   // ontem → checkpoint vencido

  await popover.getByRole('button', { name: 'Delegar' }).click()
  await page.getByRole('status').filter({ hasText: 'Delegado.' }).waitFor()

  // ── Na lista (filtro ativas): flag "checkpoint vencido" visível ───────────
  const lista = page.getByRole('region', { name: 'Lista de compromissos' })
  const row = lista.locator('tr').filter({ hasText: 'Delegada checkpoint C03' })
  await expect(row).toBeVisible()
  await expect(row.getByText('checkpoint vencido')).toBeVisible()

  // ── Filtro Atenção: item deve aparecer ────────────────────────────────────
  await page.getByRole('tab', { name: /atenção/i }).click()
  await expect(lista.locator('tr').filter({ hasText: 'Delegada checkpoint C03' })).toBeVisible()
})
