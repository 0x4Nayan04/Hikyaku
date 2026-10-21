import { expect, test } from '@playwright/test'
import { DEMO_CREDENTIALS } from '../packages/shared/src/constants'
import { DEMO_TENANT_ID, seedDemoTenant } from '../apps/api/src/scripts/seedDemoTenant'
import { closePool } from '../apps/api/src/db/client'
import { deleteTenant } from '../apps/api/test/helpers/tenant'
import { ensureSmokeOwner } from './helpers/api-setup'

let created = false

test.beforeAll(async () => {
  // Reuse the existing bootstrap/session setup on isolated test resources only.
  await ensureSmokeOwner()
  const previous = process.env.ALLOW_DEMO_SEED
  process.env.ALLOW_DEMO_SEED = '1'
  try {
    created = (await seedDemoTenant()).created
  } finally {
    if (previous === undefined) delete process.env.ALLOW_DEMO_SEED
    else process.env.ALLOW_DEMO_SEED = previous
  }
})

test.afterAll(async () => {
  if (created) await deleteTenant(DEMO_TENANT_ID)
  await closePool()
})

test('demo visitor can inspect samples without mutation controls', async ({ page }) => {
  await page.goto('/login')
  if (process.env.VITE_DEMO_LOGIN === 'true') {
    await page.getByRole('button', { name: 'Use demo credentials' }).click()
    await expect(page.getByLabel('Email')).toHaveValue(DEMO_CREDENTIALS.email)
  } else {
    await page.getByLabel('Email').fill(DEMO_CREDENTIALS.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(DEMO_CREDENTIALS.password)
  }
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByText('Read-only demo', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Test event/ })).toHaveCount(0)

  await page.goto('/endpoints')
  await expect(page.getByText('https://example.com/demo/orders', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Create.*endpoint/ })).toHaveCount(0)
  await page
    .getByRole('button', { name: /More actions for/ })
    .first()
    .click()
  await expect(page.getByRole('menuitem', { name: 'Copy URL', exact: true })).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: /Edit label|Rotate signing secret|Disable endpoint/ }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.goto('/events')
  await expect(page.getByText('order.created').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Test event/ })).toHaveCount(0)
  await page.goto('/events/send')
  await expect(page).toHaveURL('/events')

  const list = await page.request.get('http://localhost:3101/v1/deliveries?status=failed')
  const delivery = (await list.json()).data[0]
  await page.goto(`/deliveries/${delivery.id}`)
  await expect(page.getByText('Attempt timeline', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replay', exact: true })).toHaveCount(0)

  await page.goto('/settings?tab=profile')
  await expect(page.getByText(DEMO_CREDENTIALS.email, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update password' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'API keys' })).toHaveCount(0)
  const rejected = await page.request.post('http://localhost:3101/v1/events', {
    data: { idempotency_key: 'blocked-demo-browser', type: 'test', payload: {} },
  })
  expect(rejected.status()).toBe(403)
  expect((await rejected.json()).error.code).toBe('read_only')
  await page.getByRole('button', { name: 'Open account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL('/login')
})
