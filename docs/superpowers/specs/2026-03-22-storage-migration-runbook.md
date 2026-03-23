# Runbook de migración de storage legacy a claves canónicas

Fecha: 2026-03-22  
Estado: preparado para `Phase E2`  
Ámbito: mover referencias legacy de adjuntos y assets estáticos a claves `organizations/{organizationId}/...`

## Objetivo

Migrar el storage heredado por usuario/email al contrato canónico por organización sin mezclar este corte con cambios de dominio ni con borrado destructivo del origen.

## Qué migra este script

- `File.path` legacy:
  - `unsorted` -> `organizations/{organizationId}/uploads/unsorted/{fileId}{ext}`
  - `reviewed/transaction` -> `organizations/{organizationId}/uploads/transactions/{fileId}/{YYYY}/{MM}/{storedFilename}`
- assets estáticos de `User`:
  - `avatar`
  - `businessLogo`
  - pasan a URL canónica bajo `/files/static/organizations/{organizationId}/...`

## Qué no migra

- previews y derivados regenerables
- backups históricos ya exportados
- datos fiscales
- borrado del storage legacy después del corte

## Principios operativos

- idempotente:
  - si un registro ya es canónico, se salta
- no destructivo:
  - copia al destino
  - actualiza referencia en BD
  - deja el origen para rollback
- con alcance acotable:
  - `--organization=<uuid>`
  - `--limit=<n>`
  - `--dry-run`

## Preparación

1. levantar backup lógico de PostgreSQL
2. si el destino es S3, validar bucket/credenciales con el provider ya configurado
3. dejar el worker parado durante la ventana si se quiere máxima estabilidad
4. ejecutar primero en `dry-run`

## Comandos

Dry-run global:

```bash
node --experimental-strip-types scripts/migrate-storage.ts --dry-run
```

Dry-run por organización:

```bash
node --experimental-strip-types scripts/migrate-storage.ts --dry-run --organization=<organizationId>
```

Aplicación real limitada:

```bash
node --experimental-strip-types scripts/migrate-storage.ts --organization=<organizationId> --limit=50
```

Aplicación real completa:

```bash
node --experimental-strip-types scripts/migrate-storage.ts
```

## Qué revisar en el dry-run

- `processedFiles` cuadra con el número de `File.path` legacy esperados
- `processedStaticAssets` cuadra con `avatar`/`businessLogo` no canónicos
- `errors` está vacío o sólo contiene incidencias entendidas

No pasar a apply si:

- aparecen errores de lectura del origen
- el número de objetos a migrar es muy superior a lo esperado
- el provider S3 no responde o la base apunta a un entorno incorrecto

## Validación posterior al apply

1. consultar en BD una muestra de `File.path` y verificar prefijo `organizations/`
2. comprobar `avatar` y `businessLogo` en una muestra de usuarios
3. abrir:
   - preview
   - download
   - static avatar/logo
4. ejecutar:

```bash
node --test --experimental-strip-types tests/scripts/migrate-storage.test.mjs
npx tsc --noEmit --pretty false
npm run build
```

## Rollback

Como el origen no se borra, el rollback es de referencias, no de datos:

1. restaurar PostgreSQL desde backup previo al corte
2. mantener los objetos copiados en el destino sin usarlos
3. investigar el error antes de repetir la migración

No intentar rollback parcial manual de miles de registros salvo que el corte haya sido muy pequeño y perfectamente acotado.

## Riesgos residuales

- durante la migración puede convivir storage canónico con namespaces legacy
- la cuota tenant-aware puede seguir contando legacy y canónico mientras dure esa convivencia
- si el destino es S3 y el origen local, el ancho de banda/latencia de la VM manda el tiempo real del corte

## Criterio de cierre

La migración se da por cerrada cuando:

- las nuevas escrituras ya eran canónicas
- el script ha migrado el histórico relevante
- preview/download/static siguen funcionando
- no quedan rutas nuevas del producto escribiendo en namespaces legacy
