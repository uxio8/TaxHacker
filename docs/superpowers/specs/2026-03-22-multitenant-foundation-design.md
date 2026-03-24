# Diseño fundacional de multitenancy para TaxHacker

Fecha: 2026-03-22  
Estado: congelado para la Task 0.1  
Ámbito: contrato de dominio previo a Prisma, previo a refactors de app y previo a infraestructura final

## 1. Problema y objetivo aclarado

TaxHacker sigue modelado alrededor de `userId`, pero la dirección aprobada del repo ya no es single-user: debe pasar a ser `organization-centric`, multitenant en `shared database` + `shared schema`, con storage preparado para proveedor local y S3-compatible, y con la misma semántica para web y worker.

El objetivo de este documento es cerrar el contrato mínimo que permita:

- modelar tenancy sin ambigüedad en Prisma
- separar identidad de usuario de propiedad del workspace
- migrar storage y consultas hacia `organizationId`
- preservar compatibilidad razonable en self-hosted y cloud sin bifurcar arquitectura

Este documento no diseña todavía migraciones concretas, UI de cambio de organización ni infraestructura física final.

## 2. Decisión fundacional

La decisión de tenancy para TaxHacker queda fijada así:

- estrategia física: `shared database`
- estrategia lógica: `shared schema`
- aislamiento canónico: por `organizationId`
- raíz de tenancy: `Organization`
- actor de identidad: `User`
- relación entre identidad y tenant: `Membership`

Regla principal:

- todo dato de workspace, documento, configuración operativa, job o artefacto persistido que pertenezca al negocio debe ser filtrable y auditable por `organizationId`

Consecuencia directa:

- `userId` deja de ser la clave de scoping canónica para dominio de producto
- `userId` sólo seguirá siendo canónico para identidad, auth y compatibilidad temporal expresamente listada en este documento

## 3. Vocabulario canónico

| Término | Significado canónico | Regla operativa |
| --- | --- | --- |
| `Organization` | Tenant raíz del producto. Representa el workspace o empresa dueña de configuraciones, documentos, jobs y storage. | Toda entidad de negocio debe pertenecer a exactamente una `Organization`. |
| `Membership` | Relación entre un `User` y una `Organization`. | Un usuario puede tener cero, una o varias memberships. |
| `Role` | Rol mínimo de una membership. V1 queda fijado a `owner`, `admin`, `member`. | No introducir permisos finos ni ACL granular en esta fase. |
| `currentOrganization` | Organización activa resuelta por request o por ejecución de worker. | Toda lectura/escritura tenant-owned debe recibirla o derivarla antes de tocar datos. |
| `ownerOrganizationId` | Identificador de la `Organization` propietaria de una entidad tenant-owned. | Es la FK canónica de ownership de tenant. |

Notas adicionales:

- `User` representa identidad, autenticación y compatibilidad histórica. No representa por sí mismo el workspace propietario.
- Si un subdominio usa un nombre distinto por semántica propia, por ejemplo `ownerScopeId`, esa clave debe resolver 1:1 a una única `Organization` y no puede introducir una segunda raíz de tenancy.

## 4. Alcance normalizado

En alcance inmediato:

- fijar `Organization`, `Membership`, `Role`, `currentOrganization` y `ownerOrganizationId`
- congelar que el producto será `organization-centric`
- decidir qué superficies pasan a ser `organization-owned` en la primera ola de migración
- decidir qué queda temporalmente en `userId` por compatibilidad
- fijar implicaciones mínimas para self-hosted, cloud, web y worker

Fuera de alcance inmediato:

- base de datos por tenant
- schema por tenant
- row-level security de PostgreSQL
- sistema completo de invitaciones, equipos y permisos finos
- SSO, SCIM o enterprise identity
- rediseño completo de billing
- UI avanzada de selector de organización
- infraestructura final gestionada

## 5. Contrato de ownership para fase 1

### 5.1 Debe pasar a `organization-owned`

Estas superficies deben dejar de depender de `userId` como owner canónico y pasar a `ownerOrganizationId` o equivalente directo:

| Superficie | Decisión | Motivo |
| --- | --- | --- |
| `Setting` | `organization-owned` | Es configuración del workspace, no de identidad personal. |
| `Category` | `organization-owned` | Define clasificación compartida del tenant. |
| `Project` | `organization-owned` | Es catálogo operativo del tenant. |
| `Field` | `organization-owned` | Define esquema funcional compartido por organización. |
| `Currency` | `organization-owned` | Forma parte de defaults y configuración de workspace. |
| `File` | `organization-owned` | El adjunto pertenece al tenant que lo sube y revisa. |
| `Transaction` | `organization-owned` | Es el core financiero del tenant. |
| `AnalysisJob` | `organization-owned` | El worker debe procesar jobs por tenant, no por usuario. |
| `AppData` | `organization-owned` | Guarda estado funcional del tenant. |
| `Progress` | `organization-owned` | Debe reflejar procesos del workspace y sus exportaciones. |
| Perfil de negocio actual (`businessName`, `businessAddress`, `businessTaxId`, `businessBankDetails`, `businessLogo`) | `organization-owned` | Describe a la empresa propietaria, no a la identidad del usuario. |
| `FiscalProfile` y entidades fiscales dependientes (`Counterparty`, `FiscalPeriod`, `FiscalPeriodSnapshot`, `FiscalAuditLog`, `TransactionFiscal`, `TransactionFiscalLine`) | `organization-owned` | Ya modelan propiedad funcional; deben quedar ancladas a una organización concreta. |
| Storage lógico y rutas de objetos | `organization-owned` | El namespace persistido debe seguir al tenant y no a un email o usuario. |

### 5.2 Puede seguir temporalmente en `userId`

Estas superficies pueden mantenerse en `userId` durante el corte inicial por compatibilidad o por falta de decisión de producto, pero dejan de ser el owner del dominio principal:

| Superficie | Se mantiene temporalmente en `userId` | Por qué |
| --- | --- | --- |
| `User` | sí | Sigue siendo el principal de identidad y sesión. |
| `Session`, `Account`, `Verification` | sí | Son infraestructura de auth, no datos de tenant. |
| `stripeCustomerId`, `membershipPlan`, `membershipExpiresAt` | sí | Billing y suscripción aún están definidos por usuario en cloud. |
| `aiBalance`, `storageLimit`, `storageUsed` | sí | La política de cuota por organización todavía no está cerrada. |
| `avatar` | sí | Es preferencia/identidad personal, no identidad del tenant. |
| lectura legacy de `business*` desde `User` | sí, sólo como compatibilidad temporal | Varias superficies actuales todavía lo leen desde perfil de usuario; la fuente canónica debe pasar al tenant en cuanto exista el nuevo almacenamiento. |

Regla de compatibilidad:

- cualquier dato que siga temporalmente en `userId` no debe bloquear la adopción de `currentOrganization` como contexto obligatorio para el dominio del producto

## 6. Contrato de resolución de tenant

`currentOrganization` queda definido como contexto obligatorio de ejecución para cualquier operación tenant-owned.

Reglas:

- en cloud, `currentOrganization` se resuelve desde la membership activa del usuario
- en self-hosted, `currentOrganization` se resuelve siempre a la organización singleton del despliegue
- web y worker deben usar el mismo contrato lógico de resolución
- nuevas consultas y mutaciones tenant-owned no pueden aceptar sólo `userId`
- cuando exista ambigüedad entre usuario autenticado y tenant objetivo, prevalece `currentOrganization`

Mínimo esperado para la siguiente fase técnica:

- `User.defaultOrganizationId` o equivalente de resolución estable
- helper de lectura de `currentOrganization`
- helper de lectura de `currentMembership`
- helper tipo `requireCurrentOrganization()`

## 7. Implicaciones para self-hosted y cloud

### Self-hosted

- sigue existiendo como modo soportado
- arranca con un usuario singleton y una `Organization` singleton bootstrap
- no necesita multi-organización operativa en la primera iteración
- no debe tener un schema alternativo ni reglas especiales de ownership distintas del modo cloud

### Cloud

- cada usuario nuevo debe bootstrapear al menos una `Organization` con rol `owner`
- el modelo debe permitir que un usuario pertenezca a varias organizaciones aunque la UI completa llegue después
- billing puede seguir temporalmente en `User`, pero el dominio de producto ya no debe depender de ello

### Regla común

- self-hosted y cloud comparten la misma semántica de tenant, los mismos owners lógicos y el mismo contrato de storage

## 8. Límites y no-objetivos inmediatos

- no se diseña aquí el flujo de invitaciones
- no se diseña aquí el selector UX completo de organizaciones
- no se mueve todavía billing a nivel organización
- no se abre soporte de compartir un mismo documento entre organizaciones
- no se implementa todavía separación física de bases de datos, buckets o workers por tenant
- no se autoriza ningún nuevo desarrollo de producto que refuerce ownership por `userId`

## 9. Criterios de aceptación

La Task 0.1 queda correctamente definida si, tras leer este documento, el implementador de Prisma puede responder sin inventar política:

- cuál es la raíz de tenancy del producto
- qué entidades deben recibir `organizationId`
- qué puede quedarse temporalmente en `userId`
- cómo debe resolverse `currentOrganization`
- qué diferencias reales hay entre self-hosted y cloud
- qué cambios quedan explícitamente fuera de este corte

Se considera fallo de este contrato si obliga a adivinar cualquiera de estos puntos:

- si `User` sigue siendo owner del dominio
- si hay más de una raíz válida de tenancy
- si self-hosted tiene un modelo de datos distinto
- si billing y cuotas ya deben mudarse a organización

## 10. Supuestos, riesgos y decisiones abiertas

Supuestos usados:

- el roadmap aprobado mantiene `shared database` + `shared schema`
- el worker seguirá leyendo la misma base que la web
- la política de self-hosted seguirá siendo singleton a corto plazo

Riesgos a vigilar:

- hay bastante código que aún lee `business*` desde `User`
- el dominio fiscal ya usa `ownerScopeId` y hay que evitar que se interprete como un segundo tenant root
- `storageUsed` y cuotas siguen anclados al usuario y necesitarán decisión posterior

Decisiones abiertas que no bloquean Prisma fase 1 pero sí futuras iteraciones:

- si el perfil de empresa vive en `Organization` o en una tabla `OrganizationProfile`
- si `defaultOrganizationId` vive en `User`, cookie o sesión
- cuándo pasan billing y cuotas desde `User` a `Organization`

## 11. Siguiente paso recomendado

Con este contrato congelado, el siguiente paso es producir el mapa de seguridad de migración y después ejecutar Prisma empezando por:

1. `Organization`
2. `Membership`
3. resolución de `currentOrganization`
4. migration wave de entidades `organization-owned`
