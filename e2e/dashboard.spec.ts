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
    await page.getByRole('textbox', { name: 'Password' }).fill(owner.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    await page.goto('/endpoints')
    await expect(page.getByRole('heading', { name: 'Endpoints' })).toBeVisible()

    await page.getByRole('button', { name: /Create (your first )?endpoint/ }).click()
    const createDialog = page.getByRole('dialog', { name: 'Create endpoint' })
    await createDialog.getByLabel('URL').fill('https://example.com/discarded')
    await createDialog.getByLabel('Label').fill('Discarded draft')
    await createDialog.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: /Create (your first )?endpoint/ }).click()
    await expect(createDialog.getByLabel('URL')).toHaveValue('')
    await expect(createDialog.getByLabel('Label')).toHaveValue('')
    await createDialog.getByLabel('URL').fill(endpointUrl)
    await createDialog.getByLabel('Label').fill(endpointDescription)
    await createDialog.getByRole('button', { name: 'Create endpoint' }).click()

    const secretDialog = page.getByRole('dialog', { name: 'Signing secret' })
    await expect(secretDialog).toBeVisible()
    await expect(secretDialog.locator('code')).toContainText(/^whsec_/)
    await expect(secretDialog.getByText('Save for this session')).toHaveCount(0)

    await secretDialog.getByRole('button', { name: 'Done' }).click()
    await expect(secretDialog).toBeHidden()

    await expect(page.getByText(endpointUrl)).toBeVisible()
    await expect(page.getByText(endpointDescription)).toBeVisible()

    await page.goto('/settings?tab=vault')
    await expect(page).toHaveURL('/settings?tab=profile')
    await expect(page.getByRole('tab', { name: 'Endpoint secrets' })).toHaveCount(0)

    await page.getByRole('tab', { name: 'API keys' }).click()
    await page.getByRole('button', { name: 'Create API key' }).click()

    const apiKeyDialog = page.getByRole('dialog', { name: 'Your API key is ready' })
    const apiKey = await apiKeyDialog.locator('code').first().textContent()
    expect(apiKey).toMatch(/^whk_[0-9a-f]{32}$/)

    await apiKeyDialog.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByText(`${apiKey!.slice(4, 12)}…`)).toBeVisible()

    const updatedPassword = 'smoke-owner-updated-12'
    await page.goto('/settings?tab=profile')
    await page.getByLabel('Current password').fill(owner.password)
    await page.getByLabel('New password', { exact: true }).fill(updatedPassword)
    await page.getByLabel('Confirm new password').fill(updatedPassword)
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page).toHaveURL('/login')
    await expect(page.getByText('Password updated')).toBeVisible()

    await page.getByLabel('Email').fill(owner.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(updatedPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dashboard')
    owner.password = updatedPassword
  })

  test('supports keyboard navigation for landing tabs and the account menu', async ({ page }) => {
    await page.goto('/')
    const faqTabs = page.getByRole('tablist', { name: 'FAQ topics' })
    await faqTabs.getByRole('tab', { name: 'Getting started' }).focus()
    await page.keyboard.press('End')
    await expect(faqTabs.getByRole('tab', { name: 'Access' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await page.goto('/login')
    await page.getByLabel('Email').fill(owner.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(owner.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('button', { name: 'Open account menu' }).click()
    await page.getByRole('menuitem', { name: 'Profile' }).press('End')
    await expect(page.getByRole('menuitem', { name: 'Log out' })).toBeFocused()
  })
})
