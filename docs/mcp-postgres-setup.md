# Postgres MCP Connector — Setup (v2, working architecture)

Goal: give Claude Code **read-only SQL** access to `kaala_dristi_db` via the
`kaala-postgres` MCP connector.

> **Why v1 never worked:** the previous plan ran the MCP server *inside* the
> Claude Code container and dialed the VPS on `5432`. That is impossible in the
> managed environment — outbound raw TCP is blocked (verified 2026-07-10:
> `5432` unreachable, and even HTTPS to non-allowlisted hosts gets a `403`
> policy denial from the environment proxy), and the VPS firewall only opens
> `5432` to a fixed IP the cloud container doesn't have. The 2026-07-06
> handover recorded it as "never successfully connected".

## v2 architecture

Run the MCP server **on the VPS** (next to the DB), expose it over **HTTPS via
Traefik** — same pattern as `llm.dristiq.com` — and let Claude Code connect as a
remote SSE server through the environment proxy.

```
Claude Code container ──HTTPS (proxy-allowlisted)──▶ Traefik (mcp-db.dristiq.com, basic-auth, TLS)
                                                        └─▶ postgres-mcp (--access-mode=restricted, SSE)
                                                              └─▶ postgres :5432 (role kd_readonly, local only)
```

**Read-only is enforced at three independent layers:**
1. **DB role** — `kd_readonly` has SELECT-only grants and
   `default_transaction_read_only = on` (SQL below).
2. **MCP server** — [`crystaldba/postgres-mcp`](https://github.com/crystaldba/postgres-mcp)
   in `--access-mode=restricted`: read-only transactions, statement limits.
3. **No write path** — the connector never sees a writable credential; the
   `kd_readonly` password can be rotated at any time without touching the repo
   (it lives only in the VPS compose env).

---

## Step 1 — DB role hardening (run as superuser in psql/pgAdmin on the VPS)

```sql
-- Create the role if it doesn't exist yet (temporary password — rotate in step 5)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kd_readonly') THEN
    CREATE ROLE kd_readonly LOGIN PASSWORD 'CHANGE_ME_TEMP';
  END IF;
END $$;

-- Harden: no elevated capabilities, read-only by default, bounded queries
ALTER ROLE kd_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE kd_readonly SET default_transaction_read_only = on;
ALTER ROLE kd_readonly SET statement_timeout = '30s';

-- Grants: SELECT-only, everything, now and for future tables
GRANT CONNECT ON DATABASE kaala_dristi_db TO kd_readonly;
GRANT USAGE ON SCHEMA public TO kd_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO kd_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO kd_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO kd_readonly;

-- Belt-and-braces: strip any write grants that may exist from older scripts
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM kd_readonly;

-- Verify (expect t / t / f)
SELECT has_table_privilege('kd_readonly','km_astro_rule_master','SELECT') AS can_read_rules,
       has_table_privilege('kd_readonly','km_equity_eod','SELECT')        AS can_read_eod,
       has_table_privilege('kd_readonly','km_equity_eod','INSERT')        AS can_write;
```

Repeat the `GRANT SELECT` block on **`vani_db`** too if VaNi tables should be
inspectable (optional; a second MCP entry would be needed to point at it).

## Step 2 — DNS + VPS service

1. DNS: add an A record `mcp-db.dristiq.com` → VPS IP (same as `llm.dristiq.com`).
2. Add this service to the VPS compose stack (or run standalone). Adjust the
   Traefik network/certresolver names to whatever `llm.dristiq.com` uses:

```yaml
  kd-mcp-db:
    image: crystaldba/postgres-mcp:latest
    container_name: kd-mcp-db
    restart: unless-stopped
    command: ["--access-mode=restricted", "--transport=sse"]
    environment:
      # If postgres runs on the host: host.docker.internal (with extra_hosts below).
      # If postgres is a container on the same docker network: use its service name.
      - DATABASE_URI=postgresql://kd_readonly:${KD_READONLY_PASSWORD}@host.docker.internal:5432/kaala_dristi_db
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks: [vikuna-net]
    labels:
      - traefik.enable=true
      - traefik.http.routers.kd-mcp-db.rule=Host(`mcp-db.dristiq.com`)
      - traefik.http.routers.kd-mcp-db.entrypoints=websecure
      - traefik.http.routers.kd-mcp-db.tls.certresolver=le
      - traefik.http.services.kd-mcp-db.loadbalancer.server.port=8000
      - traefik.http.routers.kd-mcp-db.middlewares=kd-mcp-auth
      # htpasswd-format user:hash — generate with: htpasswd -nbB claude '<password>'
      # (escape $ as $$ if inlining in compose; cleaner to keep in .env)
      - traefik.http.middlewares.kd-mcp-auth.basicauth.users=${KD_MCP_HTPASSWD}
```

Set in the VPS `.env` (never committed): `KD_READONLY_PASSWORD`, `KD_MCP_HTPASSWD`.
Then `docker compose up -d kd-mcp-db`.

Sanity check from any machine:
`curl -u claude:<password> https://mcp-db.dristiq.com/sse` → should open an SSE
stream (event: endpoint), not 401/404.

## Step 3 — Claude Code environment settings (claude.ai)

In the environment used for these sessions:
1. **Network policy**: allow `mcp-db.dristiq.com` (this is the wall that
   currently 403s everything — nothing works until this is added).
2. **Environment variable**: `KD_MCP_BASIC` = `base64("claude:<password>")`,
   e.g. `echo -n 'claude:<password>' | base64`.

## Step 4 — Connect

`/.mcp.json` (committed, no secrets) registers the connector:

```json
{
  "mcpServers": {
    "kaala-postgres": {
      "type": "sse",
      "url": "https://mcp-db.dristiq.com/sse",
      "headers": { "Authorization": "Basic ${KD_MCP_BASIC}" }
    }
  }
}
```

Start a **new session** (project-scoped MCP servers load at session start and
may prompt for approval). Verify with a trivial query:
`SELECT count(*) FROM km_index_symbols;` (expect 93).

## Step 5 — Rotate credentials (after verifying it works)

- Change the `kd_readonly` password:
  `ALTER ROLE kd_readonly PASSWORD '<new>';` → update `KD_READONLY_PASSWORD`
  in the VPS `.env` → `docker compose up -d kd-mcp-db`. Nothing in the repo or
  the Claude environment changes (the basic-auth password is independent).
- While at it: rotate the production DB passwords and PostgREST JWT secret
  exposed in `docs/llm/Vikuna-Infrastructure-Documentation-v3.pdf`, and remove
  that file from the repo/history.

## Notes

- `.mcp.json` lives on the current working branch; sessions started from `main`
  won't pick it up until this lands in `main`.
- If you'd rather not run a new container, the fallback is exposing PostgREST
  (`db.dristiq.com`) and using an HTTP/PostgREST-based MCP — but that gives REST
  filters, not real SQL (no `GROUP BY month` coverage queries), so the
  postgres-mcp route above is strongly preferred for audit work.
