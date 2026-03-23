# Disparador de salida de VM a compute gestionado

Fecha: 2026-03-22  
Estado: preparado para foundation closeout G4  
Ámbito: criterio de decisión para pasar de una VM pequeña con `app` + `analysis-worker` a compute gestionado, manteniendo la arquitectura objetivo multitenant `shared schema`

## 1. Objetivo y límite exacto

Este documento fija cuándo dejar de operar TaxHacker en una sola VM pequeña y pasar a compute gestionado. No diseña una plataforma nueva completa; solo cierra el criterio de activación y la ruta mínima preferida.

Queda dentro del límite:

- decidir cuándo la VM deja de ser operativamente defendible
- definir la ruta mínima futura `VM -> ECS/Fargate` o equivalente
- dejar claros prerrequisitos y señales observables

Queda fuera del límite:

- implementar la migración
- introducir Kubernetes, service mesh o re-arquitectura amplia
- cambiar el contrato del dominio multitenant o del storage

## 2. Boundary operativo analizado

### Plano de control

- despliegue actual por `docker-compose.prod.yml`
- una imagen compartida para `app` y `analysis-worker`
- reinicios y despliegues acoplados al mismo host

### Plano de datos

- hoy la VM aloja el compute y, hasta ejecutar G3, también el PostgreSQL local
- `analysis-worker` usa PostgreSQL como cola de coordinación
- `/app/data` aloja heartbeat del worker y puede alojar storage local si `STORAGE_PROVIDER=local`

### Bordes de dependencia

- `app` comparte CPU, RAM, disco y ventana de despliegue con `analysis-worker`
- si la BD sigue local, compute y data plane caen juntos
- si el storage sigue local, la salida de la VM queda bloqueada aunque la BD ya esté gestionada

## 3. Hechos confirmados y supuestos

### Confirmado en el repo

- `docker-compose.prod.yml` levanta `app`, `analysis-worker` y `postgres` en el mismo host lógico.
- `analysis-worker` escribe heartbeat en `/app/data/runtime`.
- existe provider S3-compatible ya implementado, por lo que el storage no está conceptualmente atado a la VM.
- la cola de jobs vive en PostgreSQL; no hay un broker separado que absorba el desacoplo por sí solo.

### Supuestos pendientes de validación operativa

- el tráfico actual encaja todavía en una VM pequeña
- el objetivo inmediato sigue siendo coste contenido por encima de alta disponibilidad estricta
- la salida natural a futuro será un servicio tipo ECS/Fargate o equivalente con web y worker separados

## 4. Riesgo concreto

La VM única mantiene un único dominio de fallo para web y worker, hace que cada despliegue compita con el procesamiento asíncrono y deja poco margen cuando suben CPU, RAM o backlog. También dificulta distinguir si el problema real es de aplicación, de worker o de capacidad base del host.

## 5. Recomendación mínima y por qué

La recomendación mínima segura es:

- no salir de la VM por intuición ni por moda
- mover primero PostgreSQL a gestionado
- si el storage productivo sigue en `local`, pasarlo antes a S3-compatible
- pasar después `app` y `analysis-worker` a compute gestionado solo cuando se cruce alguno de los triggers del apartado 6

Se prefiere esta secuencia porque reduce primero los acoplamientos estructurales con el menor cambio posible y deja una ruta de rollback simple. Mover compute antes de externalizar datos y artefactos solo ensancha el radio de fallo.

## 6. Triggers de replatform

La VM deja de ser el estado recomendado si se cumple cualquiera de estas condiciones de forma repetida o si un requisito de disponibilidad las vuelve no negociables.

| Área | Trigger de salida | Por qué fuerza el cambio |
| --- | --- | --- |
| CPU | CPU host por encima de `70%` de media durante horario laboral en 3 días de una misma semana, o picos por encima de `90%` con impacto visible en la app. | `app` y `analysis-worker` compiten por CPU y el host deja de absorber picos normales. |
| RAM | RAM por encima de `75%` sostenida durante más de 1 hora en 3 días de una misma semana, aparición de swap sostenido, o cualquier `OOMKilled`. | El margen de seguridad del host deja de ser aceptable para despliegues y ráfagas. |
| Cola de jobs | `queued` con antigüedad mayor de `10 min` en horario laboral, o más de `25` jobs pendientes durante más de `15 min`, o necesidad clara de más de un worker concurrente. | La combinación web+worker en un solo host ya no escala limpiamente. |
| Ventana de despliegue | Cada release exige cortar web y worker más de `5 min`, o ya no se puede asumir una parada conjunta en horario razonable. | El despliegue en VM única se convierte en riesgo operativo y de negocio. |
| Alta disponibilidad | Objetivo explícito de disponibilidad mensual `>= 99.9%`, RTO de pérdida de host `< 30 min`, o requisito contractual de reducir single points of failure. | Una sola VM no cumple esos objetivos de forma defendible. |

## 7. Prerrequisitos antes de activar el cambio

Antes de mover compute, deben cumplirse estos mínimos:

| Prerrequisito | Estado requerido |
| --- | --- |
| PostgreSQL | Ya gestionado y estable; no mezclar la salida de VM con el corte inicial de BD. |
| Storage | `STORAGE_PROVIDER=s3` o equivalente si el producto necesita seguir sirviendo archivos fuera de la VM. |
| Configuración | Secretos y variables de entorno externalizados y reproducibles fuera del host local. |
| Healthchecks | Endpoints y señales de salud válidos por separado para web y worker. |
| Observabilidad | Métricas básicas de CPU, memoria, reinicios, antigüedad de cola y errores de despliegue. |

## 8. Ruta mínima futura preferida

La ruta preferida queda fijada así:

1. `postgres` gestionado y estable
2. storage de objetos fuera de la VM si todavía queda `local`
3. un servicio web gestionado para `app`
4. un servicio worker gestionado aparte para `analysis-worker`
5. escalado independiente solo cuando los datos lo pidan

Objetivo mínimo de la primera iteración de compute gestionado:

- una tarea o servicio para web
- una tarea o servicio para worker
- misma imagen de aplicación si sigue siendo suficiente
- secretos gestionados fuera del host
- rollback posible a la VM anterior durante los primeros días

No se autoriza en esta fase:

- meter un broker nuevo si PostgreSQL sigue siendo suficiente para la cola actual
- introducir más de una capa de balanceo o de routing sin necesidad demostrada
- rediseñar el producto para adaptarlo al proveedor de compute

## 9. Validación mínima de la decisión

Antes de activar el replatform, hay que validar:

### Camino normal

- la carga diaria normal supera al menos uno de los triggers y no se corrige con tuning simple, limpieza operativa o mover antes la base de datos

### Camino de fallo

- la pérdida del host o un despliegue fallido actual tiene un impacto mayor del aceptable para el objetivo de disponibilidad fijado

### Camino de recuperación o rollback

- existe un plan viable para volver temporalmente a la VM anterior con la misma `DATABASE_URL` gestionada y el mismo storage externo

## 10. Validación realizada y validación pendiente

### Validado en repositorio

- hoy `app` y `analysis-worker` comparten host, imagen y ventana de despliegue
- la cola del worker depende de PostgreSQL
- existe compatibilidad conceptual con S3-compatible storage

### Requiere validación en entorno real

- métricas reales de CPU, RAM y backlog en producción
- tiempo real de despliegue con tráfico
- objetivos de disponibilidad asumidos por el negocio
- coste comparado de seguir en VM reforzada frente a compute gestionado

## 11. Riesgo residual, rollback y seguimiento

Riesgo residual mientras se siga en VM:

- web y worker comparten fallo de host
- el despliegue sigue siendo una operación con blast radius conjunto
- si el storage sigue local, la VM sigue siendo también dependencia de artefactos

Notas de rollback para el futuro replatform:

- mantener la definición de la VM anterior intacta hasta que la nueva plataforma complete varios días sin incidentes
- no eliminar el camino de vuelta hasta validar salud, cola y serving de ficheros sobre el nuevo compute

Seguimiento priorizado:

1. Ejecutar primero el corte a PostgreSQL gestionado.
2. Instrumentar métricas reales de CPU, RAM, backlog y duración de despliegues.
3. Revisar este disparador cuando existan datos reales de producción durante al menos dos semanas.
