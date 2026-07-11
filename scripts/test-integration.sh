#!/usr/bin/env bash
set -euo pipefail

export TEST_DATABASE_URL="postgresql://ticketing:ticketing@localhost:55432/ticketing_test?schema=public"

# Integration tests import modules that validate env vars at import time
# (src/lib/env.ts) even though the tests themselves don't exercise auth/S3.
# Placeholder values only — never real secrets.
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-test-better-auth-secret}"
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:3000}"
export AUTHENTIK_ISSUER="${AUTHENTIK_ISSUER:-https://auth.invalid/application/o/test/}"
export AUTHENTIK_CLIENT_ID="${AUTHENTIK_CLIENT_ID:-test-client-id}"
export AUTHENTIK_CLIENT_SECRET="${AUTHENTIK_CLIENT_SECRET:-test-client-secret}"
export AUTHENTIK_API_TOKEN="${AUTHENTIK_API_TOKEN:-test-api-token}"
export ADMIN_GROUPS="${ADMIN_GROUPS:-ticketing-admins}"
export INTERNAL_API_SECRET="${INTERNAL_API_SECRET:-test-internal-secret}"
export UPTIME_KUMA_WEBHOOK_SECRET="${UPTIME_KUMA_WEBHOOK_SECRET:-test-kuma-secret}"
export PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://localhost:3000}"
export S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:59000}"
export S3_BUCKET="${S3_BUCKET:-ticketing-test}"
export S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-ticketing-test}"
export S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-ticketing-test-secret}"

cleanup() {
  docker compose -f docker-compose.test.yml down -v
}
trap cleanup EXIT

docker compose -f docker-compose.test.yml up -d --wait postgres-test minio-test
docker compose -f docker-compose.test.yml run --rm minio-test-init

DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @ticketing/db exec prisma migrate deploy

DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter web exec vitest run --config vitest.integration.config.ts
