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
  "discordChannelId": "987654321098765432" // optional
}
```

Validated via `createInternalTicketSchema` (Zod). Invalid body → `400` with `details`.

## Response

```jsonc
// 200 OK
{
  "success": true,
  "data": {
    "ticketId": "clx...",
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

Bot just sends the returned `url` to the user — no need to know which case occurred, though `isNewUser` is available if useful for messaging ("welcome, first time you've opened a ticket" etc).

`discordUserId` is persisted on `User.discordId` for backend DM use later; `discordUsername` is stored as `User.name` for UI display.

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
