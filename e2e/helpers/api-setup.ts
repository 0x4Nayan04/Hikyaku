import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: resolve(process.cwd(), '.env') })

const API_BASE = process.env.API_URL ?? 'http://localhost:3000'
const ADMIN_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET ?? 'change-me-in-production'

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

function resetAuthTables(): void {
  if (process.env.SMOKE_RESET_DB === '0') {
    throw new Error(
      'Users already exist. Set SMOKE_SUPER_EMAIL/SMOKE_SUPER_PASSWORD, SEED_SUPER_ADMIN_*, or SMOKE_RESET_DB=1.',
    )
  }

  console.warn('[smoke] Resetting users/tenants/sessions for isolated bootstrap')
  execSync(
    'docker compose exec -T postgres psql -U webhook -d webhooks -c "TRUNCATE users, tenants, sessions CASCADE;"',
    { stdio: 'inherit' },
  )
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
    body: JSON.stringify({ email, password, name: 'Smoke Super' }),
  })

  if (bootstrap.status === 201) {
    await login(jar, email, password)
    return true
  }

  return false
}

async function getSuperAdminSession(jar: CookieJar, ts: number): Promise<void> {
  const email = `smoke-super-${ts}@test.com`
  const password = 'smoke-super-pass-12'

  if (await bootstrapSuperAdmin(jar, email, password)) {
    return
  }

  const superEmail =
    process.env.SMOKE_SUPER_EMAIL?.trim() ?? process.env.SEED_SUPER_ADMIN_EMAIL?.trim()
  const superPassword = process.env.SMOKE_SUPER_PASSWORD ?? process.env.SEED_SUPER_ADMIN_PASSWORD

  if (superEmail && superPassword) {
    await login(jar, superEmail, superPassword)
    return
  }

  resetAuthTables()
  if (!(await bootstrapSuperAdmin(jar, email, password))) {
    throw new Error('Bootstrap failed after smoke DB reset')
  }
}

export async function waitForApiHealth(timeoutMs = 120_000): Promise<void> {
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
    email: `smoke-owner-${ts}@test.com`,
    password: 'smoke-owner-pass-12',
    tenantName: `Smoke Tenant ${ts}`,
  }

  const jar = new CookieJar()
  await getSuperAdminSession(jar, ts)

  const createTenant = await apiFetch('/v1/admin/tenants', jar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_name: owner.tenantName,
      owner_email: owner.email,
      owner_password: owner.password,
      owner_name: 'Smoke Owner',
    }),
  })

  if (!createTenant.ok) {
    const body = await createTenant.text()
    throw new Error(`Create tenant failed (${createTenant.status}): ${body}`)
  }

  return owner
}
