export function serializeRequestForLog(req: {
  id?: unknown
  method?: unknown
  url?: unknown
  remoteAddress?: unknown
  remotePort?: unknown
} & Record<string, unknown>) {
  return {
    id: req.id,
    method: req.method,
    url: typeof req.url === 'string' ? req.url.split('?', 1)[0] : req.url,
    remoteAddress: req.remoteAddress,
    remotePort: req.remotePort,
  }
}
