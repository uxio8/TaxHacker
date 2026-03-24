# Multitenant Foundation Closeout Implementation Plan

**Estado**: ejecutado y verificado el 22 de marzo de 2026. El bloque completo A1-G3 queda cerrado en el repo, con verificación integrada y documentación de operación/cutover al día.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cerrar el remanente real del foundation hardening multitenant para dejar TaxHacker listo para beta técnica con tenancy sólido, storage S3-ready y runtime `web + worker` desacoplado de la máquina.

**Architecture:** este plan no reabre las fases ya cerradas. Se centra en los huecos reales que quedan: cuota y storage multiempresa, previews/derivados, provider S3, tooling de migración, fiscal tenant-aware, runtime del worker y perfil de despliegue barato pero correcto. El backlog funcional fiscal anual (`390/180/347/200`, `111/190`, `VERI*FACTU`) queda fuera y se mantiene como roadmap de producto.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, PostgreSQL, Node worker, storage provider local + S3-compatible, Docker Compose, AWS VM/S3 ahora, PostgreSQL gestionado después.

---

## Estado de partida

- Ya están cerradas `Phase 0`, `Phase 1` y la mayor parte de `Phase 2`.
- `Transaction`, `File`, `AnalysisJob`, `Progress` y configuración principal ya escriben o leen con `organizationId`.
- La base de `storage abstraction` ya existe:
  - `lib/storage/types.ts`
  - `lib/storage/index.ts`
  - `lib/storage/local.ts`
  - `lib/storage/keys.ts`
  - `lib/storage/paths.ts`
  - `lib/storage/usage.ts`
- Las subidas nuevas ya persisten claves canónicas bajo `organizations/{organizationId}/...`.
- Pendientes reales confirmados:
  - preflight de cuota aún no es 100% tenant-aware en organizaciones con varios miembros
  - el conteo legacy durante migración aún puede infracontar namespaces históricos de varios miembros
  - previews y derivados siguen siendo el siguiente corte lógico
  - fiscal aún no está completamente reconciliado con `Organization`
  - falta provider S3, tooling de migración y cierre del runtime/infra

## Out Of Scope

- Modelos fiscales anuales:
  - `390`
  - `180`
  - `347`
  - `200`
- `111` automatizado
- `190`
- track `VERI*FACTU`
- plataforma multiagente
- Kubernetes, Redis, Temporal o microservicios

## Global Delivery Rules

- Orquestación:
  - `writing-plans`
  - `subagent-driven-development`
  - `requesting-code-review`
- Skills obligatorias para implementadores:
  - `test-driven-development`
  - `verification-before-completion`
- Skills obligatorias cuando aplique:
  - `systematic-debugging` para cuotas, migraciones, backfills, previews y runtime
  - `using-git-worktrees` si una tarea toca `Prisma + storage + runtime` a la vez
- Cada tarea cierra con:
  - tests dirigidos del write set
  - lint del write set
  - `npx tsc --noEmit --pretty false`
- `ORCHESTRATOR.md` lo actualiza solo el orquestador al aprobar el bloque.

## Phase A: Storage Accounting And Quota Correctness

### Task A1: Tenant Quota Source Of Truth

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `lib/files.ts`
- Modify: `models/uploads.ts`
- Modify: `models/mobile/capture.ts`
- Modify: `app/(app)/files/actions.ts`
- Modify: `app/(app)/transactions/actions.ts`
- Modify: `app/(app)/unsorted/actions.ts`
- Create: `tests/lib/storage/tenant-quota.test.mjs`

**Must not touch**
- `prisma/schema.prisma`
- `components/*`
- `ORCHESTRATOR.md`

- [ ] Hacer que el preflight de cuota use una verdad tenant-aware calculada, no `user.storageUsed` stale.
- [ ] Decidir si `user.storageUsed` pasa a ser cache derivada o deja de usarse para admisión.
- [ ] Mantener compatibilidad con self-hosted actual.
- [ ] Verificar con:
  - tests de quota preflight con dos miembros en la misma organización
  - tests de rollback cuando no hay espacio
  - smoke test de upload móvil y upload de escritorio

### Task A2: Legacy Namespace Aggregation During Migration

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `lib/storage/usage.ts`
- Modify: `lib/files.ts`
- Modify: `models/memberships.ts`
- Create: `tests/lib/storage/legacy-usage-aggregation.test.mjs`

**Must not touch**
- UI
- `app/(app)/tax/*`
- `ORCHESTRATOR.md`

- [ ] Contar durante la migración todos los namespaces legacy relevantes de los miembros de una organización.
- [ ] Evitar doble conteo entre namespace canónico y namespaces legacy.
- [ ] Dejar explícito el contrato temporal para apagar esta compatibilidad más adelante.
- [ ] Verificar con:
  - tests de organización con varios miembros y varios namespaces históricos
  - tests de deduplicación

## Phase B: Canonical Storage For Previews And Derived Artifacts

### Task B1: Preview Keys And Preview Resolution Contract

**Subagente**
- tipo: `api-designer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-22-preview-storage-contract.md`
- Modify: `lib/storage/keys.ts`
- Modify: `lib/storage/paths.ts`

**Must not touch**
- `app/*`
- `models/*`
- `ORCHESTRATOR.md`

- [ ] Congelar prefijos canónicos para `previews` y derivados.
- [ ] Cerrar reglas de naming para preview de PDF, preview de imagen y thumbnails futuros.
- [ ] Verificar con revisión de contrato antes de implementación.

### Task B2: Local Provider Support For Canonical Previews

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `lib/previews/*`
- Modify: `components/files/preview.tsx`
- Modify: `app/(app)/files/preview/[fileId]/route.ts`
- Modify: `models/files.ts`
- Create: `tests/lib/previews/storage-preview-paths.test.mjs`
- Create: `tests/app/files/preview-route.test.mjs`

**Must not touch**
- `prisma/schema.prisma`
- `app/(app)/tax/*`
- `ORCHESTRATOR.md`

- [ ] Hacer que previews y derivados nuevos se escriban ya con claves canónicas por organización.
- [ ] Mantener lectura compatible de previews legacy mientras dure la migración.
- [ ] Quitar dependencias nuevas de rutas hardcoded por usuario.
- [ ] Verificar con:
  - tests de preview de imagen
  - tests de preview de PDF
  - smoke test manual de preview/download

### Task B3: Preview Runtime Hardening

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `lib/previews/pdf.ts`
- Modify: `lib/previews/image.ts`
- Create: `tests/lib/previews/pdf-limit.test.mjs`

**Must not touch**
- tenancy core
- `ORCHESTRATOR.md`

- [ ] Corregir el `TODO` conocido de `lib/previews/pdf.ts` para respetar el límite de páginas configurado.
- [ ] Asegurar que la generación de derivados no depende de supuestos locales frágiles.
- [ ] Verificar con:
  - test de límite de páginas
  - test de idempotencia básica

## Phase C: Fiscal Reconciliation To Organization Root

### Task C1: Fiscal Tenant Root

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `prisma/schema.prisma`
- Modify: `models/fiscal/*`
- Modify: `models/tax-forms/*`
- Create: `tests/models/fiscal/tenant-scope.test.mjs`

**Must not touch**
- `components/capture/*`
- `lib/storage/*`
- `ORCHESTRATOR.md`

- [ ] Reconciliar todas las entidades fiscales a `organizationId` como raíz canónica.
- [ ] Eliminar inferencias residuales basadas en la invariancia `organization.id === user.id`.
- [ ] Mantener compatibilidad temporal con `userId` solo como autoría si aún hace falta.
- [ ] Verificar con:
  - tests de aislamiento entre organizaciones
  - smoke tests de `review`, `quarters`, `archive`, `close`, `303`, `115`

### Task C2: Fiscal UI And Access Guards

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `app/(app)/tax/*`
- Modify: `app/(app)/settings/fiscal/*`
- Modify: `components/tax/*`
- Create: `tests/app/tax/tenant-guards.test.mjs`

**Must not touch**
- `prisma/schema.prisma`
- `lib/storage/*`
- `ORCHESTRATOR.md`

- [ ] Asegurar que la UI fiscal usa el tenant activo y no filtra por usuario implícito.
- [ ] Dejar preparado el terreno para roles/selector multi-organización.
- [ ] Verificar con:
  - tests de render tenant-aware
  - tests de acceso cruzado bloqueado

## Phase D: Tenant-Aware UI And Multi-Org Readiness

### Task D1: Organization Surface And Permissions

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/settings/*`
- Modify: `app/(app)/transactions/*`
- Modify: `app/(app)/unsorted/*`
- Create: `components/organization/*`
- Create: `tests/app/tenant-routing.test.mjs`

**Must not touch**
- `prisma/schema.prisma`
- `lib/storage/*`
- `ORCHESTRATOR.md`

- [ ] Exponer organización activa y membership/rol de forma clara en la shell.
- [ ] Añadir guardas de permisos donde aún se asume owner único.
- [ ] Preparar selector de organización si el usuario pertenece a varias, aunque quede inicialmente detrás de feature flag o fallback simple.
- [ ] Verificar con:
  - tests de permisos
  - tests de navegación tenant-aware

## Phase E: S3 Readiness And Storage Migration

### Task E1: S3-Compatible Provider

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Create: `lib/storage/s3.ts`
- Modify: `lib/config.ts`
- Modify: `.env.example`
- Create: `tests/lib/storage/s3-provider.test.mjs`

**Must not touch**
- UI
- `ORCHESTRATOR.md`

- [ ] Implementar provider S3-compatible con el mismo contrato que el provider local.
- [ ] Añadir configuración:
  - bucket
  - region
  - endpoint opcional
  - credenciales
  - modo path-style si hace falta para compatibilidad
- [ ] Verificar con:
  - tests del provider
  - smoke test de configuración local

### Task E2: Storage Migration Tooling And Runbook

**Subagente**
- tipo: `tooling-engineer`
- modelo: `gpt-5.3-codex-spark`
- razonamiento: `medium`
- skills: `subagent-driven-development`, `verification-before-completion`

**Files**
- Create: `scripts/migrate-storage.ts`
- Create: `docs/superpowers/specs/2026-03-22-storage-migration-runbook.md`
- Create: `tests/scripts/migrate-storage.test.mjs`

**Must not touch**
- UI
- `ORCHESTRATOR.md`

- [ ] Crear herramienta idempotente para migrar local -> S3.
- [ ] Añadir `dry-run`, validación de conteos y reporte de errores por objeto.
- [ ] Documentar rollback y validación posterior.
- [ ] Verificar con:
  - tests del script
  - revisión del runbook

## Phase F: Worker And Runtime Hardening

### Task F1: Storage-Aware Worker Runtime

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `lib/analysis-worker.ts`
- Modify: `lib/analysis-worker-supervisor.ts`
- Modify: `scripts/analysis-worker.ts`
- Modify: `models/analysis-jobs.ts`
- Create: `tests/lib/worker-runtime.test.mjs`

**Must not touch**
- `prisma/schema.prisma`
- `components/*`
- `ORCHESTRATOR.md`

- [ ] Hacer que el worker dependa del storage provider, no de rutas locales embebidas.
- [ ] Mantener heartbeat y autostart local sin acoplarlo al layout de filesystem.
- [ ] Verificar con:
  - tests de jobs
  - tests de heartbeat
  - smoke test con provider local

### Task F2: Future Agent Guardrails

**Subagente**
- tipo: `architect-reviewer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-22-agent-readiness-guardrails.md`

**Must not touch**
- código del producto

- [ ] Definir qué debe existir ya para futuro multiagente:
  - eventos
  - tareas durables
  - auditoría
  - aprobaciones
- [ ] Dejar explícito qué no se implementa ahora.

## Phase G: Cheap But Correct Production Path

### Task G1: VM Compose Production Profile

**Subagente**
- tipo: `devops-engineer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `verification-before-completion`

**Files**
- Create: `docker-compose.prod.yml`
- Modify: `Dockerfile`
- Create: `.env.production.example`
- Create: `docs/superpowers/specs/2026-03-22-production-vm-runbook.md`

**Must not touch**
- Prisma schema
- UI de producto
- `ORCHESTRATOR.md`

- [ ] Preparar perfil de despliegue para VM pequeña:
  - `web`
  - `analysis-worker`
  - `postgres` temporal
  - `storage provider configurable`
- [ ] Añadir healthchecks, restart policy y variables mínimas.
- [ ] Documentar despliegue con dominio y HTTPS.
- [ ] Verificar con:
  - smoke test de arranque completo
  - verificación de variables mínimas

### Task G2: Backups And Recovery

**Subagente**
- tipo: `sre-engineer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `systematic-debugging`, `verification-before-completion`

**Files**
- Create: `docs/superpowers/specs/2026-03-22-backup-recovery-runbook.md`
- Modify: `app/(app)/settings/backups/*`

**Must not touch**
- tenancy core
- `ORCHESTRATOR.md`

- [ ] Definir y validar backup de:
  - PostgreSQL
  - object storage
  - configuración mínima
- [ ] Documentar restore completo y restore parcial.
- [ ] Verificar con restore de prueba en entorno temporal o checklists ejecutables.

### Task G3: Managed PostgreSQL Cutover Prep

**Subagente**
- tipo: `cloud-architect`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`, `verification-before-completion`

**Files**
- Create: `docs/superpowers/specs/2026-03-22-managed-postgres-cutover.md`
- Create: `scripts/db-cutover-check.ts`
- Create: `docs/superpowers/specs/2026-03-22-compute-replatform-trigger.md`

**Must not touch**
- producto salvo scripts/checks
- `ORCHESTRATOR.md`

- [ ] Definir el corte de PostgreSQL local en VM a PostgreSQL gestionado.
- [ ] Añadir checklist de latencia, backups, restore y humo funcional.
- [ ] Cerrar el criterio de paso de `VM -> compute gestionado`.

## Recommended Order

1. `Task A1`
2. `Task A2`
3. `Task B1`
4. `Task B2`
5. `Task B3`
6. `Task C1`
7. `Task C2`
8. `Task D1`
9. `Task E1`
10. `Task E2`
11. `Task F1`
12. `Task F2`
13. `Task G1`
14. `Task G2`
15. `Task G3`

## Milestone Gates

### Milestone 1: Storage Logic Safe

- cuota y admisión tenant-aware correctas
- conteo legacy multi-miembro correcto durante migración
- previews y derivados ya escriben canónico

### Milestone 2: Domain Safe

- fiscal completamente reconciliado con `organizationId`
- UI principal tenant-aware con permisos básicos
- sin dependencias nuevas de owner implícito por usuario

### Milestone 3: S3 Ready

- provider S3 operativo
- tooling de migración validado
- worker compatible con provider configurable

### Milestone 4: Cheap Production Ready

- perfil de VM documentado y reproducible
- backups/restore definidos
- criterio de paso a PostgreSQL gestionado y compute gestionado fijado

## Final Integrated Verification

```bash
node --test --experimental-strip-types \
  tests/lib/storage/tenant-quota.test.mjs \
  tests/lib/storage/legacy-usage-aggregation.test.mjs \
  tests/lib/previews/storage-preview-paths.test.mjs \
  tests/lib/previews/pdf-limit.test.mjs \
  tests/app/files/preview-route.test.mjs \
  tests/models/fiscal/tenant-scope.test.mjs \
  tests/app/tax/tenant-guards.test.mjs \
  tests/app/tenant-routing.test.mjs \
  tests/lib/storage/s3-provider.test.mjs \
  tests/scripts/migrate-storage.test.mjs \
  tests/lib/worker-runtime.test.mjs
npx prisma validate
npx prisma generate
npx eslint \
  lib/files.ts lib/storage/*.ts lib/previews/*.ts lib/tenant.ts \
  models/uploads.ts models/mobile/*.ts models/fiscal/*.ts models/tax-forms/*.ts \
  app/(app)/files/**/*.ts* app/(app)/transactions/**/*.ts* app/(app)/unsorted/**/*.ts* \
  app/(app)/tax/**/*.ts* app/(app)/settings/fiscal/**/*.ts* \
  scripts/migrate-storage.ts scripts/analysis-worker.ts
npx tsc --noEmit --pretty false
npm run build
```

## Completion Criteria

- el foundation hardening deja de tener residual crítico conocido en tenancy + storage
- el storage ya es canónico y S3-ready en uploads y previews
- fiscal ya está reconciliado con la raíz tenant
- `web + worker` ya no dependen conceptualmente del layout de una máquina concreta
- queda camino limpio para beta técnica sin reabrir deuda estructural
