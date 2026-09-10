FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.17.0
COPY . .
RUN pnpm install --frozen-lockfile
ENV VITE_API_URL=""
RUN pnpm build

FROM build AS runtime
ENV NODE_ENV=production
USER node
CMD ["node", "apps/api/dist/index.js"]

FROM caddy:2-alpine AS web
COPY --from=build /app/apps/web/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
