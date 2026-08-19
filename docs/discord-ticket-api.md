# Internal API: Create Ticket from Discord

Endpoint for logging new tickets from Discord messages. Already implemented — this doc describes current behavior for bot integration.

## Endpoint

```
POST /api/internal/tickets
```

## Auth

Bearer-style shared secret, sent as a custom header (not `Authorization`):

```
x-internal-secret: <INTERNAL_API_SECRET>
```

Compared with `timingSafeEqual`. Mismatch or missing header → `401`.

`INTERNAL_API_SECRET` is set server-side via env var. Bot must be configured with matching value.

## Request Body

```jsonc
{
  "discordUserId": "123456789012345678", // numeric Discord snowflake, string
  "discordUsername": "someuser",          // Discord display name, used in UI
  "title": "Ticket title",                // 3-200 chars
  "description": "Ticket description",    // 1-4000 chars
  "priority": "normal",                   // optional, enum, defaults "normal"
  "type": "other",                        // optional, enum, defaults "other"
  "discordChannelId": "987654321098765432", // optional
  "groupId": "clx...",                    // optional, from GET /api/internal/ticket-groups; null/omitted = "unsure", routed to admins only
  "idempotencyKey": "a uuid you generate per /ticket interaction" // optional but strongly recommended -- see Reliability below
}
```

Validated via `createInternalTicketSchema` (Zod). Invalid body → `400` with `details`.

## Reliability: idempotency key

Discord gives you ~3s to ack an interaction, but this endpoint can take longer under load. If your
request times out or the bot process restarts mid-request, **do not assume it failed** -- it may
have succeeded server-side. Always:

1. `interaction.deferReply()` immediately, before calling this endpoint.
2. Generate one uuid per interaction and send it as `idempotencyKey`.
3. On network error / 5xx, retry (a few attempts, exponential backoff) with the *same* key.
4. On retry, if the ticket already exists for that key, this endpoint returns the existing ticket
   (fresh access `url`, `isNewUser: false`) instead of creating a duplicate -- safe to call more
   than once.

Do not retry on `400` (validation error) -- that will never succeed with the same body.

## Destination/group picker

`GET /api/internal/ticket-groups` (same `x-internal-secret` auth, no body) returns
`{ "success": true, "data": [{ "id": "clx...", "name": "Networking" }, ...] }`. Use this to back a
Discord autocomplete option on `/ticket` (poll/cache client-side, e.g. every few minutes, rather
than hitting it per keystroke) so new groups show up without redeploying the bot's slash command.
Offer a synthetic "Unsure / let admins triage" choice that omits `groupId` from the create call.

## Response

```jsonc
// 200 OK
{
  "success": true,
  "data": {
    "ticketId": "clx...",
    "incidentNumber": "INC-2026-000123",
    "isNewUser": true,
    "url": "https://tickets.example.com/link-discord/claim?token=<claimToken>"
  }
}
```

```jsonc
// error shape (401/400/500)
{ "success": false, "error": "message" }
```

## Link behavior (already implemented, no bot-side branching needed)

Backend looks up `User` by `discordId`:

- **Known user** (Discord ID already linked to an Authentik account): creates a `TicketAccessToken` (30-day TTL) and returns
  `url = ${PUBLIC_APP_URL}/t/{ticketId}?token={rawToken}` — direct link to the ticket.
- **Unknown user**: creates a placeholder `User` (`isDiscordPlaceholder: true`, `discordId` stored, `name` = `discordUsername`), a `DiscordClaim` (30-min TTL) tied to that placeholder and the new ticket, and returns
  `url = ${PUBLIC_APP_URL}/link-discord/claim?token={claimToken}` — silent identifier link. When the user later signs in via Authentik and opens that link, the app links their real account to the placeholder (merging `discordId`/`discordUsername`), and they land on the ticket.

This app queues its own "your ticket has been created" DM to `discordUserId` with the returned `url` (message includes `incidentNumber`) — the caller does not need to send anything itself. `isNewUser` is returned in case it's useful for other messaging ("welcome, first time you've opened a ticket" etc), but is not required. `incidentNumber` (e.g. `INC-2026-000123`) is a human-readable ref, separate from `ticketId`, useful for bot-side embed titles/channel names.

`discordUserId` is persisted on `User.discordId` and used for all future DMs on this ticket (replies, status changes, etc).

## Example (bot-side)

```ts
const res = await fetch(`${INTERNAL_API_BASE}/api/internal/tickets`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_API_SECRET!,
  },
  body: JSON.stringify({
    discordUserId: interaction.user.id,
    discordUsername: interaction.user.username,
    title,
    description,
  }),
});
const { data } = await res.json();
// data.url -> send to user
```
