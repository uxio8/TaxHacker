# Runbook barato para usar TaxHacker en tu máquina

Fecha: 2026-03-23  
Estado: operativo  
Ámbito: uso personal o con muy pocos usuarios mientras se pule el producto antes de salir a mercado

## Objetivo

Tener una instalación barata y estable con:

- `app` en tu propia máquina
- `analysis-worker` en tu propia máquina
- PostgreSQL local en Docker
- storage local en `./data`
- acceso HTTPS desde ordenador y móvil mediante `Cloudflare Tunnel`
- backup diario simple y repetible

Esto deja la app lista para mover más adelante:

- `storage` a `R2/B2/S3`
- `PostgreSQL` a gestionado
- compute a VM o servicio gestionado

## Perfil recomendado ahora

Usa estos ficheros:

- `docker-compose.yml`
- `docker-compose.tunnel.yml`
- `.env`
- `.env.tunnel`
- `.env.localdeploy`

No uses todavía `docker-compose.prod.yml` para este caso. Ese perfil está pensado para VM dedicada.

## 1. Preparar entorno

### App

```bash
cp .env.example .env
cp .env.localdeploy.example .env.localdeploy
```

Ajustes mínimos recomendados en `.env`:

```dotenv
DOCKER_CONTEXT=colima-codex-loyalty
PORT=7331
SELF_HOSTED_MODE=true
SELF_HOSTED_ADMIN_TOKEN=pon-un-token-largo
DISABLE_SIGNUP=true
BETTER_AUTH_SECRET=pon-un-secreto-largo
UPLOAD_PATH=./data/uploads
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/taxhacker
```

Mantén `STORAGE_PROVIDER=local` por ahora.

### Tunnel

```bash
cp .env.tunnel.example .env.tunnel
```

Rellena `CLOUDFLARE_TUNNEL_TOKEN` con el token del túnel ya creado en Cloudflare Zero Trust.

En Cloudflare, el public hostname del túnel debe apuntar a:

- servicio: `http://host.docker.internal:7331`

Eso funciona porque `cloudflared` corre en Docker y reenvía al proceso `next start` que vive en el host.

## 2. Arranque diario

### Solo local

```bash
npm run local:start
```

### Local + acceso HTTPS desde fuera o desde el móvil

```bash
npm run local:start
```

Comandos de control:

```bash
npm run local:status
npm run local:stop
```

## 3. URLs de uso

- local: `http://localhost:7331/self-hosted`
- pública por túnel: tu dominio configurado en Cloudflare, por ejemplo `https://taxhacker.tudominio.com/self-hosted`

## 4. Backup diario

Se usa el script:

- `scripts/backup-local.ts`

Comando:

```bash
node --experimental-strip-types ./scripts/backup-local.ts
```

Qué hace:

- crea un dump lógico de PostgreSQL usando `docker compose exec -T postgres pg_dump`
- copia el árbol local `./data`
- escribe un `manifest.json`
- poda backups antiguos; por defecto conserva `7` días

Opciones útiles:

```bash
node --experimental-strip-types ./scripts/backup-local.ts --keep-days=14
node --experimental-strip-types ./scripts/backup-local.ts --backup-root=./backups/local
node --experimental-strip-types ./scripts/backup-local.ts --skip-storage
```

## 5. Programarlo a diario

### Opción simple en macOS con `launchd`

Ya existe un instalador en el repo:

```bash
./scripts/install-backup-launchd.sh
```

Eso deja cargado `com.taxhacker.backup-local` a las `03:15` todos los días.

Para comprobarlo:

```bash
launchctl list com.taxhacker.backup-local
```

`launchd` se usa solo para el backup. El runtime local de `app` y `analysis-worker` se arranca con `tmux` porque en macOS los jobs de `launchd` pueden fallar al ejecutar un repo dentro de `Documents`.

### Opción simple con cron

```bash
crontab -e
```

Ejemplo a las 03:15:

```cron
15 3 * * * cd /ruta/a/taxhacker && /usr/bin/env node --experimental-strip-types ./scripts/backup-local.ts >> ./backups/local/backup.log 2>&1
```

## 6. Qué guardar fuera de la máquina

Aunque hoy uses storage local, conviene sacar fuera de la máquina al menos:

- `./backups/local`
- `.env`
- `.env.tunnel`

Si quieres hacerlo barato:

- copia `./backups/local` a un disco externo
- o súbelo a `R2`/`B2`

## 6.bis Qué sigue faltando para el túnel

El repo ya deja preparado:

- `docker-compose.tunnel.yml`
- `.env.tunnel`
- `.env.localdeploy`

Lo único externo que sigue haciendo falta es:

- pegar tu `CLOUDFLARE_TUNNEL_TOKEN` real en `.env.tunnel`
- tener creado en Cloudflare el túnel y el hostname público que apunte a `http://host.docker.internal:7331`

## 7. Cuándo dejar de usar este perfil

Este perfil deja de ser el recomendado si pasa alguna de estas cosas:

- lo usáis varias personas a diario
- necesitas uptime serio si tu máquina se apaga
- quieres depender menos de tu red doméstica
- el tamaño de `./data` o el tiempo de análisis ya molestan

En ese punto:

1. mueve storage a `R2/B2/S3`
2. mueve PostgreSQL a gestionado
3. mueve `app + worker` a VM o compute gestionado

## 8. Riesgos residuales

- si la máquina se apaga, cae todo
- PostgreSQL y storage siguen en el mismo host
- el túnel no sustituye a una estrategia de backup
- el análisis sigue dependiendo de que `analysis-worker` esté levantado

## 9. Criterio de éxito

Este perfil se considera bien montado cuando:

- puedes entrar desde móvil por HTTPS
- el análisis funciona con `analysis-worker` levantado
- el backup diario genera dump + copia de `data`
- puedes seguir desarrollando sin rehacer infraestructura todavía
