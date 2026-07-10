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

## Step 2 — DNS + VPS service (nginx variant — the actual stack)

> Discovered 2026-07-10 on `187.127.136.65` (`srv1528480`): there is **no
> Traefik** on this box — TLS is terminated by the `vikuna-nginx` container
> (80/443), and Postgres runs as the `vikuna-postgres` container. `llm.dristiq.com`
> resolves to a *different* server (72.60.222.136), so its setup is not the
> pattern here.

1. **DNS**: A record — Name `mcp-db`, Value `187.127.136.65`.

2. **MCP container** (same docker network as postgres):
```bash
NET=$(docker inspect vikuna-postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')
docker run -d --name kd-mcp-db --restart unless-stopped --network "$NET" \
  -e DATABASE_URI="postgresql://kd_readonly:<TEMP_PASSWORD>@vikuna-postgres:5432/kaala_dristi_db" \
  crystaldba/postgres-mcp --access-mode=restricted --transport=sse --sse-host=0.0.0.0 --sse-port=8000
```

3. **Certificate** (~10 s downtime; certbot standalone borrows port 80):
```bash
apt install -y certbot
docker stop vikuna-nginx && certbot certonly --standalone -d mcp-db.dristiq.com && docker start vikuna-nginx
# one-time renewal hooks:
printf 'pre_hook = docker stop vikuna-nginx\npost_hook = docker start vikuna-nginx\n' \
  >> /etc/letsencrypt/renewal/mcp-db.dristiq.com.conf
```

4. **Basic-auth file**:
```bash
printf "claude:$(openssl passwd -apr1 '<MCP_PASSWORD>')\n" > /root/mcp.htpasswd
```

5. **nginx vhost** — add to the config mounted into `vikuna-nginx`
   (`docker inspect vikuna-nginx --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'`
   shows where; ensure `/etc/letsencrypt` and `/root/mcp.htpasswd` are mounted
   read-only into the container, and that `vikuna-nginx` shares a network with
   `kd-mcp-db` — `docker network connect "$NET" vikuna-nginx` if not):

```nginx
server {
    listen 443 ssl;
    server_name mcp-db.dristiq.com;

    ssl_certificate     /etc/letsencrypt/live/mcp-db.dristiq.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp-db.dristiq.com/privkey.pem;

    auth_basic "kaala-mcp";
    auth_basic_user_file /etc/nginx/mcp.htpasswd;

    location / {
        proxy_pass http://kd-mcp-db:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        proxy_buffering off;        # required for SSE
        proxy_cache off;
        proxy_read_timeout 1h;
    }
}
```

```bash
docker exec vikuna-nginx nginx -t && docker restart vikuna-nginx
```

Sanity check from any machine:
`curl -u claude:<MCP_PASSWORD> https://mcp-db.dristiq.com/sse --max-time 5` →
should open an SSE stream (`event: endpoint`), not 401/404/502 (502 = nginx
can't reach `kd-mcp-db`; connect the networks as above).

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
