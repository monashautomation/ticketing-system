# maticket — ticketing system CLI

Rust CLI for the Monash Automation ticketing system, in the spirit of `maims`
(the inventory CLI) but with **read and write** access.

## Build

```sh
cd cli
cargo build --release
# binary at target/release/maticket
```

## Auth

Tokens are created in the web UI at **/api-tokens** (nav: "API Tokens") or from
the CLI itself once you have one token. Only a SHA-256 hash is stored; the
plaintext is shown exactly once.

```sh
maticket auth login -u tickets.monashautomation.com -t matk_…
maticket whoami          # confirms identity + token scope
```

Config lives at `~/.config/maticket/config.json` (0600). Override with
`--config`, `$MATICKET_CONFIG`, or `$MATICKET_CONFIG_DIR`; flags `-u/-t` and
`$MATICKET_URL`/`$MATICKET_TOKEN` override the file.

## Read

```sh
maticket tickets list                 # my tickets
maticket tickets list --all \         # admin queue
  --status in_progress --priority urgent -f printer --overdue-only
maticket tickets get <id>             # detail + message thread
maticket tags list
maticket groups
maticket users list --role admin      # admin
maticket users assignable --group <id> -f kee
maticket notifications list
```

## Write (needs a read-write token)

```sh
maticket tickets create --title "Broken drill" -d "it died" --priority high --type bug
maticket tickets update <id> --status resolved --tag a,b --resolution "fixed"
maticket tickets close <id> --reason duplicate --resolution "see MA-12"
maticket tickets reopen <id>
maticket tickets share <id>
maticket messages add <id> -m "working on it"
maticket messages add <id> --file note.txt --internal   # admin internal note
maticket attachments upload <id> -f photo.png
maticket tags create "lab-equipment" --color "#22c55e"  # admin
maticket notifications read-all
```

## Token management

```sh
maticket tokens list
maticket tokens create -n laptop --read-write --expires-in-days 90
maticket tokens revoke <id>
```

Scope rules enforced server-side:
- non-admins always get **read-only** tokens
- a token can only mint tokens of equal-or-lesser scope (tokens minted through
  a token are always read-only)
- read-only tokens get `403 This API token is read-only` on any write endpoint

## Escape hatch

```sh
maticket call GET  /api/tickets
maticket call PATCH /api/tickets/<id> '{"status":"escalated"}'
```

`--json` on any command emits raw JSON instead of tables.

## Tests

```sh
cargo test    # 37 tests: arg parsing, request mapping, output rendering
```
