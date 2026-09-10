import { configureTestEnvironment } from '../../packages/shared/src/testEnv'
configureTestEnvironment()
const API_BASE = 'http://localhost:3101'
const ADMIN_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET!

export type SmokeOwner = {
  email: string
  password: string
  tenantName: string
}

class CookieJar {
  private cookies = new Map<string, string>()

  ingest(response: Response): void {
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(';')
      const eq = pair.indexOf('=')
      if (eq === -1) {
        continue
      }
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      this.cookies.set(name, value)
    }
  }

  header(): string | undefined {
    if (this.cookies.size === 0) {
      return undefined
    }
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
  }
}

async function apiFetch(path: string, jar: CookieJar, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const cookie = jar.header()
  if (cookie) {
    headers.set('Cookie', cookie)
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  jar.ingest(response)
  return response
}

async function login(jar: CookieJar, email: string, password: string): Promise<void> {
  const response = await apiFetch('/v1/auth/login', jar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Login failed for ${email}: ${response.status}`)
  }
}

async function bootstrapSuperAdmin(
  jar: CookieJar,
  email: string,
  password: string,
): Promise<boolean> {
  const bootstrap = await fetch(`${API_BASE}/v1/auth/bootstrap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ email, password, name: 'Smoke Super', workspace_name: `e2e-${process.env.TEST_RUN_ID}-installer` }),
  })

  if (bootstrap.status === 201) {
    await login(jar, email, password)
    return true
  }

  return false
}

async function getSuperAdminSession(jar: CookieJar): Promise<void> {
  const email = process.env.SMOKE_SUPER_EMAIL ?? `smoke-super-${process.env.TEST_RUN_ID}@test.com`
  const password = process.env.SMOKE_SUPER_PASSWORD ?? 'smoke-super-pass-12'

  if (await bootstrapSuperAdmin(jar, email, password)) {
    return
  }

  const superEmail = email
  const superPassword = password

  if (superEmail && superPassword) {
    await login(jar, superEmail, superPassword)
    return
  }

  throw new Error('Test database already has users. Supply SMOKE_SUPER_EMAIL/SMOKE_SUPER_PASSWORD for this test database; no reset is performed.')
}

async function waitForApiHealth(timeoutMs = 120_000): Promise<void> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${API_BASE}/v1/health`)
      if (response.ok) {
        return
      }
    } catch {
      // API not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`API not healthy at ${API_BASE}/v1/health within ${timeoutMs}ms`)
}

export async function ensureSmokeOwner(): Promise<SmokeOwner> {
  await waitForApiHealth()

  const ts = Date.now()
  const owner: SmokeOwner = {
    email: `smoke-owner-${process.env.TEST_RUN_ID}-${ts}@test.com`,
    password: 'smoke-owner-pass-12',
    tenantName: `e2e-${process.env.TEST_RUN_ID}-${ts}`,
  }

  const jar = new CookieJar()
  await getSuperAdminSession(jar)

  const createInvite = await apiFetch('/v1/admin/invites', jar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'tenant_owner',
      tenant_name: owner.tenantName,
      owner_email: owner.email,
      owner_name: 'Smoke Owner',
    }),
  })

  if (!createInvite.ok) {
    const body = await createInvite.text()
    throw new Error(`Create invite failed (${createInvite.status}): ${body}`)
  }

  const invite = (await createInvite.json()) as { invite_url: string }
  const token = new URL(invite.invite_url).searchParams.get('token')
  const acceptInvite = await fetch(`${API_BASE}/v1/auth/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name: 'Smoke Owner', password: owner.password }),
  })
  if (!acceptInvite.ok) {
    const body = await acceptInvite.text()
    throw new Error(`Accept invite failed (${acceptInvite.status}): ${body}`)
  }

  return owner
}
