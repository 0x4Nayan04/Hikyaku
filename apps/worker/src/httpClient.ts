export async function postWithTimeout(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; body: string; durationMs: number }> {
  const start = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    body,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text().catch(() => '')
  return {
    status: res.status,
    body: text.length > 1024 ? text.slice(0, 1024) : text,
    durationMs: Date.now() - start,
  }
}
