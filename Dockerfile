FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.17.0
COPY . .
RUN pnpm install --frozen-lockfile
ENV VITE_API_URL=""
RUN pnpm build

FROM build AS prod
ENV CI=true
ENV NODE_ENV=production
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod /app/node_modules ./node_modules
COPY --from=prod /app/package.json ./package.json
COPY --from=prod /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=prod /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=prod /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=prod /app/packages/shared/dist ./packages/shared/dist
COPY --from=prod /app/apps/api/package.json ./apps/api/package.json
COPY --from=prod /app/apps/api/dist ./apps/api/dist
COPY --from=prod /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=prod /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=prod /app/apps/worker/dist ./apps/worker/dist
USER node
CMD ["node", "apps/api/dist/index.js"]

FROM caddy:2-alpine AS web
COPY --from=build /app/apps/web/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
