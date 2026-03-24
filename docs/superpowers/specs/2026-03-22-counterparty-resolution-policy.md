# Política V1 de resolución de contraparte

Fecha: 2026-03-22  
Estado: propuesta congelada para implementación V1  
Ámbito: TaxHacker España, flujos fiscales base

## 1. Objetivo

Definir una política corta y ejecutable para resolver la contraparte de un documento fiscal sin mezclar dos cosas distintas:

- suficiencia del dato identificativo fiscal observado en el documento
- vínculo canónico interno con una `Counterparty` del producto

La política V1 debe:

- permitir `auto-link` solo cuando sea materialmente seguro
- pedir confirmación humana cuando haya ambigüedad o sensibilidad fiscal
- evitar bloquear por defecto flujos donde el vínculo canónico no es exigencia fiscal directa
- sustituir el aviso ambiguo actual por estados y copy que expliquen la acción pendiente real

## 2. Política conservadora base

Base V1: `conservadora`.

Reglas globales:

- `auto-link` solo con `counterparty_tax_id` normalizado y coincidencia exacta contra una única contraparte activa
- no hacer `auto-link` por nombre, similitud, OCR aproximado o heurística difusa
- si existe conflicto, duplicidad, candidata inactiva o rechazo humano previo, no hay `auto-link`
- el dato fiscal observado en el documento manda sobre el master; enlazar no debe reescribir la evidencia capturada
- si el flujo requiere confirmación humana, el documento no sale de revisión hasta confirmarla
- si el flujo no exige vínculo canónico para quedar listo, el sistema puede sugerirlo sin bloquear

## 3. Semántica: dato fiscal vs vínculo canónico

### 3.1 Dato identificativo fiscal

Es la identificación observada en el documento o en su evidencia fuente. En V1 vive en:

- `counterparty_name`
- `counterparty_tax_id`
- `counterparty_country_code`

Su función es cubrir trazabilidad fiscal, libros y modelos. Es evidencia del documento, no una deduplicación de producto.

### 3.2 Vínculo canónico con contraparte

Es la relación interna `counterparty_id -> Counterparty`.

Su función es:

- deduplicar terceros
- agrupar documentos
- mejorar revisión y trazabilidad interna
- soportar flujos sensibles como alquiler con retención

No equivale por sí solo a un requisito legal uniforme para todos los documentos.

### 3.3 Regla de precedencia

- si cambia el vínculo canónico, no se deben borrar ni “corregir en silencio” los datos fiscales observados
- el master puede enriquecer el workflow, pero no sustituir la evidencia documental
- la UI y los reasons deben distinguir entre `faltan datos fiscales` y `falta confirmar vínculo canónico`

## 4. Matriz por flujo

| Flujo | Mínimo de dato identificativo fiscal para V1 | Estado del vínculo canónico | `auto-link` | `sugerir` | Cuándo exigir confirmación humana |
| --- | --- | --- | --- | --- | --- |
| Factura recibida | `counterparty_name` obligatorio. `counterparty_tax_id` obligatorio si la factura es completa y el dato es legible. | Recomendado. No debe bloquear por sí solo si el documento ya queda fiscalmente identificable y no hay retención sensible. | Solo con NIF exacto, única activa, sin conflictos. | Sí, si hay una candidata razonable pero no segura. | Cuando el usuario quiera enlazar una sugerencia no segura, crear nueva contraparte o resolver conflicto. |
| Factura emitida | `counterparty_name` obligatorio cuando la factura identifica destinatario. `counterparty_tax_id` obligatorio en factura completa B2B. | Recomendado. No bloqueante por defecto en V1 fuera de flujos sensibles. | Solo con NIF exacto, única activa, sin conflictos. | Sí. | Cuando no haya `auto-link` seguro y el usuario quiera dejar vínculo canónico resuelto. |
| Factura simplificada | Nombre fiscal solo si existe en la evidencia. `counterparty_tax_id` puede faltar. | Opcional en V1. | No, salvo que exista NIF exacto y único. | Sí, si hay candidata clara y el usuario puede confirmarla. | Solo si el usuario decide enlazar o si el documento se reclasifica a flujo más estricto. La falta de vínculo canónico no bloquea por sí sola. |
| Alquiler con retención | `counterparty_name` y `counterparty_tax_id` obligatorios. | Obligatorio para salir de revisión. | Solo con NIF exacto, única activa, sin conflictos. | Sí, pero sigue en revisión hasta confirmación. | Siempre que no exista `auto-link` seguro. También cuando haya conflicto o candidato inactivo. |
| `payroll_placeholder` | Puede existir nombre observado; el NIF puede faltar. | No requerido en V1. | No. | No, salvo futura evolución fuera de alcance. | No aplica a resolución de contraparte V1; el documento sigue `blocked` por falta de fuente de nómina fiable. |

## 5. Reglas operativas

### 5.1 Cuándo hacer `auto-link`

Solo si se cumplen todas:

- existe `counterparty_tax_id` normalizado
- hay exactamente una contraparte activa con ese NIF
- no hay conflictos de unicidad, contraparte inactiva ni rechazo humano previo
- el flujo permite automatización conservadora

Resultado esperado:

- se rellena `counterparty_id`
- se conserva el nombre/NIF observados
- se registra evento auditable de `auto-linked`

### 5.2 Cuándo sugerir

Se puede sugerir, pero no enlazar automáticamente, cuando:

- no hay NIF seguro pero hay una candidata razonable por nombre normalizado u otra señal débil
- hay NIF pero existen varias candidatas posibles o una única candidata no activa
- el usuario ya tiene una contraparte previa parecida y el sistema cree que merece revisión

La sugerencia nunca debe mover el documento a listo por sí sola.

### 5.3 Cuándo exigir confirmación humana

La confirmación humana es obligatoria cuando:

- el flujo es `alquiler con retención` y no ha habido `auto-link` seguro
- el usuario acepta una sugerencia no segura
- el usuario rechaza la sugerencia y elige otra contraparte
- el usuario crea una contraparte nueva a partir del documento
- existe conflicto entre el dato fiscal observado y la contraparte candidata

## 6. Copy recomendado para sustituir el aviso ambiguo actual

No usar más: `Hay que confirmar la relación con la contraparte`.

Reemplazo recomendado por tipo de problema:

- `Faltan datos identificativos fiscales de la contraparte. Revisa nombre y NIF antes de incluir este documento en el flujo fiscal que corresponda.`
- `La contraparte del documento ya está identificada, pero falta confirmar su vínculo con una contraparte canónica de TaxHacker.`
- `Hemos encontrado una posible contraparte, pero no es seguro enlazarla automáticamente. Revísala antes de confirmar.`
- `Este alquiler con retención necesita una contraparte confirmada y un NIF válido antes de entrar en 115/180.`
- `Este payroll placeholder no se resuelve por contraparte en V1; sigue bloqueado hasta tener una fuente de nómina fiable.`

CTA recomendados:

- `Confirmar contraparte`
- `Elegir otra contraparte`
- `Crear nueva contraparte`
- `Mantener en revisión`

## 7. Exclusiones V1

Fuera de alcance en V1:

- `auto-link` difuso por nombre sin NIF
- scoring probabilístico o ML para enlazar contraparte
- creación automática de contraparte a partir de evidencia débil
- confirmación masiva en bloque
- merge automático de contraparte tras un conflicto
- reglas especiales de SII, facturación electrónica B2B o validaciones fuera del alcance fiscal ya aprobado
- automatización de `payroll_placeholder` o uso de nómina no estructurada como fuente resolutiva
- maestro global compartido entre tenants o sociedades

## 8. Criterios de aceptación y frontera de fallo

Aceptación mínima:

- el sistema distingue entre falta de dato fiscal y falta de vínculo canónico
- una factura simplificada puede quedar lista sin `counterparty_id` si el flujo no es sensible y los datos fiscales disponibles son suficientes para V1
- un alquiler con retención no queda listo sin NIF válido y contraparte confirmada o autoenlazada de forma segura
- ningún flujo hace `auto-link` por nombre sin NIF
- `payroll_placeholder` no entra en este circuito como documento resoluble

Frontera de fallo:

- bloquear una factura simplificada solo por ausencia de vínculo canónico cuando no existe obligación más estricta
- dejar listo un alquiler con retención sin identificación suficiente o sin confirmación canónica
- mostrar copy que haga parecer que el problema legal y el problema interno de linkage son lo mismo
- sobrescribir evidencia fiscal del documento con datos del master al enlazar
