import bcrypt from 'bcrypt'
import { createHash } from 'node:crypto'

const BCRYPT_ROUNDS = 12
const SHA256_BCRYPT_PREFIX = 'sha256:'
export const INVALID_PASSWORD_HASH =
  'sha256:$2b$12$tatUpP4QwhP6wELmus/DxO86fqsag8ntzvoudoOAo01yVzyYgwsqq'

function passwordDigest(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('base64url')
}

export async function hashPassword(plain: string): Promise<string> {
  return SHA256_BCRYPT_PREFIX + (await bcrypt.hash(passwordDigest(plain), BCRYPT_ROUNDS))
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith(SHA256_BCRYPT_PREFIX)) {
    return bcrypt.compare(passwordDigest(plain), hash.slice(SHA256_BCRYPT_PREFIX.length))
  }
  return bcrypt.compare(plain, hash)
}
