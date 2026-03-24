# Compatibility-First Refactor Gates Runbook

## Orden de verificación

1. `npm run lint`
2. `./node_modules/.bin/next typegen`
3. `./node_modules/.bin/tsc --noEmit --pretty false`
4. `node --test --experimental-strip-types tests/critical/contract.test.mjs tests/critical/env.test.mjs tests/critical/playwright-config.test.mjs tests/architecture/parser.test.mjs tests/architecture/boundaries.test.mjs`
5. `node --test --experimental-strip-types`
   - `tests/models/workflow/transaction-read-api.test.mjs`
   - `tests/app/workflow-transactions-slice-wiring.test.mjs`
   - `tests/app/transactions/fiscal-page.test.mjs`
   - `tests/app/transactions/fiscal-actions.test.mjs`
   - `tests/components/transactions/fiscal-panel-accessibility.test.mjs`
   - `tests/components/transactions/list-attention.test.mjs`
   - `tests/app/transactions/guided-ux-contract.test.mjs`
6. `node --test --experimental-strip-types`
   - `tests/models/workflow/fiscal-read-api.test.mjs`
   - `tests/app/workflow-fiscal-slice-wiring.test.mjs`
7. `node --test --experimental-strip-types`
   - `tests/models/fiscal/legal-archive.test.mjs`
   - `tests/models/fiscal/legal-archive-filings.test.mjs`
   - `tests/models/fiscal/tenant-scope.test.mjs`
   - `tests/models/organizations.test.mjs`
   - `tests/app/ops-dashboard.test.mjs`
8. `npm run build`
9. `npm run verify:critical`
   - solo cuando el runtime local esté arriba y Docker/Colima disponibles

## Go / No-Go

- `GO`:
  - `lint` de fuentes limpio
  - `tsc` verde después de regenerar `.next/types`
  - harness crítico y reglas de frontera en verde
  - slice fiscal en verde
  - slices `transactions`, `legal-archive` y `organizations/ops` en verde
  - `build` verde sin `ignoreDuringBuilds`
- `NO-GO`:
  - cualquier drift en wiring de slice
  - cualquier error de tipos en fachadas públicas
  - cualquier necesidad de tocar UI y dominio en el mismo write set para arreglar regresión

## Estado actual del repo

- `ignoreDuringBuilds`: eliminado
- `allowJs`: desactivado
- `skipLibCheck`: sigue activo

## Deuda residual aceptada

- `skipLibCheck` no se puede quitar aún sin resolver:
  - duplicidad entre `.next/types` y `.next.localdeploy/types`
  - ruido de tipos en dependencias externas (`better-auth`, `react-day-picker`, `@react-pdf/*`, `unplugin`)
- `verify:critical` completo depende de runtime local levantado; hoy queda bloqueado si Docker/Colima no están disponibles
