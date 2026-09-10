import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const file = new URL('../.env.production', import.meta.url)
const secret = () => randomBytes(32).toString('hex')
try {
  writeFileSync(
    file,
    `SITE_ADDRESS=localhost
POSTGRES_PASSWORD=${secret()}
ADMIN_BOOTSTRAP_SECRET=${secret()}
SESSION_SECRET=${secret()}
`,
    { flag: 'wx', mode: 0o600 },
  )
  console.log('Created .env.production. Set SITE_ADDRESS to your domain for public HTTPS.')
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  console.log('Existing .env.production preserved.')
}
console.log(
  'Start: docker compose --env-file .env.production -f compose.production.yml up -d --build',
)
