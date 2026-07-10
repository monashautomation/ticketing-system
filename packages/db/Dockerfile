# syntax=docker/dockerfile:1
# Minimal image for running `prisma migrate deploy` in CI/compose — no app
# build required, just the schema/migrations and the Prisma CLI.
FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile --filter @ticketing/db
COPY packages/db/prisma packages/db/prisma
WORKDIR /repo/packages/db
CMD ["npx", "prisma", "migrate", "deploy"]
