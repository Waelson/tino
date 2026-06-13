import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', 'test@radar.dev')
  await page.fill('#senha', 'senha123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

/**
 * Aguarda o MetricsBar carregar (gauge visível) e então lê o contador
 * do chip "Ativas" (metricas.ativos).
 */
async function ativasCount(page: Page): Promise<number> {
  // Aguarda metricas resolver (gauge aparece quando dados chegam)
  await expect(page.getByRole('meter')).toBeVisible()
  const chip = page.getByRole('tab', { name: /ativas/i })
  const txt = await chip.textContent() ?? ''
  return parseInt(txt.match(/(\d+)/)?.[1] ?? '0')
}

/**
 * A-20 — Métricas vivas
 * Capturar um item incrementa aguardandoTriagem (fila visível) sem reload;
 * triar como Fazer move o item para Ativas e atualiza o contador "Ativas"
 * no FilterChips (metricas.ativos) na mesma interação — invalidação correta.
 */
test('A-20 — captura incrementa triagem; triagem como Fazer atualiza Ativas sem reload', async ({ page }) => {
  await login(page)

  // ── Estado inicial: anotar contador de Ativas ─────────────────────────────
  const nInicial = await ativasCount(page)

  // ── Capturar um item ──────────────────────────────────────────────────────
  const input = page.getByRole('textbox', { name: 'Nova demanda' })
  await input.fill('Métricas vivas A20')
  await page.getByRole('button', { name: 'Capturar' }).click()

  // ── SEM RELOAD: item aparece na TriageQueue ───────────────────────────────
  const triagem = page.getByRole('region', { name: 'Triagem pendente' })
  await expect(triagem.getByText('Métricas vivas A20')).toBeVisible()

  // ── Ativas não mudou (item ainda é triagem, não ativo) ────────────────────
  const nAposCaptura = await ativasCount(page)
  expect(nAposCaptura).toBe(nInicial)

  // ── Triar como Fazer ──────────────────────────────────────────────────────
  const item = triagem.locator('span').filter({ hasText: 'Métricas vivas A20' }).first().locator('xpath=..')
  await item.getByRole('button', { name: 'Fazer' }).click()
  await page.getByRole('status').filter({ hasText: 'Marcado para fazer.' }).waitFor()

  // ── SEM RELOAD: item aparece na lista de compromissos ────────────────────
  const lista = page.getByRole('region', { name: 'Lista de compromissos' })
  await expect(lista.locator('tr').filter({ hasText: 'Métricas vivas A20' })).toBeVisible()

  // ── Contador "Ativas" incrementou (metricas invalidado) ───────────────────
  await expect(async () => {
    const nAposTriagem = await ativasCount(page)
    expect(nAposTriagem).toBe(nInicial + 1)
  }).toPass({ timeout: 5000 })
})
