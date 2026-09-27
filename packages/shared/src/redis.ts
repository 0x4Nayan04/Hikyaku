function decodeUserinfo(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function redisConnectionOptions(redisUrl: string, maxRetriesPerRequest: number | null) {
  const url = new URL(redisUrl)
  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined
  const username = decodeUserinfo(url.username)
  const password = decodeUserinfo(url.password)

  return {
    family: 0,
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: username || undefined,
    password: password || undefined,
    ...(database !== undefined && !Number.isNaN(database) ? { db: database } : {}),
    maxRetriesPerRequest,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  }
}
