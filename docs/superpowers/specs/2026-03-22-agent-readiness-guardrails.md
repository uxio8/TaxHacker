# Guardrails de readiness multiagente para TaxHacker

Fecha: 2026-03-22  
Estado: congelado para la Task F2  
Ámbito: guardrails de arquitectura para una evolución futura a flujos multiagente sobre la base actual de TaxHacker (`Postgres` compartido, `storage provider`, `web + worker`, multitenancy `shared-schema`)

## 1. Problema y objetivo aclarado

TaxHacker ya está fijando una base `organization-centric`, con `Postgres` compartido, `storage provider` abstracto y separación operativa entre `web` y `worker`. Si más adelante se introducen agentes para triage, extracción, revisión fiscal o automatización operativa, esa capa no puede aparecer como una excepción fuera de los contratos del producto.

El objetivo de este documento es dejar cerrados los guardrails mínimos para que un futuro sistema multiagente:

- use la arquitectura ya elegida en vez de pelearse con ella
- tenga tareas durables y reintentables
- deje rastro auditable y aprobable
- respete tenancy, storage y dominio fiscal desde el primer día
- no fuerce ahora una plataforma de orquestación sobredimensionada

Este documento no implementa ninguna pieza nueva. Sólo fija contratos, invariantes y límites.

## 2. Decisión fundacional

La evolución multiagente de TaxHacker queda acotada así:

- la fuente de verdad del estado operativo será `Postgres`
- el mecanismo de ejecución seguirá siendo `web + worker`, no un plano de control separado en esta fase
- los artefactos grandes vivirán en el `storage provider`, no embebidos en eventos ni en filas de control
- el aislamiento canónico seguirá siendo por `organizationId` en `shared-schema`
- auditoría y aprobaciones serán parte del contrato de ejecución, no añadidos opcionales de UX

Regla principal:

- ningún agente futuro podrá ejecutar trabajo de producto apoyándose sólo en memoria de proceso, ficheros locales de runtime o logs no estructurados

Consecuencia directa:

- los ficheros locales de heartbeat o locks del worker actual pueden seguir como detalle operativo local, pero no valen como primitive canónica para coordinación multiagente entre procesos, máquinas o despliegues

## 3. Piezas base ya alineadas con este futuro

Estas piezas del repo ya marcan la dirección correcta y deben reutilizarse como base conceptual:

| Pieza actual | Qué aporta | Regla para futuro multiagente |
| --- | --- | --- |
| contrato de multitenancy `organization-centric` | raíz de ownership por `Organization` | toda tarea, evento, aprobación y artefacto de agente debe pertenecer a exactamente una organización |
| `storage provider` con `objectKey` canónico | separación entre dominio y provider físico | prompts largos, diffs, adjuntos, resultados y evidencias grandes deben guardarse por `objectKey`, no inline en control tables |
| `AnalysisJob` + recuperación de jobs obsoletos | semántica básica de tarea durable con estados y recuperación | la capa multiagente debe heredar estados explícitos, heartbeats, leases y recuperación por stale work |
| `FiscalAuditLog` | patrón append-only con `schema_version`, `actor`, `reason`, `references` y payload estructurado | el ledger de agentes debe seguir el mismo principio de payload versionado y trazabilidad por actor/referencia |
| separación `web + worker` | borde claro entre petición síncrona y ejecución asíncrona | la web crea intención, consulta estado y recoge aprobación; el worker reclama, ejecuta y persiste resultados |

Regla de encaje:

- la primera versión multiagente debe parecer una extensión del modelo `job + audit + storage + tenant`, no una segunda plataforma dentro del mismo producto

## 4. Prerrequisitos mínimos antes del primer agente productivo

No se debe activar ningún agente con capacidad de escritura o efectos externos hasta que existan estos mínimos.

### 4.1 Prerrequisitos de tenancy y contexto

- `currentOrganization` debe ser obligatorio en cualquier operación tenant-owned
- `web` y `worker` deben resolver el mismo contexto de tenant
- ninguna tarea de agente puede aceptar `userId` como scope de negocio canónico
- cualquier referencia de dominio usada por agentes debe ser validable contra una única `Organization`

### 4.2 Prerrequisitos de ejecución durable

- debe existir una tabla o agregado durable de tareas con estado persistido en `Postgres`
- cada reclamación de trabajo debe usar lease o heartbeat renovable
- debe existir recuperación automática de trabajo estancado
- debe existir idempotencia por comando o por intención de negocio
- reintentos y cancelaciones deben quedar reflejados en estado durable y en eventos

### 4.3 Prerrequisitos de storage y artefactos

- `worker` y `web` deben operar contra el mismo `storage provider`
- los artefactos grandes de agente deben vivir por `objectKey` bajo namespace de organización
- no se deben persistir prompts completos, documentos binarios o diffs grandes dentro del ledger de eventos
- cualquier artefacto que soporte una aprobación debe poder reabrirse de forma estable desde `storage`

### 4.4 Prerrequisitos de auditoría

- debe existir ledger append-only de eventos de agente con payload versionado
- cada evento debe incluir actor, tenant, timestamps y referencias de dominio
- debe distinguirse entre evento de sistema, evento de agente y decisión humana
- el resultado final visible en UI debe derivarse de una proyección o estado actual, no sustituir al ledger

### 4.5 Prerrequisitos de aprobación

- debe existir modelo durable de solicitud de aprobación
- la tarea debe poder quedar en `waiting_approval` sin perder contexto
- una aprobación o rechazo debe generar su propio evento auditable
- la reanudación tras aprobación debe ser idempotente y asociada a la misma intención original

### 4.6 Prerrequisitos de validación y seguridad

- ninguna escritura material puede depender sólo de texto libre generado por LLM
- debe haber validación determinista previa a persistencia para cualquier cambio estructurado
- debe existir límite explícito entre operaciones de sólo lectura, propuestas y operaciones con side effects
- debe poder bloquearse por política cualquier operación sobre periodos cerrados, documentos bloqueados o tenant no resuelto

## 5. Modelo recomendado de eventos

El modelo recomendado no es `event-sourcing` completo del producto. Es un ledger append-only de ejecución de agentes y aprobaciones.

### 5.1 Evento canónico recomendado

Cada evento futuro debería poder responder sin ambigüedad:

- qué tarea o intento lo causó
- qué organización lo posee
- qué actor lo originó
- qué entidad de dominio afecta
- qué artefactos o evidencias lo soportan
- si es reintentable, terminal o requiere aprobación

Forma mínima recomendada del sobre de evento:

```ts
type AgentEvent = {
  id: string
  organizationId: string
  taskId: string
  attemptId: string | null
  eventType: string
  schemaVersion: number
  actor: {
    type: "user" | "worker" | "agent" | "system"
    id: string | null
  }
  status: string | null
  reason: string | null
  correlationId: string
  causationId: string | null
  idempotencyKey: string | null
  references: {
    aggregateType: string | null
    aggregateId: string | null
    approvalRequestId: string | null
    artifactObjectKey: string | null
  }
  payload: Record<string, unknown>
  occurredAt: string
  createdAt: string
}
```

### 5.2 Familias de evento mínimas

Eventos mínimos recomendados:

- ciclo de vida de tarea:
  - `task_queued`
  - `task_claimed`
  - `task_started`
  - `task_heartbeat`
  - `task_waiting_approval`
  - `task_succeeded`
  - `task_failed`
  - `task_cancelled`
  - `task_stale_recovered`
- decisiones y validaciones:
  - `proposal_generated`
  - `validation_passed`
  - `validation_failed`
  - `domain_write_blocked`
- aprobaciones:
  - `approval_requested`
  - `approval_approved`
  - `approval_rejected`
  - `approval_expired`
- efectos externos o irreversibles:
  - `external_submission_requested`
  - `external_submission_completed`
  - `external_submission_failed`

Reglas:

- el nombre de evento debe describir un hecho ya ocurrido, no una intención ambigua
- el payload debe versionarse desde `schemaVersion=1`
- un evento nunca se reescribe tras persistirse
- el estado actual de la tarea puede actualizarse, pero el ledger no

## 6. Modelo recomendado de tareas durables

La unidad mínima recomendable no es “agente conversacional”, sino `tarea durable`.

### 6.1 Estado de tarea recomendado

Estados mínimos:

- `queued`
- `claimed`
- `running`
- `waiting_approval`
- `retryable_failure`
- `succeeded`
- `failed`
- `cancelled`

Reglas:

- sólo `succeeded`, `failed` y `cancelled` son terminales
- `waiting_approval` no es fallo; preserva contexto y congela side effects
- una tarea no puede pasar a `succeeded` sin haber persistido antes el resultado que la hace visible
- una tarea reintentada debe conservar la misma intención de negocio y abrir un nuevo `attempt`

### 6.2 Intentos y leases

Cada ejecución real debe registrarse como `attempt` independiente.

Campos mínimos recomendados para `attempt`:

- `taskId`
- `attemptNumber`
- `workerId`
- `claimedAt`
- `heartbeatAt`
- `leaseExpiresAt`
- `finishedAt`
- `outcome`
- `errorSummary`

Reglas:

- el claim debe ser transaccional
- sólo un `attempt` activo puede tener lease válido para una tarea
- si el lease expira, la tarea no se considera completada
- la recuperación por trabajo estancado debe generar evento propio y decidir entre reintento o fallo terminal según política

### 6.3 Inputs, outputs y artefactos

- el input canónico de tarea debe ser pequeño, estructurado y reejecutable
- el output estructurado debe quedar en la tarea o en su proyección
- adjuntos, diffs, previews, prompts largos y respuestas largas deben referenciarse vía `artifactObjectKey`
- una tarea no debe depender de leer un archivo temporal local de otra máquina

## 7. Entidades futuras mínimas recomendadas

El set mínimo para V1 multiagente debería ser éste:

| Entidad futura | Responsabilidad | Notas |
| --- | --- | --- |
| `AgentTask` | unidad durable de trabajo y su estado actual | `organization-owned`, con tipo, payload mínimo, prioridad y estado |
| `AgentTaskAttempt` | cada reclamación/ejecución real de una tarea | modela leases, heartbeats, retries y outcome por intento |
| `AgentTaskEvent` | ledger append-only de hechos y decisiones | base de auditoría operativa y reconstrucción de timeline |
| `AgentApprovalRequest` | gate humana para cambios sensibles o irreversibles | ligada a `taskId`, con estado y contexto aprobable |
| `AgentArtifact` | metadatos de artefactos guardados en `storage provider` | referencia `objectKey`, tipo, checksum y visibilidad |

Se puede añadir más adelante, pero no es requisito de V1:

- `AgentRun` o `WorkflowRun` para agrupar varias tareas bajo una misma campaña o sesión
- dependencias explícitas entre tareas
- colas diferenciadas por capacidad o coste
- reglas avanzadas de scheduling

## 8. Invariantes que deben respetarse desde ya

Aunque no se implemente todavía multiagente, estas reglas deben guiar cualquier pieza nueva que lo vaya a rozar.

- toda operación asíncrona nueva de negocio debe poder portar `organizationId`, `correlationId` e `idempotencyKey`
- todo artefacto nuevo de negocio debe poder vivir en `storage provider` bajo `organizations/{organizationId}/...`
- ningún flujo nuevo debe asumir que `web` y `worker` comparten disco local, memoria o proceso
- ninguna coordinación futura debe tomar como fuente de verdad un heartbeat en fichero local
- cualquier cambio de dominio propuesto por automatización debe pasar por validación determinista antes de persistirse
- cualquier acción irreversible o externa debe poder pausar en espera de aprobación
- ninguna escritura futura de agente debe saltarse servicios o reglas de dominio ya existentes para “escribir directo” por conveniencia
- cualquier ledger nuevo debe ser append-only, versionado y con actor explícito
- no debe introducirse una segunda raíz de ownership paralela a `Organization`
- ninguna tarea, evento o aprobación puede cruzar tenants

## 9. Política mínima de aprobaciones futuras

La aprobación humana futura no debe cubrir todo; debe cubrir lo que cambia riesgo.

### 9.1 Debe requerir aprobación explícita

- presentación externa a Hacienda, bancos o terceros
- reapertura o modificación de periodos fiscales cerrados
- borrado o sustitución de documentos fuente
- cambios masivos sobre múltiples transacciones o múltiples periodos
- cualquier operación cross-module con side effects irreversibles
- cualquier acción donde el agente no pueda aportar evidencia suficiente o validación determinista

### 9.2 Puede ejecutarse sin aprobación humana, si pasa validación

- clasificación o enriquecimiento que deje propuesta reversible
- generación de previews o artefactos derivados regenerables
- recomputaciones idempotentes sobre datos ya existentes
- borrado de artefactos temporales regenerables
- checks de consistencia y detección de incidencias sin escritura material

Regla operativa:

- “sin aprobación” no significa “sin auditoría”

## 10. Qué queda explícitamente fuera ahora

Este documento deja fuera de esta fase:

- implementar tablas nuevas o migraciones Prisma
- introducir un bus externo (`Kafka`, `NATS`, `SQS`, `Temporal`, `Cadence`)
- crear una plataforma autónoma de planificación multiagente
- ejecutar agentes en paralelo de forma generalizada
- rediseñar todo el producto a `event-sourcing`
- definir permisos finos o ACL por acción de agente
- diseñar la UX completa de aprobaciones
- conectar herramientas externas de agentes o proveedores de orquestación
- persistir memoria semántica/vectorial como parte del contrato base

Regla de alcance:

- primero se fija el contrato mínimo compatible con la arquitectura actual; la sofisticación de orquestación, scheduling o inteligencia viene después

## 11. Criterios de aceptación

Este guardrail queda bien definido si, tras leerlo, un implementador puede responder sin inventar:

- cuál será la fuente de verdad del runtime multiagente
- qué relación habrá entre `web`, `worker`, `Postgres` y `storage provider`
- qué prerrequisitos bloquean el primer agente con side effects
- qué entidades mínimas harán falta para tareas, eventos, artefactos y aprobaciones
- qué invariantes deben respetarse ya en nuevas piezas del sistema
- qué está explícitamente fuera de esta fase

Se considera fallo de este documento si deja dudas sobre cualquiera de estos puntos:

- si la coordinación multiagente puede depender de ficheros locales de runtime
- si los artefactos de agente deben ir a BD o a `storage provider`
- si una tarea puede escribir sin auditoría o sin idempotencia
- si una acción sensible puede ejecutarse sin capacidad de pausa y aprobación
- si el tenant sigue siendo `User` en vez de `Organization`

## 12. Siguiente paso recomendado

Cuando la base multitenant y el `storage provider` queden estabilizados, el siguiente paso lógico no es “activar agentes”, sino diseñar primero un contrato mínimo de:

1. `AgentTask`
2. `AgentTaskAttempt`
3. `AgentTaskEvent`
4. `AgentApprovalRequest`
5. `AgentArtifact`

Sólo después conviene decidir si hace falta o no una infraestructura externa de orquestación.
