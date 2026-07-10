# syntax=docker/dockerfile:1
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/bot/package.json apps/bot/package.json
RUN pnpm install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 botuser
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared ./packages/shared
COPY apps/bot ./apps/bot
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
USER botuser
WORKDIR /repo/apps/bot
# tsx (esbuild) runs the TypeScript source directly — no separate compile step,
# which sidesteps Node ESM's strict relative-import-extension requirement.
CMD ["npx", "tsx", "src/index.ts"]
