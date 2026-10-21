import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { applyPublicSiteMeta, normalizeSiteUrl } from './src/lib/public-site-meta'
import { compileDocsGuide } from './vite-plugin-docs-guide'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const appPackage = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string
}

const LCP_FONT = '@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2'

function openApiDocument(): Plugin {
  const filename = path.resolve(__dirname, '../../docs/openapi.yaml')
  return {
    name: 'openapi-document',
    buildStart() {
      this.addWatchFile(filename)
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'openapi.yaml', source: readFileSync(filename) })
    },
    configureServer(server) {
      server.middlewares.use('/openapi.yaml', (_req, res) => {
        res.setHeader('Content-Type', 'application/yaml; charset=utf-8')
        res.end(readFileSync(filename))
      })
    },
  }
}

function preloadLcpFont(): Plugin {
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
        let next = html
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
        return next
      },
    },
  }
}

function publicSiteMeta(siteUrl: string): Plugin {
  return {
    name: 'public-site-meta',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return applyPublicSiteMeta(html, siteUrl)
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
  const siteUrl = normalizeSiteUrl(process.env.VITE_PUBLIC_SITE_URL || env.VITE_PUBLIC_SITE_URL)

  return {
    envDir,
    define: {
      __APP_VERSION__: JSON.stringify(appPackage.version),
    },
    plugins: [
      react(),
      tailwindcss(),
      preloadLcpFont(),
      publicSiteMeta(siteUrl),
      compileDocsGuide(),
      openApiDocument(),
    ],
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
