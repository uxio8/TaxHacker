# Mapa de seguridad de migración a multitenancy y storage S3-ready

Fecha: 2026-03-22  
Estado: congelado para la Task 0.2  
Ámbito: mapa de ejecución segura previo a Prisma y previo a cualquier migración de infraestructura física

## 1. Objetivo

Este documento fija el orden seguro para migrar TaxHacker desde un modelo `user-centric` con filesystem local a un modelo `organization-centric`, `shared database` + `shared schema`, con storage abstracto y S3-ready.

Su función no es diseñar el schema final al detalle, sino responder estas preguntas antes de tocar Prisma:

- qué se puede migrar ya
- qué requiere `dual-write` temporal
- qué conviene diferir
- qué índices y unicidades deben cambiar
- qué partes del producto pueden romperse si el orden es incorrecto

## 2. Principio de ejecución

La secuencia segura queda fijada así:

1. introducir la raíz de tenancy (`Organization`, `Membership`, `currentOrganization`)
2. resolver tenant activo en runtime
3. mover primero configuración y catálogos
4. mover después documentos, jobs y fiscal
5. abstraer storage antes de cambiar provider
6. dejar PostgreSQL gestionado y compute gestionado para después

Regla principal:

- **no** cambiar al mismo tiempo tenancy, storage físico e infraestructura de despliegue

## 3. Inventario de superficies y decisión de migración

### 3.1 Identidad y auth

| Superficie | Estado actual | Decisión | Motivo |
| --- | --- | --- | --- |
| `User` | raíz práctica de identidad y dominio | `dual-write temporal` | Sigue siendo identidad/auth, pero deja de ser owner canónico del dominio. |
| `Session` | auth | `defer` | No necesita `organizationId` para el primer corte. |
| `Account` | auth | `defer` | Igual que `Session`. |
| `Verification` | auth | `defer` | Igual que `Session`. |
| `lib/auth.ts` | resuelve usuario actual | `migrar ya` | Debe aprender a resolver `currentOrganization` y no solo `User`. |
| `models/users.ts` | bootstrap users/defaults/self-hosted | `migrar ya` | Es un punto de arranque crítico para bootstrap de organización. |

Conclusión:

- auth se mantiene apoyada en `User`
- dominio deja de apoyarse en `User`
- el primer corte no debe reescribir Better Auth, pero sí envolverlo con resolución de tenant

### 3.2 Catálogos y configuración

| Superficie | Estado actual | Decisión | Motivo |
| --- | --- | --- | --- |
| `Setting` | `userId` + unique `(userId, code)` | `migrar ya` | Configuración de workspace. |
| `Category` | `userId` + unique `(userId, code)` | `migrar ya` | Catálogo compartido por tenant. |
| `Project` | `userId` + unique `(userId, code)` | `migrar ya` | Igual que `Category`. |
| `Field` | `userId` + unique `(userId, code)` | `migrar ya` | Define comportamiento funcional del CRUD y del análisis. |
| `Currency` | `userId` nullable + unique `(userId, code)` | `migrar ya` | Debe pasar a ámbito organización. |
| `models/defaults.ts` | defaults por usuario | `migrar ya` | Si esto no cambia pronto, seguirán naciendo workspaces mal modelados. |

Conclusión:

- esta es la **primera ola funcional segura**
- son tablas con valor alto y menor riesgo que documentos/ficheros

### 3.3 Documentos y jobs

| Superficie | Estado actual | Decisión | Motivo |
| --- | --- | --- | --- |
| `File` | `userId`, `path`, metadata | `migrar ya`, con cuidado | Es core del producto y base del storage. |
| `Transaction` | `userId`, relaciones por `(code, userId)` | `migrar ya`, después de catálogos | Debe vivir en el tenant, pero depende de `Category/Project/Field`. |
| `AnalysisJob` | `userId`, `fileId` | `migrar ya`, después de `File` | Worker y polling deben operar por tenant. |
| `AppData` | `userId` + unique `(userId, app)` | `migrar ya` | Estado funcional de apps por workspace. |
| `Progress` | `userId` | `migrar ya` | Export/backup/progreso del tenant. |
| mobile capture (`models/mobile/*`) | mezcla user quotas + files/jobs | `dual-write temporal` | Depende de `File`, `AnalysisJob`, cuotas y metadata. |

Conclusión:

- esta es la **segunda ola**
- aquí ya hay riesgo real de regresión si los catálogos no se han movido antes

### 3.4 Fiscal

| Superficie | Estado actual | Decisión | Motivo |
| --- | --- | --- | --- |
| `FiscalProfile` | cuelga de `User` por `userId @unique` | `dual-write temporal` | Hoy actúa como scope root fiscal; hay que reconciliarlo con `Organization`. |
| `Counterparty` | cuelga de `FiscalProfile.ownerScopeId` | `defer` a la ola fiscal | No tocar antes de cerrar el mapeo de `FiscalProfile -> Organization`. |
| `FiscalPeriod*` | cuelgan de `FiscalProfile.ownerScopeId` | `defer` a la ola fiscal | Igual que `Counterparty`. |
| `TransactionFiscal*` | cuelga de `FiscalProfile` y `Transaction` | `defer` a la ola fiscal | Depende tanto de tenant como de fiscal profile. |

Conclusión:

- fiscal **no debe ser la primera migración**
- primero se migra el dominio general y luego se realinea fiscal contra la nueva raíz de tenant

### 3.5 Storage y filesystem

| Superficie | Estado actual | Decisión | Motivo |
| --- | --- | --- | --- |
| `lib/files.ts` | contrato real basado en disco local | `migrar ya` | Es la pieza que más deuda arrastra si se pospone. |
| `models/files.ts` | mezcla BD + path físico | `migrar ya` | Debe pasar a `objectKey` lógico. |
| `app/(app)/files/*` | acceso y preview de ficheros | `dual-write temporal` | Necesitan convivir con rutas legacy y nuevas claves. |
| `app/(app)/transactions/actions.ts` | mueve ficheros y recalcula storage | `dual-write temporal` | Alto riesgo por movimiento físico + update de BD. |
| `app/(app)/unsorted/actions.ts` | guarda y mueve ficheros | `dual-write temporal` | Igual que `transactions/actions.ts`. |
| `app/api/mobile/*` | captura móvil + inbox | `dual-write temporal` | Usa storage, quotas y jobs. |
| backup/export | disco/zip en memoria | `defer parcial` | Primero hay que tener contrato de storage y tenant; luego adaptar export/backups. |

Conclusión:

- storage lógico se abstrae pronto
- migración física a S3 va después de introducir el contrato

## 4. Unicidades e índices que deben cambiar

### 4.1 Deben pasar a incluir `organizationId`

Estas unicidades no pueden seguir ancladas a `userId` si el tenant real es la organización:

- `Setting`: de `@@unique([userId, code])` a equivalente por organización
- `Category`: de `@@unique([userId, code])` a equivalente por organización
- `Project`: de `@@unique([userId, code])` a equivalente por organización
- `Field`: de `@@unique([userId, code])` a equivalente por organización
- `Currency`: de `@@unique([userId, code])` a equivalente por organización
- `AppData`: de `@@unique([userId, app])` a equivalente por organización

### 4.2 Índices operativos nuevos esperables

- índices por `organizationId` en:
  - `File`
  - `Transaction`
  - `AnalysisJob`
  - `Progress`
  - `AppData`
- índices compuestos por tenant y fecha en:
  - `Transaction`
  - `AnalysisJob`
  - `Progress`

### 4.3 Zona fiscal delicada

El dominio fiscal ya usa `ownerScopeId`, pero ese scope hoy es `FiscalProfile`, no `Organization`.  
Riesgo:

- si se añade `organizationId` también a fiscal sin decidir la relación canónica, se introduce una doble raíz de ownership

Regla:

- primero se decide si `FiscalProfile` pasa a colgar de `Organization`
- solo después se tocan índices y unicidades fiscales

## 5. Riesgos de backfill

### 5.1 Self-hosted

Riesgo bajo-medio:

- normalmente habrá un solo usuario operativo
- el bootstrap más seguro es:
  - crear una `Organization` singleton
  - crear una `Membership owner`
  - backfillear todos los registros tenant-owned a esa organización

Riesgo específico:

- defaults creados varias veces por el historial de self-hosted
- hay que evitar duplicar catálogos al convertirlos a organización

### 5.2 Cloud

Riesgo medio-alto:

- cada usuario actual probablemente equivale a un workspace implícito
- el bootstrap seguro es `1 user -> 1 organization -> 1 membership owner`
- más adelante se permitirá multi-org real, pero el backfill no debe esperar a esa UI

Riesgos específicos:

- `stripeCustomerId`, `membershipPlan`, `membershipExpiresAt` siguen por usuario
- `storageUsed`, `storageLimit`, `aiBalance` siguen por usuario
- datos de negocio `business*` viven aún en `User`

Regla:

- billing y cuotas pueden quedarse temporalmente en `User`
- pero el owner de documentos/configuración debe pasar a `Organization`

### 5.3 Storage legacy

Riesgo alto:

- los paths actuales usan namespace por usuario/email
- hay múltiples sitios que recalculan `storageUsed` leyendo disco local
- hay movimientos físicos de fichero embebidos en actions

Regla:

- no romper primero el path físico; primero introducir `objectKey` y adapter
- compatibilidad temporal de lectura legacy encapsulada en el provider local

## 6. Olas seguras de migración

## Wave 1: raíz de tenancy

Incluye:

- `Organization`
- `Membership`
- `Role`
- `User.defaultOrganizationId` o equivalente
- helpers `currentOrganization`

No incluye todavía:

- cambio masivo de ownership del dominio
- storage
- fiscal

Riesgo:

- bajo-medio

Prerequisitos:

- contrato de multitenancy congelado

## Wave 2: catálogos y defaults

Incluye:

- `Setting`
- `Category`
- `Project`
- `Field`
- `Currency`
- `defaults`

Riesgo:

- medio

Motivo para ponerla aquí:

- desbloquea que `Transaction` y el resto del dominio dejen de depender de `(code, userId)`

## Wave 3: documentos y jobs

Incluye:

- `File`
- `Transaction`
- `AnalysisJob`
- `AppData`
- `Progress`
- rutas críticas de upload, unsorted, transactions, mobile capture

Riesgo:

- alto

Motivo:

- aquí coinciden tenancy, ficheros, jobs y UI

## Wave 4: storage abstraction

Incluye:

- adapter local bajo contrato
- nuevo provider S3-compatible
- herramienta de migración

Riesgo:

- alto, pero controlable si llega después de Wave 3 lógica

## Wave 5: fiscal realignment

Incluye:

- `FiscalProfile` y mapping a organización
- `Counterparty`
- `FiscalPeriod*`
- `TransactionFiscal*`

Riesgo:

- alto

Motivo:

- el dominio fiscal ya ha crecido y no conviene mezclar esta migración con la base de tenancy general

## 7. Puntos que pueden romperse si el orden es incorrecto

### Auth y bootstrap

Puede romperse si:

- cambias ownership del dominio antes de resolver `currentOrganization`
- mueves defaults antes de crear la organización bootstrap

### Defaults

Puede romperse si:

- `createUserDefaults()` y `ensureUserDefaultsVersion()` siguen escribiendo por `userId` cuando ya existen tablas por organización

### Transactions

Puede romperse si:

- `Transaction` cambia a tenant antes que `Category/Project/Field`
- se pierde la coherencia de relaciones hoy definidas por `(code, userId)`

### Files y uploads

Puede romperse si:

- cambias el contrato físico del path antes de meter un adapter
- mezclas a la vez `organizationId`, `objectKey` y migración a S3

### Mobile capture

Puede romperse si:

- `File` y `AnalysisJob` cambian de owner pero `models/mobile/*` sigue leyendo cuotas y ownership sólo desde `User`

### Worker

Puede romperse si:

- `AnalysisJob` pasa a tenant pero el worker sigue resolviendo contexto solo por usuario o solo por path local

### Fiscal

Puede romperse si:

- fiscal se intenta migrar antes de tener `Organization` y `Transaction` asentados
- se introduce una doble semántica entre `ownerScopeId` y `organizationId`

## 8. Dependencias duras

- `Wave 1` es requisito de todo lo demás
- `Wave 2` debe preceder a `Transaction`
- `Wave 3` debe preceder a cualquier migración seria de storage físico
- `Wave 3` debe preceder a la realineación fiscal
- storage abstraction debe preceder a S3 real

## 9. Recomendación explícita de Wave 1 de Prisma

La primera ola de Prisma debe ser estrictamente esta:

1. crear `Organization`
2. crear `Membership`
3. definir `Role`
4. añadir a `User` una referencia de organización activa por defecto o mecanismo equivalente
5. bootstrap `1 user -> 1 organization -> 1 membership owner`
6. introducir helpers de runtime para resolver `currentOrganization`

Y parar ahí.

No mezclar en esa primera ola:

- `Setting/Category/Project/Field/Currency`
- `File/Transaction/AnalysisJob`
- storage abstraction
- fiscal

## 10. Riesgos altos

Riesgos altos confirmados:

- defaults por usuario muy incrustados en el repo
- relaciones de `Transaction` a `Category/Project` por `(code, userId)`
- cálculos de `storageUsed` pegados al filesystem local y al usuario
- mobile capture apoyándose a la vez en `User`, `File`, `AnalysisJob` y metadata
- fiscal apoyándose en `FiscalProfile` como scope root distinto de `Organization`

## 11. Siguiente paso recomendado

Con este mapa congelado, el siguiente paso correcto es:

1. ejecutar `Wave 1` de Prisma
2. validar bootstrap y resolución de `currentOrganization`
3. solo después abrir `Wave 2` para catálogos y defaults
