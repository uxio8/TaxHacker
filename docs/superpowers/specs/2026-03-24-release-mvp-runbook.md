# Release MVP Runbook

Objetivo: desplegar una imagen concreta por SHA y comprobar desde fuera que la instancia corre esa misma build.

## Precondiciones

- La SHA ya existe en `main`.
- GHCR ya tiene publicada la imagen `ghcr.io/<owner>/ledgerflow:sha-<sha-corta>`.
- Tienes acceso al runtime real de `tax.agentworklab.com`.

## Deploy manual por SHA

1. Elegir la SHA a desplegar.
2. Resolver el tag de imagen:
   - `ghcr.io/<owner>/ledgerflow:sha-<sha-corta>`
3. Configurar el runtime con:
   - `APP_BUILD_SHA=<sha-completa>`
   - `APP_ENVIRONMENT=production` solo si aporta señal operativa real
4. Desplegar esa imagen exacta sin reconstruirla.
5. Comprobar la instancia:
   - `curl -fsSL https://tax.agentworklab.com/api/health`
6. Verificar que el JSON devuelve:
   - `ok: true`
   - `buildSha` igual a la SHA desplegada
   - `version` y `environment` coherentes
7. Opcionalmente, ejecutar:
   - `npm run release:check -- --url=https://tax.agentworklab.com/api/health --sha=<sha-completa>`

## Rollback mínimo

1. Identificar la SHA anterior conocida como buena.
2. Repetir el deploy usando su tag `sha-<sha-corta>`.
3. Volver a comprobar `GET /api/health`.
4. Confirmar que `buildSha` vuelve a la SHA anterior.

## Contrato operativo

- Producción debe correr una imagen trazable por SHA.
- `APP_BUILD_SHA` debe inyectarse desde el deploy real, no inferirse en runtime.
- El éxito del deploy se confirma comparando la SHA visible en `/api/health`, no solo porque el contenedor arranque.
