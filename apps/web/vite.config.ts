import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { compileDocsGuide } from './vite-plugin-docs-guide'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const appPackage = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string
}

const LCP_FONT = '@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2'

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
        if (!href) return html
        const tag = `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`
        return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${tag}`)
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // Vite keys isProduction off NODE_ENV; ensure `vite build` never ships a DEV bundle
  // when the shell left NODE_ENV unset (jsxDEV + optional react-grab would leak).
  if (command === 'build' && process.env.NODE_ENV !== 'production') {
    process.env.NODE_ENV = 'production'
  }

  return {
    envDir: path.resolve(__dirname, '../..'),
    define: {
      __APP_VERSION__: JSON.stringify(appPackage.version),
    },
    plugins: [react(), tailwindcss(), preloadLcpFont(), compileDocsGuide()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
