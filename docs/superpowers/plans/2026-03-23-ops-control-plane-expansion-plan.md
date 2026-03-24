# Ops Control Plane Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** convertir `/ops` en una consola completa de superadmin para gestionar organizaciones, contrato comercial, miembros, configuración operativa y soporte profundo desde una única superficie.

**Architecture:** se mantiene el monolito `Next.js + Prisma` y el `shared-schema multitenant` actual. El trabajo se apoya en dos principios: `product plane` y `control plane` siguen separados, y `Ops` orquesta sobre modelos ya existentes en `billing`, `organizations`, `memberships`, `support-access` y `platform-audit` sin introducir una capa nueva pesada.

**Tech Stack:** Next.js 15 App Router, Server Actions, React 19, Prisma/PostgreSQL, Better Auth, Playwright para smoke manual cuando haga falta.

---

## Estado actual y alcance

Ya existe:
- listado global de organizaciones en `/ops`
- roles globales de plataforma
- soporte auditado
- override de acceso
- impersonación segura por usuario
- billing por organización y runtime access centralizado

Falta para que el control plane quede realmente completo:
- ficha detallada por organización
- edición de contrato `plan + addons + cambios programados`
- operaciones de miembros/invitaciones desde `/ops`
- snapshot de configuración y salud del tenant
- soporte profundo con historial y guardrails más visibles
- mejores filtros, contadores y navegación dentro de `/ops`

Queda explícitamente fuera de este plan:
- separar `/ops` en otro servicio
- catálogo comercial editable por UI
- oferta enterprise single-tenant
- edición masiva de todas las tablas de settings desde un único formulario genérico

## Mapa de ficheros

**Ya existentes y clave**
- `app/(app)/ops/page.tsx`
- `app/(app)/ops/actions.ts`
- `app/(app)/ops/layout.tsx`
- `models/ops.ts`
- `models/platform-admins.ts`
- `models/platform-audit.ts`
- `models/support-access.ts`
- `models/organizations.ts`
- `models/memberships.ts`
- `models/invitations.ts`
- `models/billing/contracts.ts`
- `models/billing/access.ts`
- `models/billing/summary.ts`
- `components/ops/impersonation-banner.tsx`
- `app/(app)/settings/billing/page.tsx`
- `app/(app)/settings/members/page.tsx`

**Nuevos recomendados**
- `app/(app)/ops/organizations/[organizationId]/page.tsx`
- `app/(app)/ops/organizations/[organizationId]/loading.tsx`
- `app/(app)/ops/organizations/[organizationId]/actions.ts`
- `components/ops/organization-detail-shell.tsx`
- `components/ops/organization-contract-card.tsx`
- `components/ops/organization-members-card.tsx`
- `components/ops/organization-health-card.tsx`
- `components/ops/organization-support-card.tsx`
- `components/ops/organization-audit-card.tsx`
- `components/ops/ops-dashboard-filters.tsx`
- `models/ops-organization-detail.ts`
- `models/ops-billing-admin.ts`
- `models/ops-support.ts`
- `tests/models/ops-organization-detail.test.mjs`
- `tests/models/ops-billing-admin.test.mjs`
- `tests/models/ops-support.test.mjs`
- `tests/app/ops-organization-detail.test.mjs`

## Fases y tareas

### Task 0: Congelar contrato funcional de `/ops`

**Subagente:** `api-designer`  
**Modelo:** `gpt-5.4`  
**Razonamiento:** `high`  
**Skills:** `writing-plans`, `brainstorming`, `typescript`

**Objetivo**
- fijar qué puede hacer `/ops` v2 sin mezclarlo con backlog futuro

**Write set**
- `docs/superpowers/specs/2026-03-23-ops-control-plane-scope.md`
- `ORCHESTRATOR.md`

- [x] **Step 1: Escribir un spec corto de alcance**
  - incluir capacidades de v2:
    - detalle por empresa
    - contrato
    - miembros
    - configuración/salud
    - soporte profundo
  - excluir:
    - microservicio propio
    - CRUD genérico de catálogo comercial
    - automatizaciones enterprise

- [x] **Step 2: Validar que el plan no reabre decisiones cerradas**
  - revisar contra:
    - `shared-schema`
    - catálogo en código
    - contrato en DB
    - runtime access centralizado

- [x] **Step 3: Registrar la decisión**
  - actualizar `ORCHESTRATOR.md`

**Verificación**
- lectura del spec y confirmación de alcance cerrado

---

### Task 1: Ficha detallada de organización en `/ops`

**Subagente:** `fullstack-developer`  
**Modelo:** `gpt-5.4`  
**Razonamiento:** `high`  
**Skills:** `test-driven-development`, `nextjs-15`, `react-19`, `verification-before-completion`

**Objetivo**
- pasar de tabla global a `master-detail`: `/ops` lista, `/ops/organizations/[organizationId]` opera

**Files**
- Create:
  - `app/(app)/ops/organizations/[organizationId]/page.tsx`
  - `app/(app)/ops/organizations/[organizationId]/loading.tsx`
  - `components/ops/organization-detail-shell.tsx`
  - `models/ops-organization-detail.ts`
  - `tests/models/ops-organization-detail.test.mjs`
- Modify:
  - `app/(app)/ops/page.tsx`
  - `models/ops.ts`

- [x] **Step 1: Escribir tests del agregador de detalle**
  - incluir:
    - contrato
    - addons
    - miembros
    - invitaciones
    - support sessions activas
    - auditoría reciente
    - métricas de uso
    - readiness/salud básica

- [x] **Step 2: Ejecutar los tests y confirmar fallo**
  - Run: `node --test --experimental-strip-types tests/models/ops-organization-detail.test.mjs`

- [x] **Step 3: Implementar el agregador mínimo**
  - no duplicar queries repartidas por componentes
  - resolver en `models/ops-organization-detail.ts`

- [x] **Step 4: Crear la página de detalle**
  - mantener la estética actual
  - navegación desde la fila de `/ops`

- [x] **Step 5: Verificar**
  - Run:
    - `node --test --experimental-strip-types tests/models/ops-organization-detail.test.mjs`
    - `npm run build`

**Resultado**
- cada organización tiene su propia ficha operativa en `/ops`

---

### Task 2: Gestión de contrato desde `Ops`

**Subagente:** `backend-developer`  
**Modelo:** `gpt-5.4`  
**Razonamiento:** `high`  
**Skills:** `test-driven-development`, `systematic-debugging`, `typescript`, `verification-before-completion`

**Objetivo**
- permitir a plataforma cambiar `plan`, `addons`, `access override` y cambios programados sin tocar Stripe en caliente

**Files**
- Create:
  - `models/ops-billing-admin.ts`
  - `tests/models/ops-billing-admin.test.mjs`
  - `components/ops/organization-contract-card.tsx`
- Modify:
  - `app/(app)/ops/organizations/[organizationId]/actions.ts`
  - `models/billing/contracts.ts`
  - `models/platform-audit.ts`
  - `app/(app)/ops/page.tsx`

- [x] **Step 1: Escribir tests de mutación de contrato**
  - cubrir:
    - cambio de plan inmediato
    - alta/baja de addons
    - downgrade programado
    - limpieza de addons duplicados
    - auditoría obligatoria

- [x] **Step 2: Ejecutar el test y ver fallo**
  - Run: `node --test --experimental-strip-types tests/models/ops-billing-admin.test.mjs`

- [x] **Step 3: Implementar operaciones admin de contrato**
  - una sola entrada:
    - `setOrganizationPlanFromOps`
    - `setOrganizationAddonsFromOps`
    - `scheduleOrganizationPlanChangeFromOps`
  - nunca leer Stripe para decidir estado en runtime

- [x] **Step 4: Montar la card de contrato en la ficha**
  - mostrar:
    - plan actual
    - addons activos
    - cambio programado
    - billingStatus
    - accessStatus

- [x] **Step 5: Verificar**
  - tests
  - `eslint`
  - `tsc`

**Resultado**
- el superadmin ya puede operar comercialmente una empresa desde `Ops`

---

### Task 3: Miembros e invitaciones desde `Ops`

**Subagente:** `fullstack-developer`  
**Modelo:** `gpt-5.4`  
**Razonamiento:** `high`  
**Skills:** `test-driven-development`, `nextjs-15`, `react-19`

**Objetivo**
- no depender de entrar como tenant admin para gestionar miembros

**Files**
- Create:
  - `components/ops/organization-members-card.tsx`
  - `tests/app/ops-organization-members.test.mjs`
- Modify:
  - `models/memberships.ts`
  - `models/invitations.ts`
  - `app/(app)/ops/organizations/[organizationId]/actions.ts`
  - `app/(app)/ops/organizations/[organizationId]/page.tsx`

- [x] **Step 1: Escribir tests de acciones admin de miembros**
  - cubrir:
    - invitar
    - cambiar rol
    - quitar miembro
    - transferir ownership
    - revocar invitación

- [x] **Step 2: Confirmar fallo**
  - Run: `node --test --experimental-strip-types tests/app/ops-organization-members.test.mjs`

- [x] **Step 3: Implementar acciones desde `Ops`**
  - reutilizar modelos existentes
  - no duplicar lógica de `settings/members`

- [x] **Step 4: Renderizar card de miembros**
  - lista de miembros
  - invitaciones pendientes
  - acciones inline mínimas

- [x] **Step 5: Verificar**
  - tests
  - smoke manual en `/ops/organizations/[id]`

**Resultado**
- el superadmin ya puede gestionar personas y acceso interno de la empresa desde el control plane

---

### Task 4: Snapshot de configuración y salud del tenant

**Subagente:** `fullstack-developer`  
**Modelo:** `gpt-5.4`  
**Razonamiento:** `medium`  
**Skills:** `test-driven-development`, `brainstorming`, `nextjs-15`

**Objetivo**
- ver desde `Ops` si una empresa está realmente lista para operar, sin abrir cinco pantallas

**Files**
- Create:
  - `components/ops/organization-health-card.tsx`
  - `tests/models/ops-health-summary.test.mjs`
- Modify:
  - `models/ops-organization-detail.ts`
  - `models/attention.ts`
  - `app/(app)/ops/organizations/[organizationId]/page.tsx`

- [x] **Step 1: Escribir tests del snapshot**
  - cubrir:
    - empresa básica configurada
    - fiscal profile
    - proveedor IA
    - backup básico
    - bloqueos fiscales
    - métricas y excepciones abiertas

- [x] **Step 2: Confirmar fallo**
  - Run: `node --test --experimental-strip-types tests/models/ops-health-summary.test.mjs`

- [x] **Step 3: Implementar el summary de salud**
  - read-only
  - con enlaces directos a la superficie correcta

- [x] **Step 4: Renderizar la card**
  - prioridad visual:
    - bloqueos
    - readiness
    - últimas incidencias

- [x] **Step 5: Verificar**
  - tests
  - build

**Resultado**
- `Ops` pasa a ser útil para soporte y diagnóstico, no solo para billing/miembros

---

### Task 5: Soporte profundo y timeline operativo

**Subagente:** `security-auditor` para diseño y `fullstack-developer` para implementación  
**Modelo:** `gpt-5.4`  
**Razonamiento:** `high`  
**Skills:** `brainstorming`, `test-driven-development`, `requesting-code-review`, `verification-before-completion`

**Objetivo**
- endurecer y visibilizar mejor el soporte:
  - sesiones activas
  - impersonación
  - revocación
  - historial
  - motivo

**Files**
- Create:
  - `components/ops/organization-support-card.tsx`
  - `tests/models/ops-support.test.mjs`
- Modify:
  - `models/support-access.ts`
  - `models/platform-audit.ts`
  - `app/(app)/ops/actions.ts`
  - `app/(app)/ops/organizations/[organizationId]/page.tsx`

- [x] **Step 1: Diseñar guardrails**
  - lectura vs escritura
  - tiempo máximo por defecto
  - motivos obligatorios
  - actor real siempre visible

- [x] **Step 2: Escribir tests**
  - historial por empresa
  - historial por actor
  - revocación manual
  - expiración
  - impersonación solo sobre miembros activos

- [x] **Step 3: Implementar timeline y acciones**
  - una card única de soporte
  - no repartirlo entre tabla global y detalle sin contexto

- [x] **Step 4: Verificar**
  - tests
  - review de seguridad

**Resultado**
- soporte e impersonación quedan operables y auditables desde una única vista

---

### Task 6: Dashboard global de `Ops`

**Subagente:** `frontend-developer`  
**Modelo:** `gpt-5.4`  
**Razonamiento:** `medium`  
**Skills:** `brainstorming`, `react-19`, `nextjs-15`

**Objetivo**
- mejorar `/ops` como panel global: no solo tabla, también foco operativo

**Files**
- Create:
  - `components/ops/ops-dashboard-filters.tsx`
  - `components/ops/ops-summary-cards.tsx`
  - `tests/app/ops-dashboard.test.mjs`
- Modify:
  - `app/(app)/ops/page.tsx`
  - `models/ops.ts`

- [x] **Step 1: Escribir tests de filtros y métricas**
  - por plan
  - por accessStatus
  - por billingStatus
  - con soporte activo
  - con bloqueos

- [x] **Step 2: Confirmar fallo**
  - Run: `node --test --experimental-strip-types tests/app/ops-dashboard.test.mjs`

- [x] **Step 3: Implementar filtros y contadores**
  - contar:
    - organizaciones en trial
    - past_due
    - suspended
    - con soporte activo
    - con backlog/bloqueo

- [x] **Step 4: Verificar**
  - tests
  - smoke manual

**Resultado**
- el superadmin ve rápido qué organizaciones requieren intervención sin abrir una por una

---

### Task 7: Limpieza, auditoría final y rollout

**Subagente:** `reviewer`  
**Modelo:** `gpt-5.4`  
**Razonamiento:** `high`  
**Skills:** `requesting-code-review`, `verification-before-completion`, `systematic-debugging`

**Objetivo**
- cerrar el cambio con garantías de permisos, tenancy y auditabilidad

**Files**
- Modify:
  - `ORCHESTRATOR.md`
  - docs/runbooks si el flujo operativo cambia

- [x] **Step 1: Revisar superficies críticas**
  - `/ops`
  - `/ops/organizations/[id]`
  - `support-access`
  - impersonación
  - mutaciones de contrato
  - gestión de miembros desde platform roles

- [x] **Step 2: Buscar fugas de permisos**
  - `rg -n "getCurrentUser|requireCurrentTenant|canAccessPlatformOps|support"` en write set

- [x] **Step 3: Verificación completa**
  - Run:
    - `node --test --experimental-strip-types tests/models/ops-organization-detail.test.mjs tests/models/ops-billing-admin.test.mjs tests/models/ops-support.test.mjs tests/app/ops-organization-detail.test.mjs tests/app/ops-dashboard.test.mjs`
    - `npx eslint <write-set>`
    - `npx tsc --noEmit --pretty false`
    - `npx prisma validate`
    - `npx prisma generate`
    - `npm run build`

- [x] **Step 4: Smoke manual**
  - entrar a `/ops`
  - abrir ficha de empresa
  - cambiar plan/addon
  - gestionar miembro
  - iniciar y cerrar impersonación
  - revisar auditoría

- [x] **Step 5: Actualizar memoria viva**
  - registrar decisiones finales en `ORCHESTRATOR.md`

**Resultado**
- cierre operativo y técnico del control plane v2

## Subagentes recomendados por ola

### Wave 1
- `backend-developer` + `fullstack-developer`
- foco: `Task 1` y `Task 2`
- motivo: desbloquear ficha detallada y contrato primero

### Wave 2
- `fullstack-developer`
- foco: `Task 3` y `Task 4`
- motivo: la ficha ya existe y se completa con miembros y salud

### Wave 3
- `security-auditor` + `fullstack-developer`
- foco: `Task 5`
- motivo: soporte profundo e impersonación merecen revisión separada

### Wave 4
- `frontend-developer` + `reviewer`
- foco: `Task 6` y `Task 7`
- motivo: remate del dashboard global y cierre transversal

## Riesgos a vigilar

- mezclar acciones de plataforma con acciones de tenant y romper permisos
- hacer que `Ops` mutile Stripe directamente en vez de operar el contrato interno
- duplicar la lógica de `settings/members` y `settings/billing` en vez de reutilizar modelos
- convertir la ficha de organización en una página gigante con demasiadas cards acopladas
- permitir impersonación sobre usuarios que ya no pertenezcan al tenant
- abrir edición de configuración profunda del tenant sin suficiente auditoría

## Qué NO mezclar ahora

- no convertir `/ops` en un CMS de pricing
- no meter edición genérica de todas las settings del tenant desde una sola tabla dinámica
- no abrir impersonación entre empresas distintas al tenant fijado por la sesión
- no rehacer la UX general del producto cliente
- no sacar `/ops` a otro servicio todavía

## Criterio de acabado

El plan se considera acabado cuando:
- `/ops` actúa como panel global y `/ops/organizations/[id]` como ficha operativa completa
- contrato, miembros, soporte e impersonación se gestionan desde el control plane
- existe snapshot claro de salud/configuración por empresa
- todas las acciones sensibles dejan rastro auditable
- el control plane queda usable sin tocar la estética actual del producto
