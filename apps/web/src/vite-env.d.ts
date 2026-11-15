/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_DEMO_LOGIN?: string
  readonly VITE_API_URL?: string
  readonly VITE_PUBLIC_API_URL?: string
  readonly VITE_GITHUB_URL?: string
  readonly VITE_SOCIAL_URL?: string
  readonly VITE_PUBLIC_SITE_URL?: string
  readonly VITE_WALKTHROUGH_URL?: string
}

declare module '*.md?html' {
  const html: string
  export default html
}

declare module '*.md?search' {
  const entries: { id: string; label: string; text: string }[]
  export default entries
}

declare module '*.md?pages' {
  const pages: Record<string, string>
  export default pages
}

declare module '*.md?page-search' {
  const texts: Record<string, string>
  export default texts
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
