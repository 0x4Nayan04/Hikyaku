# `@hikyaku/web`

Operator console and docs for Hikyaku (Vite + React + TypeScript).

Use the [root quickstart](../../README.md#quickstart) to start the API, worker and local services. To run only the web development server from the repository root:

```bash
# From repo root
pnpm --filter @hikyaku/web dev
```

Open the app at http://localhost:5173 and the guide at http://localhost:5173/docs. The web server needs a running API for console operations.

Vite reads the root [`.env`](../../.env.example) configuration. `VITE_API_URL` sets the browser API base at build time; when unset, development uses `http://localhost:3000` and production uses the same origin. `VITE_PUBLIC_API_URL` can separately set the API origin shown in landing-page and console API-key examples. Public docs examples always use the local API address.

Run web-specific checks from the repository root:

```bash
pnpm --filter @hikyaku/web typecheck
pnpm --filter @hikyaku/web test:unit
pnpm --filter @hikyaku/web build
```
