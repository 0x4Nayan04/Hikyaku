export const PROXY_CLIENT_IP_HEADER = 'x-hikyaku-client-ip'
export const PROXY_SECRET_HEADER = 'x-hikyaku-proxy-secret'
/** Query param the Vercel rewrite uses to carry the original `/v1/*` path into `api/proxy`. */
export const PROXY_PATH_PARAM = '__hikyaku_path'

/** Map the Vercel proxy path back to the API path producers and the browser share. */
export function upstreamTarget(upstream: string, requestUrl: string): string {
  const base = upstream.replace(/\/$/, '')
  const url = new URL(requestUrl, 'http://internal')
  const rewrittenPath = url.searchParams.get(PROXY_PATH_PARAM)
  url.searchParams.delete(PROXY_PATH_PARAM)

  let path = url.pathname
  if (rewrittenPath !== null) {
    path = `/${rewrittenPath.replace(/^\/+/, '')}`
  } else if (path.startsWith('/api/proxy')) {
    path = path.slice('/api/proxy'.length)
  } else if (path.startsWith('/v1')) {
    path = path.slice('/v1'.length)
  }
  if (!path.startsWith('/')) path = `/${path}`
  const suffix = path === '/' ? '' : path
  return `${base}/v1${suffix}${url.search}`
}
