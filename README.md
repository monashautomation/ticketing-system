# Ticketing System

Self-hosted support ticketing system. Discord bot ticket creation, Authentik SSO
via BetterAuth, admin escalation/assignment, and Uptime Kuma-fed status page.
Deploys to Kubernetes via ArgoCD.

## Features

- **Discord ticket creation** — `/ticket` opens a modal, creates a ticket, DMs the
  user a link. Works before they even have a web account.
- **Account linking** — `/link <code>` binds a Discord account to a web account
  (code generated from `/settings/link-discord`), merging past + future tickets.
- **SSO via Authentik** — sign in through BetterAuth's generic OIDC plugin.
  Authentik group membership auto-grants admin (`ADMIN_GROUPS` env), everyone
  else is a regular user.
- **Ticket lifecycle** — create, reply (live via SSE), status/priority/assignee
  changes, one-click escalate, admin-only internal notes.
- **Uptime Kuma integration** — Kuma's webhook notification posts to this app,
  which opens/resolves a maintenance event and shows it on a public `/status`
  page. Admins can also post manual maintenance windows.
- **RBAC** — users see their own tickets; admins see and manage everything.

## Architecture

pnpm monorepo:

```
apps/web      Next.js app — UI, API routes, BetterAuth, Prisma access
apps/bot      discord.js service — slash commands, calls web's internal API
packages/db   Prisma schema + generated client, shared by web (bot only calls the API)
packages/shared  zod schemas + types shared between web and bot
deploy/       kustomize base + prod overlay for k8s
argocd/       ArgoCD Application manifest
```

The bot never touches Postgres directly — it calls `apps/web`'s
`/api/internal/*` routes with a shared secret (`INTERNAL_API_SECRET`). This
keeps one write path into the database.

## Prerequisites

- Node 20+, [pnpm](https://pnpm.io) (`npm install -g pnpm` if you don't have it)
- Docker + Docker Compose (for local Postgres / full-stack run)
- An Authentik instance with an OIDC application configured for this app
- A Discord application + bot token ([Discord Developer Portal](https://discord.com/developers/applications))

## Configuring Authentik

1. Create an OIDC/OAuth2 **application + provider** in Authentik.
   - Client type: **Confidential**
   - Redirect URI: `https://<your-domain>/api/auth/oauth2/callback/authentik`
     (or `http://localhost:3000/...` for local dev)
   - Scopes: `openid`, `profile`, `email`, and a `groups` scope mapping so the
     userinfo response includes a `groups` claim
2. Note the issuer URL, client ID, and client secret — these become
   `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`.
3. Pick (or create) an Authentik group for admins, e.g. `ticketing-admins`, and
   set it as `ADMIN_GROUPS` (comma-separated if more than one). Anyone in that
   group is granted the `admin` role on next sign-in; everyone else is `user`.

## Configuring Discord

1. Create an application at the Discord Developer Portal, add a **Bot**, copy
   its token → `DISCORD_TOKEN`, and the application's client ID → `DISCORD_CLIENT_ID`.
2. Invite the bot to your server with the `applications.commands` and `bot`
   scopes (minimum permission: Send Messages).
3. Set `DISCORD_DEV_GUILD_ID` to your test server's ID while developing —
   guild-scoped slash commands register instantly. Leave it blank for global
   commands in production (propagation can take up to an hour).
4. Register the slash commands (`/ticket`, `/link`) — see [Running locally](#running-locally).

## Environment variables

Copy `.env.example` to `.env` at the repo root (used by `docker-compose.yml`)
and fill in real values. Per-app `.env.example` files exist too, for running
`apps/web` / `apps/bot` outside Docker.

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | web, db | Postgres connection string |
| `BETTER_AUTH_SECRET` | web | 32+ random bytes, e.g. `openssl rand -hex 32` |
| `BETTER_AUTH_URL` / `PUBLIC_APP_URL` | web | Public URL of the web app |
| `AUTHENTIK_ISSUER` | web | Authentik OIDC issuer URL |
| `AUTHENTIK_CLIENT_ID` / `AUTHENTIK_CLIENT_SECRET` | web | From the Authentik application |
| `ADMIN_GROUPS` | web | Comma-separated Authentik group names → admin role |
| `INTERNAL_API_SECRET` | web, bot | Shared secret between bot and web's internal API |
| `UPTIME_KUMA_WEBHOOK_SECRET` | web | Sent as `?secret=` query param on the Kuma webhook URL |
| `DISCORD_TOKEN` / `DISCORD_CLIENT_ID` | bot | From the Discord application |
| `DISCORD_DEV_GUILD_ID` | bot | Optional, guild-scoped commands for dev |

## Running in development

Two ways to run locally. Both need `docker compose up -d postgres` at minimum
(or the full stack, for the Docker option).

### Option A: Docker Compose (closest to prod, least setup)

```bash
cp .env.example .env   # fill in real values
docker compose up -d postgres migrate web bot
curl http://localhost:3000/api/health   # should return {"success":true,...}
```

Rebuild after code changes: `docker compose up -d --build web bot`.

### Option B: Native (faster iteration, hot reload)

```bash
pnpm install
docker compose up -d postgres          # just the database
pnpm --filter @ticketing/db generate
DATABASE_URL=postgresql://ticketing:ticketing@localhost:5432/ticketing?schema=public \
  pnpm --filter @ticketing/db exec prisma migrate deploy

pnpm dev:web   # apps/web, http://localhost:3000, hot reload
pnpm dev:bot   # apps/bot, separate terminal, hot reload via tsx watch
```

### Discord commands (either option)

Register slash commands once (needs `DISCORD_TOKEN`/`DISCORD_CLIENT_ID` set,
and `DISCORD_DEV_GUILD_ID` set to your test server for instant registration):

```bash
pnpm --filter bot register
```

### Testing

```bash
pnpm test               # unit tests (packages/shared, apps/web) — no DB needed
pnpm test:integration   # spins up a throwaway Postgres via Docker, runs migrations,
                         # runs integration tests, tears it down
pnpm typecheck
pnpm lint
```

## Running in production

Production runs as containers on Kubernetes, deployed via ArgoCD (GitOps) —
not `docker compose up` on a server.

- `deploy/base` — Deployments/Services/Ingress/ConfigMaps (kustomize base)
- `deploy/overlays/prod` — prod-specific patches + image tags
- `argocd/application.yaml` — ArgoCD `Application` pointing at `deploy/overlays/prod`

**One-time setup before the first sync:**

1. Update image references (`ghcr.io/ORG/...`) and the ingress host in
   `deploy/base/*.yaml` and `deploy/overlays/prod/kustomization.yaml`.
2. Generate real secrets from `deploy/base/secrets.example.yaml` with
   [`kubeseal`](https://github.com/bitnami-labs/sealed-secrets) and commit the
   result to `deploy/overlays/prod/sealed-secrets.yaml` (placeholder only —
   never commit plaintext secrets).
3. `kubectl apply -f argocd/application.yaml`
4. Register Discord slash commands globally: run `pnpm --filter bot register`
   once with prod's `DISCORD_TOKEN`/`DISCORD_CLIENT_ID` and
   `DISCORD_DEV_GUILD_ID` unset (global registration, takes up to ~1h to
   propagate).

**Ongoing deploys are automatic:** CI (`.github/workflows/ci.yml`) builds and
pushes both images on every merge to `main`, bumps the overlay's image tags
(a GitOps commit), and ArgoCD picks up the change and syncs the cluster — no
manual `kubectl apply` needed after the initial setup above.

**Rolling back:** revert or fix-forward the GitOps commit that bumped the
image tag in `deploy/overlays/prod/kustomization.yaml`; ArgoCD will sync to
whatever that file points at.

## Uptime Kuma setup

In Uptime Kuma, add a **Webhook** notification pointing at:

```
https://<your-domain>/api/webhooks/uptime-kuma?secret=<UPTIME_KUMA_WEBHOOK_SECRET>
```

Attach it to the monitors you want reflected on `/status`. Down → opens a
maintenance event; the next matching up → resolves it.

## Known limitations

- SSE (live ticket replies) uses an in-memory event bus — fine for one `web`
  replica, needs Redis pub/sub if you scale past that.
- No email notifications; Discord DM + web UI only.
