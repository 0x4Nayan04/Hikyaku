import { createServer } from 'node:http'
import { expect, test } from '@playwright/test'

test('installer sends and inspects the first webhook without Admin or an API key', async ({ page }) => {
  test.setTimeout(60_000)
  const run = process.env.TEST_RUN_ID!
  const email = `smoke-super-${run}@test.com`
  const password = 'smoke-super-pass-12'
  let received = false
  const receiver = createServer((req, res) => {
    req.resume()
    req.on('end', () => { received = true; res.writeHead(200); res.end('received') })
  })
  await new Promise<void>(resolve => receiver.listen(0, '127.0.0.1', resolve))
  const address = receiver.address()
  if (!address || typeof address === 'string') throw new Error('missing receiver address')
  try {
    await page.goto('/bootstrap')
    await page.getByLabel('Admin bootstrap secret').fill(process.env.ADMIN_BOOTSTRAP_SECRET!)
    await page.getByLabel('Workspace name').fill(`e2e-${run}-installer`)
    await page.getByLabel('Full name').fill('Test Installer')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Create account and workspace' }).click()
    await expect(page).toHaveURL('/login')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/dashboard')
    await page.getByRole('link', { name: /Create an endpoint/ }).click()
    await page.getByRole('button', { name: /Create (your first )?endpoint/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Create endpoint' })
    await dialog.getByLabel('URL').fill(`http://127.0.0.1:${address.port}/hook`)
    await dialog.getByRole('button', { name: 'Create endpoint' }).click()
    const secret = page.getByRole('dialog', { name: 'Signing secret' })
    await expect(secret.locator('code')).toContainText('whsec_')
    await secret.getByRole('checkbox').check()
    await secret.getByRole('button', { name: 'Done' }).click()
    await expect(secret).toBeHidden()
    await page.goto('/events/send')
    await page.getByRole('button', { name: 'Send test event', exact: true }).click()
    await page.getByRole('link', { name: 'View event', exact: true }).click()
    await expect(page.getByText('All delivered', { exact: true })).toBeVisible({ timeout: 20_000 })
    expect(received).toBe(true)
    await page.getByRole('link', { name: 'View deliveries for this event' }).click()
    await page.getByRole('link', { name: /Open delivery to/ }).click()
    await expect(page.getByText('Attempt timeline')).toBeVisible()
    await expect(page.getByText('HTTP 200')).toBeVisible()
    // Check narrow-screen overflow without creating a separate onboarding surface.
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  } finally {
    await new Promise<void>((resolve, reject) => receiver.close(err => err ? reject(err) : resolve()))
  }
})
