# syntax=docker/dockerfile:1
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo /repo
COPY . .
RUN pnpm --filter @ticketing/db generate
# Build-time-only placeholders: env.ts validates these are present when Next
# imports route modules during the build, but none are NEXT_PUBLIC_ so they
# are never baked into the output — real values are injected at container
# runtime via the k8s Secret/ConfigMap (see deploy/base).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-used-at-runtime" \
    BETTER_AUTH_URL="http://localhost:3000" \
    PUBLIC_APP_URL="http://localhost:3000" \
    AUTHENTIK_ISSUER="https://auth.invalid/application/o/placeholder/" \
    AUTHENTIK_CLIENT_ID="build-placeholder" \
    AUTHENTIK_CLIENT_SECRET="build-placeholder" \
    ADMIN_GROUPS="ticketing-admins" \
    INTERNAL_API_SECRET="build-placeholder" \
    UPTIME_KUMA_WEBHOOK_SECRET="build-placeholder"
RUN pnpm --filter web build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /repo
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /repo/packages/db/generated ./packages/db/generated
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
