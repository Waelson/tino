import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', 'test@radar.dev')
  await page.fill('#senha', 'senha123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

/**
 * Clica na linha da lista que contém textoSubstring e aguarda o drawer abrir.
 * Retorna o locator do dialog.
 */
async function abrirFicha(page: Page, textoSubstring: string) {
  const row = page.locator('tr').filter({ hasText: textoSubstring })
  await expect(row).toBeVisible()
  await row.click()
  await page.waitForURL(/\/compromissos\/\d+/)
  const drawer = page.getByRole('dialog', { name: 'Ficha do compromisso' })
  await expect(drawer).toBeVisible()
  return drawer
}

/**
 * A-10a — Deep-link com id inexistente → toast "Compromisso não encontrado." + fecha
 */
test('A-10 — deep-link id inexistente fecha o drawer com toast', async ({ page }) => {
  await login(page)
  await page.goto('/compromissos/999999')

  await expect(page.getByRole('status')).toContainText('Compromisso não encontrado')
  await page.waitForURL('/')
})

/**
 * A-10b — Deep-link direto a um id existente; reload mantém o drawer aberto
 */
test('A-10 — deep-link direto abre ficha; reload mantém aberto', async ({ page }) => {
  await login(page)
  await abrirFicha(page, 'API de billing estável em produção')

  const url = page.url() // ex.: http://localhost:5173/compromissos/3

  await page.reload()
  await page.waitForURL(url)

  await expect(page.getByRole('dialog', { name: 'Ficha do compromisso' })).toBeVisible()
  await expect(page.locator('#fTitulo')).toHaveValue('API de billing estável em produção')
})

/**
 * A-11 — Salvamento por campo gera entrada automática no registro sem reload
 * Altera o status via <select> (patch imediato no onChange) e verifica que a
 * nova entrada automática aparece no registro por invalidação de React Query.
 */
test('A-11 — mudança de status gera entrada no registro sem reload', async ({ page }) => {
  await login(page)
  const drawer = await abrirFicha(page, 'API de billing estável em produção')

  // C1 seed: status inicial = em_andamento
  await drawer.locator('#fStatus').selectOption('aguardando')

  // React Query invalida ['compromisso', id] → refetch → entrada automática visível
  await expect(
    drawer.getByText(/Status: em_andamento → aguardando/),
  ).toBeVisible()
})

/**
 * A-16 — Conclusão: toast aparece, drawer fecha, item sai da lista de Ativas
 * Nota: se A-11 rodou antes, C1 está em status "aguardando" — Concluir ainda funciona.
 */
test('A-16 — concluir: toast + fecha + item sai de Ativas', async ({ page }) => {
  await login(page)
  const drawer = await abrirFicha(page, 'API de billing estável em produção')

  await drawer.getByRole('button', { name: 'Concluir' }).click()

  await expect(page.getByRole('status')).toContainText('Compromisso concluído')
  await page.waitForURL('/')

  const lista = page.getByRole('region', { name: 'Lista de compromissos' })
  await expect(lista.getByText('API de billing estável em produção')).not.toBeVisible()
})
