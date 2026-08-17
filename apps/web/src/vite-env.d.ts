/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_GITHUB_URL?: string
  readonly VITE_SOCIAL_URL?: string
}

declare module '*.md?html' {
  const html: string
  export default html
}

declare module '*.md?search' {
  const entries: { id: string; label: string }[]
  export default entries
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
