export function normalizeSiteUrl(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/\/$/, '')
}

export function applyPublicSiteMeta(html: string, siteUrl: string): string {
  if (!siteUrl) return html
  return html.replaceAll('content="/og.png"', `content="${siteUrl}/og.png"`).replace(
    '<meta property="og:type" content="website" />',
    `<meta property="og:type" content="website" />
    <meta property="og:url" content="${siteUrl}/" />
    <link rel="canonical" href="${siteUrl}/" />`,
  )
}
