import { expect, test } from '@playwright/test'
import { ensureSmokeOwner, type SmokeOwner } from './helpers/api-setup'

let owner: SmokeOwner

test.describe('dashboard smoke', () => {
  test.beforeAll(async () => {
    owner = await ensureSmokeOwner()
  })

  test('login and create endpoint', async ({ page }) => {
    const endpointUrl = `https://example.com/smoke-${Date.now()}`
    const endpointDescription = 'Playwright smoke test'

    await page.goto('/login')
    await page.getByLabel('Email').fill(owner.email)
    await page.getByLabel('Password').fill(owner.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('heading', { name: 'Delivery health' })).toBeVisible()

    await page.goto('/endpoints')
    await expect(page.getByRole('heading', { name: 'Endpoints' })).toBeVisible()

    await page.getByRole('button', { name: 'Create endpoint' }).click()
    const createDialog = page.getByRole('dialog', { name: 'Create endpoint' })
    await createDialog.getByLabel('URL').fill(endpointUrl)
    await createDialog.getByLabel('Description (optional)').fill(endpointDescription)
    await createDialog.getByRole('button', { name: 'Create endpoint' }).click()

    const secretDialog = page.getByRole('dialog', { name: 'Signing secret' })
    await expect(secretDialog).toBeVisible()
    await expect(secretDialog.locator('code')).toContainText(/^whsec_/)

    await secretDialog.getByRole('button', { name: 'Done' }).click()
    await expect(secretDialog).toBeHidden()

    await expect(page.getByRole('cell', { name: endpointUrl })).toBeVisible()
    await expect(page.getByRole('cell', { name: endpointDescription })).toBeVisible()
  })
})
