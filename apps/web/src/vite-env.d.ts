/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_GITHUB_URL?: string
  readonly VITE_SOCIAL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
