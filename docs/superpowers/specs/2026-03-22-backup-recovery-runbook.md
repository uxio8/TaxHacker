# Runbook de backup y recovery

Fecha: 2026-03-22  
Estado: preparado para `Phase G2`  
Ámbito: VM pequeña con `web + analysis-worker + PostgreSQL` y storage `local` o `s3`

## Objetivo

Tener un camino simple y repetible para:

- backup de base de datos
- backup de object storage o storage local
- restore completo
- restore parcial del contenido funcional expuesto por la app

## Capas a proteger

### 1. PostgreSQL

Contiene:

- dominio multitenant
- jobs de análisis
- referencias de storage
- estado fiscal

### 2. Storage

Contiene:

- adjuntos subidos
- PDFs generados
- assets estáticos
- previews regenerables

### 3. Configuración sensible mínima

- `.env.production`
- secretos operativos fuera del repo
- configuración del reverse proxy o tunnel

## Estrategia recomendada

### Base de datos

Backup lógico:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > taxhacker-$(date +%F-%H%M).dump
```

Frecuencia mínima inicial:

- diario si ya hay uso real
- antes de migraciones manuales
- antes de restore de prueba

### Storage local

Si `STORAGE_PROVIDER=local`, respaldar el volumen de datos o el árbol montado en `/app/data`.

Mínimo:

```bash
tar -czf taxhacker-storage-$(date +%F-%H%M).tgz data/
```

### Storage S3-compatible

Si `STORAGE_PROVIDER=s3`, el backup principal es:

- versioning del bucket, si existe
- export/copia del bucket por política externa

No asumir que el dump SQL basta: la BD guarda referencias, no el binario.

## Restore completo

### PostgreSQL

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  taxhacker-YYYY-MM-DD-HHMM.dump
```

### Storage local

Restaurar el volumen o el `tar.gz` del árbol `data/`.

### Storage S3-compatible

Restaurar bucket/objetos por la vía del proveedor antes de reabrir tráfico.

## Restore parcial funcional

La app ya expone backup/restore de datos y adjuntos desde:

- `app/(app)/settings/backups/actions.ts`
- `app/(app)/settings/backups/data/create-route.ts`
- `app/(app)/settings/backups/storage.ts`

Ese camino sirve para recovery funcional de tenant, no sustituye al backup infra completo.

Úsalo para:

- restaurar una organización
- validar que el zip contiene datos + blobs
- probar recovery en entorno temporal

No lo uses como único backup de producción de la VM.

## Validación obligatoria

Al menos una vez por ciclo:

1. restore de dump SQL en entorno temporal
2. restore de storage o muestra representativa de adjuntos
3. humo funcional:
   - login
   - lectura de transacciones
   - descarga de un adjunto
   - apertura de avatar/logo
   - consulta de inbox o análisis según entorno

## Recovery de emergencia

### Caso A: rompe la app pero la VM sigue viva

1. parar `app` y `analysis-worker`
2. restaurar base y storage si hace falta
3. levantar stack
4. validar humo antes de reabrir tráfico

### Caso B: falla la VM completa

1. recrear VM
2. desplegar con `docker-compose.prod.yml`
3. restaurar `.env.production`
4. restaurar PostgreSQL
5. restaurar storage
6. validar humo

## Riesgos residuales

- con PostgreSQL local en VM sigue habiendo un dominio único de fallo
- si el storage es local, el recovery depende de haber guardado también el volumen/binarios
- previews no son críticas porque se regeneran; los adjuntos y assets estáticos sí lo son

## Criterio de cierre

Este bloque se considera cerrado cuando:

- existe dump SQL repetible
- existe backup del storage coherente con el provider usado
- se ha probado al menos un restore temporal
- el equipo sabe distinguir `backup funcional de tenant` de `backup infra real`
