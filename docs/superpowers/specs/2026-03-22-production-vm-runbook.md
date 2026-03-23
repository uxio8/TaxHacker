# Production VM Runbook

## Boundary

- Service path: `Dockerfile` -> `docker-compose.prod.yml` -> `app` + `analysis-worker` + bundled `postgres`
- Environment: single small VM, local Docker volumes, reverse proxy or tunnel outside this compose file
- Dependency edges:
  - `app` -> PostgreSQL + shared `/app/data` volume + configurable storage provider env
  - `analysis-worker` -> PostgreSQL + shared `/app/data` volume + configurable storage provider env
  - `postgres` -> local persistent volume only

## Confirmed Issues And Assumptions

- Confirmed: the existing production compose file did not include healthchecks, so Docker could not distinguish booting from unhealthy containers.
- Confirmed: the web container can autostart a detached analysis worker unless `ANALYSIS_WORKER_AUTOSTART=false` is forced.
- Confirmed: `Dockerfile` ended on `npm start`, which re-runs `prisma migrate deploy` after the entrypoint already did it once.
- Assumption: the cheapest correct first production profile is a single VM with local PostgreSQL and either local storage or S3-compatible object storage.
- Assumption: TLS termination is handled by a reverse proxy, tunnel, or load balancer in front of `127.0.0.1:7331`.

## Smallest Safe Profile

- `docker-compose.prod.yml` is the supported production entrypoint for this profile.
- It builds one local image and reuses it for `app` and `analysis-worker`.
- PostgreSQL stays private inside Compose. No host port is published.
- `app` listens on `127.0.0.1:7331` only, reducing accidental exposure on a raw VM.
- Both application services share the same `/app/data` volume, which is required for local storage, previews and the worker heartbeat.
- `ANALYSIS_WORKER_AUTOSTART=false` is forced on the web service so only the dedicated worker processes jobs.
- Healthchecks cover:
  - `postgres`: `pg_isready`
  - `app`: HTTP response on `/`
  - `analysis-worker`: fresh heartbeat file under `/app/data/runtime`
- Restart policy is `unless-stopped` for all services.
- Log rotation is capped to `10m x 3` per container to avoid filling small disks.

## Required Environment

Copy the template and edit the secrets:

```bash
cp .env.production.example .env.production
openssl rand -base64 32
```

Minimum variables to set before first boot:

- `BASE_URL`: public HTTPS URL
- `SELF_HOSTED_ADMIN_TOKEN`: shared admin unlock token
- `BETTER_AUTH_SECRET`: long random secret
- `POSTGRES_PASSWORD`: password used by both `postgres` and `DATABASE_URL`
- `DATABASE_URL`: keep host `postgres` while the bundled database is enabled

Storage modes:

- Cheapest default: `STORAGE_PROVIDER=local`
- Object storage: set `STORAGE_PROVIDER=s3` plus the `STORAGE_S3_*` variables

Analysis provider modes:

- UI-managed provider keys: leave provider env vars empty and configure later inside the app
- Environment-managed providers: fill `OPENAI_*`, `GOOGLE_*`, `MISTRAL_*`, or `POOL_CLOUD_*`

## First Deployment

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 app
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 analysis-worker
```

Healthy boot looks like this:

- `postgres` becomes `healthy`
- `app` becomes `healthy` after migrations and Next.js startup
- `analysis-worker` becomes `healthy` after it writes a recent heartbeat file

## Failure Path

If `postgres` is unhealthy:

- Check `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB` in `.env.production`
- Inspect logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 postgres
```

If `app` is unhealthy:

- Check migration or auth secret errors:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=150 app
```

- Confirm the rendered config still points to the private database host:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app printenv DATABASE_URL
```

If `analysis-worker` is unhealthy:

- Inspect worker logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=150 analysis-worker
```

- Confirm the heartbeat file exists and updates:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec analysis-worker ls -l /app/data/runtime
docker compose --env-file .env.production -f docker-compose.prod.yml exec analysis-worker cat /app/data/runtime/analysis-worker-heartbeat.json
```

Common causes:

- bad database URL
- missing storage credentials when `STORAGE_PROVIDER=s3`
- no analysis provider configured for the workload being executed

## Recovery And Rollback

Normal restart path:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Safe rollback path after a bad deploy:

1. Checkout the previous known-good git revision.
2. Rebuild and restart with the same `.env.production` and Docker volumes.
3. Verify `docker compose --env-file .env.production -f docker-compose.prod.yml ps` returns healthy services again.

If the VM is too small for local PostgreSQL later:

1. Move the database to a managed PostgreSQL instance.
2. Update `DATABASE_URL` in `.env.production`.
3. Stop and remove the `postgres` service from the compose file in a separate change.

## Validation Checklist

- Normal path: `docker compose --env-file .env.production -f docker-compose.prod.yml up -d` reaches healthy `postgres`, `app`, and `analysis-worker`
- Failure path: an invalid `POSTGRES_PASSWORD` should keep `app` and `analysis-worker` unhealthy with actionable logs
- Recovery path: restoring the previous `.env.production` or git revision and rerunning `up -d --build` should recover the stack without deleting volumes

## Residual Risk And Follow-Up

- Local PostgreSQL on one VM is acceptable for a cheap first production profile, but it is still a single-node failure domain.
- The compose file intentionally keeps the app bound to loopback only; a reverse proxy, tunnel, or firewall rule still needs live validation on the target VM.
- The worker still depends on the same image entrypoint as the web app, so both services wait for PostgreSQL and run Prisma setup before starting their main process.
- Next follow-up in priority order:
  1. Pin deployment to a git SHA or registry tag instead of ad hoc local builds if you need repeatable rollbacks across multiple VMs.
  2. Add external monitoring for container health and disk usage.
  3. Move PostgreSQL off-box before scaling beyond a single low-traffic tenant.
