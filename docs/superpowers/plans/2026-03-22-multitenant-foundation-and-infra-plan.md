# Multitenant Foundation And Infrastructure Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** convertir TaxHacker desde un monolito centrado en `userId` y filesystem local en una base SaaS `organization-centric`, multitenant, preparada para storage S3 y para una evolución futura a workers/agentes, sin sobredimensionar la infraestructura actual.

**Architecture:** separar `arquitectura lógica` de `infraestructura física`. Primero se corrige el modelo de datos, el scoping por tenant, el contrato de storage y la separación operativa `web + worker`; después se despliega barato en una VM con Docker Compose y S3 real; más adelante se externaliza PostgreSQL y finalmente el compute.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, PostgreSQL, worker Node dedicado, storage S3-compatible, Docker Compose, AWS VM/S3 ahora, RDS/Fargate después.

---

## Planning Assumptions

- La app va a seguir creciendo funcionalmente antes del lanzamiento comercial.
- El siguiente gran riesgo no es la infraestructura, sino seguir ampliando el repo sobre supuestos de un solo usuario/una sola empresa.
- El futuro multiagente se deja preparado, pero no se implementa ahora.
- Estrategia de tenancy elegida:
  - `shared database`
  - `shared schema`
  - aislamiento por `organizationId`
- Estrategia de infraestructura elegida:
  - `fase ahora`: VM pequeña + Docker Compose + PostgreSQL local en la VM + S3 real
  - `fase beta`: PostgreSQL pasa a gestionado
  - `fase escala`: web/worker pasan a compute gestionado

## Out Of Scope For This Plan

- Plataforma multiagente completa
- Redis/Temporal/Kubernetes
- Base de datos por cliente
- Microservicios
- Reescritura completa de auth
- Offline-first móvil

## Global Delivery Rules

- Orquestación:
  - `writing-plans`
  - `subagent-driven-development`
  - `requesting-code-review`
- Skills obligatorias para implementadores:
  - `test-driven-development`
  - `verification-before-completion`
- Skills obligatorias cuando aplique:
  - `systematic-debugging` para migraciones, backfills o descuadres de tenant/storage
  - `using-git-worktrees` para cambios grandes que toquen Prisma + auth + storage
- Cada tarea debe cerrar con:
  - tests del write set
  - lint del write set
  - `npx tsc --noEmit --pretty false`
- `ORCHESTRATOR.md` solo lo actualiza el orquestador tras aprobar cada bloque.

## Phase 0: Freeze The Foundation Contract

### Task 0.1: Multitenant Domain Contract

**Subagente**
- tipo: `business-analyst`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-22-multitenant-foundation-design.md`
- Create: `docs/superpowers/specs/2026-03-22-storage-contract.md`

**Must not touch**
- `prisma/*`
- `app/*`
- `components/*`
- `ORCHESTRATOR.md`

- [ ] Definir el vocabulario canónico de tenancy:
  - `Organization`
  - `Membership`
  - `Role`
  - `currentOrganization`
  - `ownerOrganizationId`
- [ ] Definir el contrato de storage:
  - `object key`
  - `preview`
  - `static asset`
  - `download URL`
  - `delete`
  - `copy/move`
- [ ] Cerrar qué entidades pasan a ser `organization-owned` en fase 1.
- [ ] Dejar explícito qué sigue temporalmente en `userId` solo por compatibilidad.
- [ ] Verificar con revisión de arquitectura antes de pasar a Prisma.

### Task 0.2: Migration Safety Map

**Subagente**
- tipo: `architect-reviewer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`

**Files**
- Create: `docs/superpowers/specs/2026-03-22-migration-safety-map.md`

**Must not touch**
- código del producto

- [ ] Enumerar tablas actuales y decidir:
  - `migrar ya`
  - `dual-write temporal`
  - `defer`
- [ ] Identificar unicidades/índices que deben pasar a incluir `organizationId`.
- [ ] Identificar riesgos de backfill para self-hosted y cloud.

## Phase 1: Organization Foundation

### Task 1.1: Organization, Membership And Roles

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `prisma/schema.prisma`
- Create: `models/organizations.ts`
- Create: `models/memberships.ts`
- Create: `tests/models/organizations.test.mjs`
- Create: `tests/models/memberships.test.mjs`

**Must not touch**
- `components/*`
- `app/(app)/capture/*`
- `ORCHESTRATOR.md`

- [ ] Añadir `Organization`, `Membership` y `Role`.
- [ ] Añadir en `User`:
  - `defaultOrganizationId` o equivalente
- [ ] Crear migración con bootstrap `1 user -> 1 organization`.
- [ ] Añadir helpers de lectura/escritura para organizaciones y membresías.
- [ ] Verificar con:
  - tests de bootstrap
  - tests de unicidad de membership
  - tests de roles mínimos

### Task 1.2: Current Organization Resolution

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Create: `lib/tenant.ts`
- Modify: `lib/auth.ts`
- Modify: `models/users.ts`
- Modify: `app/(app)/layout.tsx`
- Create: `tests/lib/tenant.test.mjs`

**Must not touch**
- `prisma/schema.prisma`
- `lib/files.ts`
- `ORCHESTRATOR.md`

- [ ] Resolver la organización activa de cada request.
- [ ] Mantener compatibilidad con self-hosted y cloud.
- [ ] Exponer helpers tipo:
  - `getCurrentOrganization()`
  - `getCurrentMembership()`
  - `requireCurrentOrganization()`
- [ ] Cortar el acoplamiento directo de nuevas lecturas/escrituras a `userId` cuando lo correcto sea tenant.
- [ ] Verificar con:
  - tests de resolución tenant
  - tests de self-hosted
  - tests de redirect/guard básicos

## Phase 2: Tenant Scoping By Domain

### Task 2.1: Workspace Configuration Domain

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `prisma/schema.prisma`
- Modify: `models/defaults.ts`
- Modify: `models/users.ts`
- Modify: `models/settings.ts`
- Modify: `models/categories.ts`
- Modify: `models/projects.ts`
- Modify: `models/fields.ts`
- Modify: `models/currencies.ts`
- Create: `tests/models/tenant-config-scope.test.mjs`

**Must not touch**
- `app/(app)/transactions/*`
- `lib/files.ts`
- `ORCHESTRATOR.md`

- [ ] Pasar `settings`, `categories`, `projects`, `fields` y `currencies` a `organization-owned`.
- [ ] Hacer backfill desde el owner histórico.
- [ ] Ajustar defaults para que se creen por organización, no por usuario.
- [ ] Rehacer índices y unicidades con `organizationId`.
- [ ] Verificar con:
  - tests de aislamiento entre organizaciones
  - tests de defaults por organización
  - smoke test de settings

### Task 2.2: Documents And Financial Core Domain

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `prisma/schema.prisma`
- Modify: `models/files.ts`
- Modify: `models/transactions.ts`
- Modify: `models/fiscal/*`
- Modify: `models/mobile/*`
- Create: `tests/models/tenant-documents-scope.test.mjs`

**Must not touch**
- `components/*`
- `app/(app)/settings/*`
- `ORCHESTRATOR.md`

- [ ] Añadir `organizationId` a:
  - `File`
  - `Transaction`
  - `AnalysisJob`
  - `AppData`
  - `Progress`
  - entidades fiscales propias del tenant
- [ ] Backfill desde el usuario/organización bootstrap.
- [ ] Hacer que todas las consultas críticas filtren por tenant.
- [ ] Mantener compatibilidad temporal con `userId` solo donde aún sea necesario.
- [ ] Verificar con:
  - tests de tenant isolation
  - tests de acceso cruzado bloqueado
  - smoke tests de capture, unsorted, transactions y tax

### Task 2.3: Tenant-Aware UI And Permissions

**Subagente**
- tipo: `fullstack-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Modify: `app/(app)/settings/*`
- Modify: `app/(app)/transactions/*`
- Modify: `app/(app)/unsorted/*`
- Modify: `app/(app)/tax/*`
- Create: `components/organization/*`
- Create: `tests/app/tenant-routing.test.mjs`

**Must not touch**
- `prisma/schema.prisma`
- `lib/storage/*`
- `ORCHESTRATOR.md`

- [ ] Exponer organización activa y rol de forma clara en la UI.
- [ ] Añadir guardas de permisos por rol donde hoy se asume un único owner.
- [ ] Preparar selector de organización si un usuario pertenece a varias.
- [ ] Verificar con:
  - tests de permisos
  - tests de render tenant-aware
  - lint/build del write set

## Phase 3: Storage Abstraction And S3 Readiness

### Task 3.1: Storage Provider Contract

**Subagente**
- tipo: `api-designer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`

**Files**
- Create: `lib/storage/types.ts`
- Create: `lib/storage/index.ts`
- Create: `docs/superpowers/specs/2026-03-22-storage-provider-contract.md`

**Must not touch**
- `app/*`
- `models/*`
- `ORCHESTRATOR.md`

- [ ] Definir interfaz única de storage:
  - `putObject`
  - `getObject`
  - `deleteObject`
  - `copyObject`
  - `getPublicUrl` o `getDownloadStream`
  - `listPrefix`
- [ ] Definir claves y prefijos para:
  - `uploads/unsorted`
  - `uploads/transactions`
  - `previews`
  - `static`
- [ ] Verificar con review de arquitectura.

### Task 3.2: Local Provider And Compatibility Layer

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `test-driven-development`, `verification-before-completion`

**Files**
- Create: `lib/storage/local.ts`
- Modify: `lib/files.ts`
- Modify: `models/files.ts`
- Modify: `app/(app)/files/*`
- Modify: `app/(app)/capture/*`
- Create: `tests/lib/storage/local-provider.test.mjs`

**Must not touch**
- `prisma/schema.prisma`
- `ORCHESTRATOR.md`

- [ ] Hacer que el filesystem actual pase por el contrato de storage.
- [ ] Eliminar acceso nuevo directo a `fs/path` desde capas altas.
- [ ] Mantener comportamiento actual mientras el provider siga siendo local.
- [ ] Verificar con:
  - tests del provider local
  - tests de upload/download/preview

### Task 3.3: S3-Compatible Provider

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

- [ ] Implementar provider S3-compatible.
- [ ] Añadir configuración por entorno:
  - bucket
  - region
  - endpoint opcional
  - credenciales
- [ ] Mantener compatibilidad con proveedor local para desarrollo.
- [ ] Verificar con tests del contrato y smoke test de configuración.

### Task 3.4: Storage Migration Tooling

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

- [ ] Crear herramienta idempotente para copiar objetos desde local a S3.
- [ ] Añadir modo dry-run y validación de conteos.
- [ ] Documentar rollback y comprobaciones.
- [ ] Verificar con test de script y runbook.

## Phase 4: Worker, Jobs And Runtime Hardening

### Task 4.1: Worker Runtime Contract

**Subagente**
- tipo: `backend-developer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `subagent-driven-development`, `systematic-debugging`, `verification-before-completion`

**Files**
- Modify: `lib/analysis-worker.ts`
- Modify: `lib/analysis-worker-supervisor.ts`
- Modify: `scripts/analysis-worker.ts`
- Modify: `models/analysis-jobs.ts`
- Create: `tests/lib/worker-runtime.test.mjs`

**Must not touch**
- tenant schema
- `ORCHESTRATOR.md`

- [ ] Asegurar que el worker solo depende de DB + storage provider.
- [ ] Quitar suposiciones de path local en caliente.
- [ ] Mantener heartbeat y autostart local, pero separando mejor responsabilidad operativa.
- [ ] Verificar con:
  - tests de jobs
  - tests de heartbeat
  - smoke test con provider local

### Task 4.2: Generic Event/Task Guardrails For Future Agents

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
- [ ] Dejar explícito qué NO se implementa ahora.
- [ ] Alinear el roadmap futuro con Postgres, worker y storage ya elegidos.

## Phase 5: Cheap But Correct Production Profile

### Task 5.1: VM Compose Production Profile

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
- [ ] Dejar S3 como storage ya soportado.
- [ ] Añadir healthchecks, restart policy y variables mínimas.
- [ ] Documentar despliegue en VM con dominio y HTTPS.
- [ ] Verificar con smoke test de arranque completo.

### Task 5.2: Backups And Recovery

**Subagente**
- tipo: `sre-engineer`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `systematic-debugging`, `verification-before-completion`

**Files**
- Create: `docs/superpowers/specs/2026-03-22-backup-recovery-runbook.md`
- Modify: `app/(app)/settings/backups/*`
- Modify: scripts/runbooks only if needed

**Must not touch**
- tenancy core
- `ORCHESTRATOR.md`

- [ ] Definir y validar backup de:
  - PostgreSQL
  - bucket/object storage
  - artefactos mínimos de configuración
- [ ] Documentar restore completo y restore parcial.
- [ ] Verificar con restore de prueba en entorno temporal.

## Phase 6: Pre-Beta Managed Data Plane

### Task 6.1: PostgreSQL To Managed Cutover

**Subagente**
- tipo: `cloud-architect`
- modelo: `gpt-5.4`
- razonamiento: `high`
- skills: `brainstorming`, `writing-plans`, `verification-before-completion`

**Files**
- Create: `docs/superpowers/specs/2026-03-22-managed-postgres-cutover.md`
- Create: `scripts/db-cutover-check.ts`

**Must not touch**
- producto salvo scripts/checks
- `ORCHESTRATOR.md`

- [ ] Definir el corte de PostgreSQL local en VM a PostgreSQL gestionado.
- [ ] Añadir checklist de latencia, backups, restore y humo funcional.
- [ ] Dejar explícito el criterio de paso a beta.

### Task 6.2: Infrastructure Replatform Trigger

**Subagente**
- tipo: `cloud-architect`
- modelo: `gpt-5.4`
- razonamiento: `medium`
- skills: `writing-plans`

**Files**
- Create: `docs/superpowers/specs/2026-03-22-compute-replatform-trigger.md`

**Must not touch**
- código del producto

- [ ] Definir cuándo dejar la VM y pasar a compute gestionado.
- [ ] Cerrar criterios por:
  - CPU/RAM
  - cola de jobs
  - ventanas de despliegue
  - necesidad de alta disponibilidad
- [ ] Dejar la ruta futura: `VM -> ECS/Fargate`, no implementarla todavía.

## Recommended Order

1. `Task 0.1`
2. `Task 0.2`
3. `Task 1.1`
4. `Task 1.2`
5. `Task 2.1`
6. `Task 2.2`
7. `Task 2.3`
8. `Task 3.1`
9. `Task 3.2`
10. `Task 3.3`
11. `Task 3.4`
12. `Task 4.1`
13. `Task 4.2`
14. `Task 5.1`
15. `Task 5.2`
16. `Task 6.1`
17. `Task 6.2`

## Milestone Gates

### Milestone A: Architecture Logic Safe

- `Organization`, `Membership` y `currentOrganization` operativos
- entidades principales scoping por tenant
- sin nuevas features que sigan reforzando `userId` como owner de negocio

### Milestone B: Storage Safe

- contrato de storage único
- provider local operativo
- provider S3 operativo
- herramienta de migración validada

### Milestone C: Cheap Production Ready

- VM con `web + worker + postgres temporal`
- S3 real
- backups y recovery documentados

### Milestone D: Beta Ready

- PostgreSQL gestionado
- smoke tests de tenancy, capture, tax y mobile
- criterios de paso a compute gestionado definidos

## Verification Integrated Final

```bash
node --test --experimental-strip-types tests/models/organizations.test.mjs tests/models/memberships.test.mjs tests/lib/tenant.test.mjs tests/models/tenant-config-scope.test.mjs tests/models/tenant-documents-scope.test.mjs tests/lib/storage/local-provider.test.mjs tests/lib/storage/s3-provider.test.mjs tests/scripts/migrate-storage.test.mjs tests/lib/worker-runtime.test.mjs
npx tsc --noEmit --pretty false
npx eslint 'prisma/schema.prisma' 'lib/auth.ts' 'lib/tenant.ts' 'models/organizations.ts' 'models/memberships.ts' 'models/files.ts' 'models/transactions.ts' 'lib/storage/*.ts' 'scripts/analysis-worker.ts' 'scripts/migrate-storage.ts'
npm run build
```

## Completion Criteria

- el repo deja de crecer sobre un modelo single-tenant implícito
- la propiedad de negocio principal pasa a organización
- el storage deja de depender conceptualmente del filesystem local
- `web + worker` quedan listos para vivir en una VM hoy y en compute gestionado después
- queda camino limpio para abrir beta sin rehacer producto base
