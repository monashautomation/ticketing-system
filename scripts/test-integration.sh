#!/usr/bin/env bash
set -euo pipefail

export TEST_DATABASE_URL="postgresql://ticketing:ticketing@localhost:55432/ticketing_test?schema=public"

cleanup() {
  docker compose -f docker-compose.test.yml down -v
}
trap cleanup EXIT

docker compose -f docker-compose.test.yml up -d --wait

DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @ticketing/db exec prisma migrate deploy

DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter web exec vitest run --config vitest.integration.config.ts
