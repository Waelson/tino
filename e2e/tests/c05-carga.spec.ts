import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', 'test@radar.dev')
  await page.fill('#senha', 'senha123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

/**
 * C-05 — Alerta de gargalo
 * Dados compromissos ativos com mais de 30% "comigo", quando o painel
 * é carregado, então o indicador de carga está em estado de alerta.
 *
 * Estratégia: capturar 4 itens e triar cada um como "Fazer" (tipo=fazer,
 * dono=Eu → comigo). Isso adiciona 4 comigo ao total de ativos. Dado que
 * pré-condição é ≤ 12 ativos existentes, carga ≥ 4/16 × 100 = 25% mínimo —
 * e na prática bem acima de 30% com o estado acumulado dos testes anteriores.
 * O alerta é verificado pela legenda visível no CargaGauge.
 */
test('C-05 — alerta de gargalo: gauge em alerta quando carga > 30%', async ({ page }) => {
  await login(page)

  const triagem = page.getByRole('region', { name: 'Triagem pendente' })
  const lista = page.getByRole('region', { name: 'Lista de compromissos' })
  const input = page.getByRole('textbox', { name: 'Nova demanda' })

  // ── Capturar 4 itens "comigo" e triar cada um como Fazer ─────────────────
  const titulos = [
    'Fazer carga C05 1',
    'Fazer carga C05 2',
    'Fazer carga C05 3',
    'Fazer carga C05 4',
  ]

  for (const titulo of titulos) {
    // Capturar
    await input.fill(titulo)
    await page.getByRole('button', { name: 'Capturar' }).click()
    await expect(triagem.getByText(titulo)).toBeVisible()

    // Triar como Fazer
    const item = triagem.locator('span').filter({ hasText: titulo }).first().locator('xpath=..')
    await item.getByRole('button', { name: 'Fazer' }).click()
    await page.getByRole('status').filter({ hasText: 'Marcado para fazer.' }).waitFor()

    // Aguardar aparece na lista de ativos
    await expect(lista.locator('tr').filter({ hasText: titulo })).toBeVisible()
  }

  // ── Gauge em alerta: legenda "acima da marca de 30%" visível ─────────────
  await expect(page.getByText('acima da marca de 30%, delegue mais')).toBeVisible()

  // ── Valor de carga > 30 ───────────────────────────────────────────────────
  const valorText = await page.getByRole('meter').getAttribute('aria-valuenow')
  const carga = parseInt(valorText ?? '0')
  expect(carga).toBeGreaterThan(30)
})
