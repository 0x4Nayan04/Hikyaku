import { expect, test } from '@playwright/test'
import { ensureSmokeOwner, type SmokeOwner } from './helpers/api-setup'

let owner: SmokeOwner

test.describe('visual regression', () => {
  test.beforeAll(async () => {
    owner = await ensureSmokeOwner()
  })

  test('landing hero @ 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Webhook Delivery,/ })).toBeVisible()
    await expect(page).toHaveScreenshot('landing-hero-1440.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('dashboard empty metrics @ 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/login')
    await page.getByLabel('Email').fill(owner.email)
    await page.getByLabel('Password').fill(owner.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('heading', { name: 'Delivery health' })).toBeVisible()
    await expect(page).toHaveScreenshot('dashboard-1440.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
