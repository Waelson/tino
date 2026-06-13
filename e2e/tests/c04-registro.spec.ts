import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', 'test@radar.dev')
  await page.fill('#senha', 'senha123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

/**
 * C-04 — Registro conta a história
 * Dado um compromisso delegado que sofreu uma mudança de prazo e uma mudança
 * de status, quando o usuário abre a ficha, então o registro mostra, em ordem
 * do mais recente para o mais antigo: as entradas automáticas e a entrada de
 * delegação original — todas datadas e sem opção de edição.
 *
 * Usa o compromisso 3 do seed ("Migração do banco legado para RDS concluída"):
 *   - Capturada.
 *   - Delegada para Carlos Mendes. Prazo …, checkpoint ….
 *   - Prazo alterado de … para ….
 *   - Status: em_andamento → bloqueada.  ← mais recente
 */
test('C-04 — registro conta a história', async ({ page }) => {
  await login(page)

  // Abrir ficha de C3 clicando na linha da lista
  const row = page.locator('tr').filter({ hasText: 'Migração do banco legado para RDS concluída' })
  await expect(row).toBeVisible()
  await row.click()

  await page.waitForURL(/\/compromissos\/\d+/)

  const drawer = page.getByRole('dialog', { name: 'Ficha do compromisso' })
  await expect(drawer).toBeVisible()

  // ── Verificar presença das 4 entradas ────────────────────────────────────
  await expect(drawer.getByText('Capturada.').first()).toBeVisible()
  await expect(drawer.getByText(/Delegada para Carlos Mendes/)).toBeVisible()
  await expect(drawer.getByText(/Prazo alterado de/)).toBeVisible()
  await expect(drawer.getByText(/Status: em_andamento → bloqueada/)).toBeVisible()

  // ── Verificar ORDEM: mais recente em cima (DESC) ─────────────────────────
  const statusEntry  = drawer.getByText(/Status: em_andamento → bloqueada/)
  const prazoEntry   = drawer.getByText(/Prazo alterado de/)
  const delegadaEntry = drawer.getByText(/Delegada para Carlos Mendes/)

  const statusBox   = await statusEntry.boundingBox()
  const prazoBox    = await prazoEntry.boundingBox()
  const delegadaBox = await delegadaEntry.boundingBox()

  expect(statusBox).not.toBeNull()
  expect(prazoBox).not.toBeNull()
  expect(delegadaBox).not.toBeNull()

  // Status (hj-8) deve aparecer ACIMA de Prazo alterado (hj-12)
  expect(statusBox!.y).toBeLessThan(prazoBox!.y)
  // Prazo alterado (hj-12) deve aparecer ACIMA de Delegada (hj-20)
  expect(prazoBox!.y).toBeLessThan(delegadaBox!.y)

  // ── Sem botões de editar / excluir nas entradas do registro ───────────────
  const btnLabels = await drawer.getByRole('button').allTextContents()
  const editDeletePresent = btnLabels.some((t) =>
    /(editar|excluir|deletar)/i.test(t),
  )
  expect(editDeletePresent).toBe(false)

  // ── Datas DD/MM visíveis (ao menos uma por entrada) ───────────────────────
  const dateSpans = drawer.getByText(/^\d{2}\/\d{2}$/)
  await expect(dateSpans.first()).toBeVisible()
})
