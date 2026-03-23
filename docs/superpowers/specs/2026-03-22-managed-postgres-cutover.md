# Corte de PostgreSQL local en VM a PostgreSQL gestionado

Fecha: 2026-03-22  
Estado: preparado para foundation closeout G3  
Ámbito: plano de datos de producción para `app` + `analysis-worker` en arquitectura multitenant `shared database` + `shared schema`, manteniendo compute en VM pequeña

## 1. Objetivo y límite exacto

Este documento cierra únicamente el paso de mover la base de datos desde el `postgres` local de `docker-compose.prod.yml` a un PostgreSQL gestionado.

Queda dentro del límite:

- `app` y `analysis-worker` siguiendo en la misma VM pequeña
- mismo contrato lógico multitenant por `organizationId`
- mismo contrato de storage, local o S3-compatible, sin rediseñarlo aquí
- mismo flujo de jobs asíncronos, que siguen usando PostgreSQL como cola de coordinación

Queda fuera del límite:

- pasar web o worker a compute gestionado
- rediseñar tenancy, Prisma o modelo de dominio
- introducir dual write, replicación lógica o replatform completo
- tocar `ORCHESTRATOR.md` o código de producto

## 2. Boundary operativo analizado

### Plano de control

- despliegue actual: `Dockerfile` -> `docker-compose.prod.yml`
- configuración sensible: `.env.production`
- entrada externa: reverse proxy o tunnel delante de `127.0.0.1:7331`

### Plano de datos

- hoy `app` y `analysis-worker` dependen del servicio `postgres` del compose
- el worker reclama y actualiza `analysisJob` directamente en PostgreSQL
- el estado runtime del worker vive en `/app/data/runtime`, no en la base de datos

### Bordes de dependencia

- `app` -> PostgreSQL para lecturas/escrituras del dominio multitenant
- `analysis-worker` -> PostgreSQL para cola de jobs, persistencia de resultados y lecturas auxiliares
- `app` + `analysis-worker` -> `/app/data` compartido para heartbeat y storage local temporal
- `app` + `analysis-worker` -> storage provider configurable (`local` o `s3`)

## 3. Hechos confirmados y supuestos

### Confirmado en el repo

- `docker-compose.prod.yml` levanta `app`, `analysis-worker` y `postgres`; tanto `app` como `analysis-worker` esperan a que `postgres` esté sano antes de arrancar.
- `.env.production.example` apunta a `DATABASE_URL=...@postgres:5432/...` en producción VM.
- `lib/analysis-worker.ts` usa PostgreSQL como backend de coordinación para `analysisJob`; no hay cola separada.
- `docs/superpowers/specs/2026-03-22-storage-contract.md` ya deja el storage preparado para provider `local` o `s3` sin cambiar el dominio.
- `lib/storage/s3.ts` confirma que el provider S3-compatible ya existe en el código.

### Supuestos que siguen pendientes de validación en cloud real

- la instancia gestionada estará en la misma región que la VM para evitar latencia evitable
- el proveedor gestionado ofrece TLS, backups automáticos y PITR
- el volumen de producción sigue siendo lo bastante bajo como para aceptar una ventana corta de mantenimiento con parada total de escrituras
- si el despliegue sigue en `STORAGE_PROVIDER=local`, ese storage permanece en la VM y no forma parte de este corte

## 4. Riesgo concreto

El `postgres` local deja a `app`, `analysis-worker` y la persistencia principal en el mismo dominio de fallo de una sola VM. Si el host falla, se pierde la disponibilidad de web, worker y base de datos a la vez. Además, el crecimiento de CPU/RAM del host compite contra la base de datos y complica diferenciar si el cuello está en compute o en data plane.

## 5. Recomendación mínima y por qué

La recomendación mínima segura es:

- mover solo PostgreSQL a un servicio gestionado
- mantener `app` y `analysis-worker` en la VM
- mantener el contrato multitenant `shared schema`
- no mezclar este cambio con compute gestionado ni con una migración de storage

Se prefiere esta opción porque reduce el dominio de fallo principal y mejora backup/restore sin abrir más superficie de cambio de la necesaria. También conserva una ruta de rollback clara: volver a apuntar `DATABASE_URL` al `postgres` local mientras el volumen antiguo siga intacto.

## 6. Criterios previos obligatorios

Antes de abrir ventana de corte, deben cumplirse estos mínimos:

| Área | Criterio mínimo |
| --- | --- |
| Red | PostgreSQL gestionado accesible solo desde la VM o desde una allowlist concreta; TLS activado. |
| Compatibilidad | Misma versión mayor de PostgreSQL que la VM o una combinación validada por `pg_dump`/`pg_restore`. |
| Capacidad | Límite de conexiones suficiente para `app`, `analysis-worker`, Prisma y sesiones operativas. |
| Backups gestionados | Backups automáticos activados y PITR habilitado con retención mínima de 7 días para beta técnica. |
| Restore | Restore de prueba completado en una base temporal del proveedor gestionado antes del corte real. |
| Observabilidad | Métricas mínimas disponibles: CPU, conexiones, storage, lag de checkpoint o saturación equivalente del proveedor. |
| Seguridad | Credenciales nuevas y separadas del `postgres` local; no reutilizar contraseñas viejas. |

## 7. Secuencia de corte recomendada

### 7.1 Preparación previa

1. Crear la base gestionada y el usuario de aplicación.
2. Aplicar red privada o allowlist solo para la VM actual.
3. Ejecutar un backup lógico del origen local:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > taxhacker-precutover.dump
```

4. Restaurar ese dump en una base temporal gestionada y validar que Prisma y lecturas básicas funcionan.
5. Medir latencia desde la VM al nuevo endpoint con al menos 20 ejecuciones de `SELECT 1`.

### 7.2 Ventana de corte

1. Drenar tráfico en el reverse proxy o tunnel para impedir escrituras nuevas.
2. Parar primero `analysis-worker` para que deje de reclamar jobs.
3. Parar `app` para cerrar escrituras de usuario.
4. Tomar el dump final:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml stop analysis-worker app
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > taxhacker-final.dump
```

5. Restaurar el dump final en la base gestionada objetivo:

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$MANAGED_DATABASE_URL" \
  taxhacker-final.dump
```

6. Cambiar `DATABASE_URL` en `.env.production` al endpoint gestionado.
7. Levantar `app` y `analysis-worker`.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app analysis-worker
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

### 7.3 Regla operativa clave

No se reabre tráfico hasta completar el checklist de humo del apartado 8. Si falla algo antes de reabrir tráfico, el rollback sigue siendo limpio porque no hay escrituras nuevas divergentes en la base gestionada.

## 8. Checklist de go/no-go

### 8.1 Latencia

El corte solo pasa si se cumple uno de estos criterios:

- `SELECT 1` desde la VM al PostgreSQL gestionado no supera `2x` la baseline local medida el mismo día
- y además la mediana está por debajo de `15 ms` y el `p95` por debajo de `50 ms`

Si no existe baseline local registrada, usar temporalmente el criterio absoluto y dejar constancia de la medición.

### 8.2 Backups y restore

- existe backup lógico final de la base local guardado fuera de la VM
- el proveedor gestionado ya tiene backups automáticos y PITR activos
- el restore de prueba en una base temporal gestionada se ha ejecutado sin errores críticos

### 8.3 Humo funcional

El humo mínimo debe cubrir un camino normal, uno de fallo y uno de recuperación inmediata:

| Camino | Validación mínima |
| --- | --- |
| Normal | `app` sana, `analysis-worker` sano, login o navegación autenticada básica, lectura de datos tenant-owned y una escritura simple del dominio. |
| Fallo | Encolar un `analysisJob` sin proveedor válido o con un proveedor controlado para confirmar que el worker puede reclamar, actualizar estado y persistir el error en la nueva BD. |
| Recuperación | Reiniciar `analysis-worker` y verificar que el heartbeat se rehace y la cola sigue consultable tras reconectar a la BD gestionada. |

Se permite cerrar el humo funcional con un único job de análisis si el entorno tiene poco tráfico. Lo importante es validar la ruta `cola en BD -> claim -> update de estado -> persistencia`.

## 9. Rollback y contención

### Rollback limpio

Procede si el fallo aparece antes de reabrir tráfico:

1. Parar `app` y `analysis-worker`.
2. Restaurar el `DATABASE_URL` antiguo apuntando a `postgres`.
3. Levantar de nuevo `app` y `analysis-worker`.
4. Mantener la base gestionada aislada hasta investigar.

### Rollback sucio

Si ya se ha reabierto tráfico y hubo escrituras en la base gestionada, el rollback deja de ser instantáneo. En ese caso hay que elegir entre:

- mantener la base gestionada y corregir el problema in situ
- o extraer un dump nuevo desde la gestionada antes de volver a la local

Por eso el criterio correcto es no reabrir tráfico hasta cerrar el humo.

## 10. Validación realizada y validación pendiente

### Validado en repositorio

- la dependencia actual de `app` y `analysis-worker` respecto a `postgres` del compose
- que la cola del worker y la persistencia de resultados están en PostgreSQL
- que el storage ya tiene vía S3-compatible y no obliga a mezclar este cambio con storage

### Requiere validación en entorno real

- latencia real VM -> PostgreSQL gestionado
- límites de conexiones del proveedor
- coste y ventana real de restore bajo el tamaño actual de la base
- reglas concretas de firewall, VPC o allowlist
- comportamiento de Prisma bajo TLS y endpoint gestionado del proveedor elegido

## 11. `scripts/db-cutover-check.ts`

Ya existe un preflight ligero en `scripts/db-cutover-check.ts`.

Su límite exacto es intencionadamente pequeño:

- valida que `DATABASE_URL` y `MANAGED_DATABASE_URL` existan
- valida que origen y destino no coincidan
- exige TLS explícito en `MANAGED_DATABASE_URL`
- verifica disponibilidad local de `pg_dump`, `pg_restore` y `pg_isready`
- puede lanzar una sonda simple de conectividad con `pg_isready`

No sustituye el runbook ni automatiza el corte. Sirve para detectar antes de tiempo errores básicos de configuración y tooling.

Uso mínimo:

```bash
node --experimental-strip-types ./scripts/db-cutover-check.ts --skip-connectivity
```

Uso con sonda de conectividad:

```bash
MANAGED_DATABASE_URL='postgresql://...?...sslmode=require' \
node --experimental-strip-types ./scripts/db-cutover-check.ts
```

Se puede sobrescribir por CLI:

```bash
node --experimental-strip-types ./scripts/db-cutover-check.ts \
  --database-url='postgresql://postgres:...@postgres:5432/taxhacker?schema=public' \
  --managed-url='postgresql://user:...@managed.example.com:5432/taxhacker?sslmode=require'
```

El script no ejecuta `pg_dump` ni `pg_restore`; esas operaciones siguen siendo pasos deliberados del runbook para mantener el corte auditable.

## 12. Riesgo residual y siguientes pasos

Riesgo residual tras este corte:

- `app` y `analysis-worker` seguirán compartiendo una sola VM, así que el compute seguirá siendo un único dominio de fallo
- si el storage sigue en modo `local`, los artefactos de disco continúan ligados a la VM aunque la BD ya no lo esté
- el coste operativo del proveedor gestionado y sus límites reales aún deben validarse con carga de producción

Siguientes pasos por prioridad:

1. Ejecutar restore de prueba en PostgreSQL gestionado temporal.
2. Registrar baseline local de latencia antes del corte real.
3. Hacer el corte de BD sin mezclarlo con cambios de compute.
4. Usar el documento `2026-03-22-compute-replatform-trigger.md` para decidir cuándo la VM deja de ser suficiente.
