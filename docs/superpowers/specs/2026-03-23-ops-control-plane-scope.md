# Ops Control Plane v2 Scope

Fecha: 23 de marzo de 2026

## Objetivo

Completar `/ops` como consola de plataforma para operar el SaaS multitenant desde una única superficie, sin reabrir decisiones cerradas de tenancy, billing o arquitectura.

## Capacidades incluidas en v2

- listado global de organizaciones con filtros operativos
- tarjetas resumen para foco rápido:
  - trial
  - past due
  - acceso restringido o suspendido
  - soporte activo
  - backlog de revisión
- ficha por organización en `/ops/organizations/[organizationId]`
- operación de contrato interno:
  - plan
  - addons
  - cambio programado
  - override de acceso
- gestión de miembros e invitaciones desde `Ops`
- snapshot de salud/readiness del tenant
- soporte profundo:
  - sesiones activas
  - impersonación
  - revocación
  - timeline operativo
- auditoría reciente y eventos de billing del tenant

## Límites explícitos

Queda fuera de v2:

- separar `/ops` en otro servicio
- catálogo comercial editable por UI
- CRUD genérico de todas las settings del tenant
- automatizaciones enterprise o despliegues single-tenant
- edición masiva de datos fiscales o de negocio desde el control plane

## Decisiones que no se reabren

- `shared-schema multitenant` sigue siendo la base
- catálogo comercial en código
- contrato comercial en base de datos
- runtime access centralizado
- Stripe no decide permisos en caliente
- `Ops` opera contrato interno y deja trazabilidad; no sustituye Stripe

## Guardrails operativos

- roles de plataforma separados de roles de tenant
- impersonación solo sobre miembros activos del tenant
- soporte con motivo obligatorio y caducidad
- acceso `read_only` de soporte sin escritura en rutas críticas
- todas las acciones sensibles dejan rastro auditable

## Criterio de cierre

La ola se considera cerrada cuando:

- `/ops` funciona como panel global
- `/ops/organizations/[organizationId]` funciona como ficha operativa completa
- contrato, miembros, soporte e impersonación se gestionan desde el control plane
- la salud del tenant se entiende sin entrar a varias pantallas del producto
- el resultado mantiene la estética actual del producto
