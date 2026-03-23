# Guided Workflow Contract

## Objetivo
Mantener la estética actual y superponer una capa única de guiado para que toda la app responda a las mismas preguntas:
- qué requiere atención ahora
- qué bloquea
- cuál es el siguiente paso
- en qué superficie conviene resolverlo

## Ciclo de vida canónico
- `captured`: el documento ya ha entrado al sistema
- `analyzing`: el análisis sigue en cola o en proceso
- `needs_review`: ya hay borrador y requiere validación humana
- `registered`: el documento ya ha generado una transacción válida
- `needs_tax_attention`: existe impacto fiscal pendiente
- `ready_to_close`: no quedan bloqueos para avanzar en el periodo
- `blocked`: hay una dependencia que impide cerrar el siguiente paso
- `deferred_to_desktop`: el flujo móvil cede el control al escritorio

## Señales transversales
- `priority`: `critical`, `high`, `medium`, `low`
- `nextAction`: CTA principal recomendado
- `blockingReason`: texto corto cuando el estado impide avanzar
- `recommendedSurface`: `dashboard`, `settings`, `unsorted`, `transactions`, `tax`, `capture`
- `humanReason`: explicación breve orientada al usuario final

## Reglas
- `dashboard` resume prioridad y siguiente acción
- `unsorted` es el inbox canónico de revisión documental
- `capture` es la entrada rápida y delega a escritorio cuando falta contexto
- `transactions` es libro operativo y superficie de corrección
- `tax` decide el siguiente paso fiscal real
- no se cambia el sistema visual base
