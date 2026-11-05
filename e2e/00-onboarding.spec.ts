import { createServer } from 'node:http'
import { expect, test } from '@playwright/test'
import { createDbClient } from '../packages/shared/src/db'
import { configureTestEnvironment } from '../packages/shared/src/testing/testEnv'
import { verifyPayload } from '../packages/shared/src/crypto'

test.beforeEach(async () => {
  configureTestEnvironment()
  const client = createDbClient(process.env.TEST_DATABASE_URL!)
  const connection = await client.getPool().connect()
  try {
    await connection.query('BEGIN')
    const workspaceName = `e2e-${process.env.TEST_RUN_ID}-installer`
    await connection.query(
      `DELETE FROM sessions WHERE sess->>'userId' IN (
        SELECT users.id::text FROM users JOIN tenants ON users.tenant_id = tenants.id
        WHERE tenants.name = $1
      )`,
      [workspaceName],
    )
    await connection.query('DELETE FROM tenants WHERE name = $1', [workspaceName])
    await connection.query('COMMIT')
  } catch (error) {
    await connection.query('ROLLBACK')
    throw error
  } finally {
    connection.release()
    await client.closePool()
  }
})

test('installer sends and inspects the first webhook without Admin or an API key', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const run = process.env.TEST_RUN_ID!
  const email = `smoke-super-${run}@test.com`
  const password = 'smoke-super-pass-12'
  const received: { body: string; deliveryId: string; timestamp: number; signature: string }[] = []
  let receiverStatus = 200
  const receiver = createServer((req, res) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => { body += chunk })
    req.on('end', () => {
      received.push({
        body,
        deliveryId: String(req.headers['x-webhook-id']),
        timestamp: Number(req.headers['x-webhook-timestamp']),
        signature: String(req.headers['x-webhook-signature']),
      })
      res.writeHead(receiverStatus)
      res.end('received')
    })
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
    // The URL changes before the lazy Login route replaces Bootstrap's matching fields.
    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible()
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
    const signingSecret = (await secret.locator('code').textContent())!.trim()
    await secret.getByRole('checkbox').check()
    await secret.getByRole('button', { name: 'Done' }).click()
    await expect(secret).toBeHidden()
    await page.setViewportSize({ width: 390, height: 844 })
    const capture = async (name: string) => {
      const path = testInfo.outputPath(`${name}.png`)
      await page.screenshot({ path, fullPage: true })
      await testInfo.attach(name, { path, contentType: 'image/png' })
    }
    await page.goto('/endpoints')
    await expect(page.getByText(`http://127.0.0.1:${address.port}/hook`)).toBeVisible()
    await capture('mobile-endpoints')
    await page.goto('/events/send')
    await expect(page.getByText('Compose test event', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send test event', exact: true })).toBeVisible()
    await capture('mobile-events')
    await page.getByRole('button', { name: 'Send test event', exact: true }).click()
    await page.getByRole('link', { name: 'View event', exact: true }).click()
    await expect(page.getByText('All delivered', { exact: true })).toBeVisible({ timeout: 20_000 })
    await capture('mobile-event-detail')
    expect(received).toHaveLength(1)
    const receipt = received[0]
    const eventId = page.url().split('/').pop()
    expect(JSON.parse(receipt.body)).toMatchObject({
      id: eventId,
      data: { order_id: '123', amount: 4999 },
    })
    expect(verifyPayload(signingSecret, receipt.timestamp, receipt.body, receipt.signature)).toBe(true)
    await page.getByRole('link', { name: 'View deliveries for this event' }).click()
    await page.getByRole('link', { name: /Open delivery to/ }).click()
    await expect(page.getByText('Attempt timeline')).toBeVisible()
    await expect(page.getByText('HTTP 200')).toBeVisible()
    expect(page.url().split('/').pop()).toBe(receipt.deliveryId)
    await capture('mobile-delivery-detail')

    // A real failed HTTP attempt must remain inspectable and replay to the receiver.
    receiverStatus = 400
    const failedEvent = await page.request.post('http://localhost:3101/v1/events', {
      data: { idempotency_key: `replay-${run}`, type: 'smoke.replay', payload: { replay: true } },
    })
    expect(failedEvent.status()).toBe(202)
    const failedEventId = (await failedEvent.json()).id
    await page.goto(`/events/${failedEventId}`)
    await page.getByRole('link', { name: 'View deliveries for this event' }).click()
    await page.getByRole('link', { name: /Open delivery to/ }).click()
    await expect(page.getByText('HTTP 400', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    receiverStatus = 200
    await page.getByRole('button', { name: 'Replay', exact: true }).click()
    await page.getByRole('dialog', { name: 'Replay delivery' }).getByRole('button', { name: 'Confirm replay' }).click()
    await expect(page.getByText('HTTP 200', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    const replayReceipt = received.at(-1)!
    expect(JSON.parse(replayReceipt.body)).toMatchObject({ id: failedEventId, data: { replay: true } })
    expect(verifyPayload(signingSecret, replayReceipt.timestamp, replayReceipt.body, replayReceipt.signature)).toBe(true)
    await page.goto('/settings?tab=profile')
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await capture('mobile-settings')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(pageErrors).toEqual([])
  } finally {
    await new Promise<void>((resolve, reject) => receiver.close(err => err ? reject(err) : resolve()))
  }
})
