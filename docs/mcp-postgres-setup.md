# Postgres MCP Connector — Setup

`/.mcp.json` registers a read-only Postgres connector (`kaala-postgres`) so
Claude Code can query `kaala_dristi_db` directly via SQL.

Server: [`crystaldba/postgres-mcp`](https://github.com/crystaldba/postgres-mcp)
(the official `@modelcontextprotocol/server-postgres` is deprecated). Runs in
`--access-mode=restricted` — read-only transactions only, no writes.

## 1. Provide the connection string

The config reads the DSN from the `KD_DB_URL` environment variable — the URL is
**never** committed. Set it in your environment (for Claude Code on the web, add
it to the environment's env vars; locally, export it or add to your shell rc):

```
KD_DB_URL=postgresql://kd_app:<password>@187.127.136.65:5432/kaala_dristi_db
```

Use a read-only role where possible. `kd_app` works (the server enforces
read-only transactions regardless), but a dedicated `readonly` role is cleaner.

## 2. Open a network path (required)

The DB is not reachable by default from a Claude Code web container — two walls:

1. **Environment egress policy.** The managed proxy denies non-allowlisted hosts
   (`403 CONNECT`). The environment's network policy must allow the DB host.
   See https://code.claude.com/docs/en/claude-code-on-the-web
2. **VPS firewall.** Port `5432` is open only to a fixed IP (see the infra doc,
   §2.4). A cloud container has no stable egress IP to whitelist.

**Recommended:** expose the DB behind an HTTPS domain via the existing Traefik
(as done for `llm.dristiq.io`) — e.g. PostgREST at `db.dristiq.io` — and allow
that host in the environment network policy. This is IP-independent and keeps
raw `5432` closed to the internet. If you go the PostgREST route instead of raw
Postgres, swap this connector for an HTTP-based one.

## 3. Verify

Once the env var is set and a network path is open, restart the Claude Code
session. The `kaala-postgres` tools appear automatically; ask Claude to run a
trivial query (e.g. `SELECT count(*) FROM km_index_symbols`) to confirm.

> Security: rotate the DB passwords and the PostgREST JWT secret currently
> printed in `docs/llm/Vikuna-Infrastructure-Documentation-v3.pdf` — that file
> exposes live production credentials in the repo.
