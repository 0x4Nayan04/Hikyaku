import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { compileDocsGuide } from './vite-plugin-docs-guide'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const appPackage = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string
}

const LCP_FONT = '@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2'

function preloadLcpFont(ingestUrl: string): Plugin {
  let fontPath: string | null = null
  try {
    fontPath = require.resolve(LCP_FONT)
  } catch {
    fontPath = null
  }

  return {
    name: 'preload-lcp-font',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        let next = html.replaceAll('__LCP_INGEST_URL__', ingestUrl)
        let href: string | undefined
        if (ctx.bundle) {
          const asset = Object.values(ctx.bundle).find(
            (item) =>
              item.type === 'asset' &&
              item.fileName.includes('space-grotesk-latin-600-normal') &&
              item.fileName.endsWith('.woff2'),
          )
          if (asset && asset.type === 'asset') {
            href = `/${asset.fileName}`
          }
        } else if (fontPath) {
          href = `/@fs${fontPath}`
        }
        if (href) {
          const tag = `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`
          next = next.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${tag}`)
        }
        next = next.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
          '<link rel="stylesheet" crossorigin href="$1" media="print" onload="this.media=\'all\'">\n    <noscript><link rel="stylesheet" crossorigin href="$1"></noscript>',
        )
        return next
      },
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // Vite keys isProduction off NODE_ENV; ensure `vite build` never ships a DEV bundle
  // when the shell left NODE_ENV unset (jsxDEV + optional react-grab would leak).
  if (command === 'build' && process.env.NODE_ENV !== 'production') {
    process.env.NODE_ENV = 'production'
  }

  const envDir = path.resolve(__dirname, '../..')
  const env = loadEnv(mode, envDir, '')
  const publicApi = env.VITE_PUBLIC_API_URL?.trim() || process.env.VITE_PUBLIC_API_URL?.trim() || ''
  const apiUrl = env.VITE_API_URL?.trim() || process.env.VITE_API_URL?.trim() || ''
  const configuredApi = publicApi || apiUrl
  const lcpIngestUrl = configuredApi
    ? `${configuredApi.replace(/\/$/, '')}/v1/events`
    : '/v1/events'

  return {
    envDir,
    define: {
      __APP_VERSION__: JSON.stringify(appPackage.version),
    },
    plugins: [react(), tailwindcss(), preloadLcpFont(lcpIngestUrl), compileDocsGuide()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('node_modules/react-router')) return 'router'
            if (
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/') ||
              id.includes('node_modules/react/')
            ) {
              return 'react-vendor'
            }
          },
        },
      },
    },
  }
})
