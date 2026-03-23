# Delta de asignacion fiscal por obligacion

Fecha: 2026-03-22  
Estado: cerrado para la Tarea 1 del plan fiscal  
Ambito: delta documental sin cambios de codigo

## 1. Problema que este delta cierra

Hoy el repo ya persiste `vat_period_assignment` y `withholding_period_assignment`, pero las superficies consumidoras no aplican el mismo criterio:

- [models/fiscal/quarterly-draft.ts](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/models/fiscal/quarterly-draft.ts) y [models/fiscal/legal-archive.ts](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/models/fiscal/legal-archive.ts) aceptan fallback por `operation_date ?? issue_date` cuando no hay asignacion persistida.
- [models/tax-forms/model-303.ts](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/models/tax-forms/model-303.ts) y [models/tax-forms/model-115.ts](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/models/tax-forms/model-115.ts) solo consumen asignacion persistida.

El objetivo de este delta es fijar un contrato unico y ejecutable para todas las superficies de obligacion:

- `review`
- `quarters`
- `archive`
- `303`
- `115`

Este contrato introduce tres piezas funcionales ya asumidas por el rediseño:

- `payment_date`
- `vatCashAccountingEnabled`
- asignacion centralizada por obligacion

## 2. Alcance normalizado

En alcance:

- cerrar la semantica de asignacion temporal para IVA y retenciones
- cerrar la prioridad entre `issue_date`, `operation_date`, `payment_date` y `manual_override`
- definir una matriz canonica de casos con expected sets por superficie
- fijar la regla de inclusion para `quarters` y `archive`
- fijar si una obligacion sin fecha resoluble entra en `review`

Fuera de alcance:

- cambios en Prisma
- cambios en `app/`, `components/`, `models/` o tests de aplicacion
- rediseño del enum global `review_status`
- ampliacion del fixture golden con casos nuevos en esta tarea

## 3. Decision contractual cerrada

La asignacion temporal deja de ser una heuristica local de cada superficie y pasa a ser un resultado centralizado por obligacion.

Consecuencia obligatoria:

- `quarters`, `archive`, `303` y `115` no pueden inventar fallback local por fecha una vez exista asignacion centralizada
- si una obligacion no puede asignarse con su criterio canonico, esa obligacion entra en el set `review`
- una obligacion no resuelta no debe contaminar otra obligacion ya resuelta del mismo documento

Este delta define `review` como set por obligacion y no como traduccion directa al enum actual `review_status`.

Decision de compatibilidad:

- el mapeo posterior desde este `review` por obligacion hacia el `review_status` actual queda para la tarea de codigo
- la semantica de inclusion por superficie ya queda cerrada aqui y no depende de ese mapeo

## 4. Vocabulario adicional

| Termino | Significado contractual |
| --- | --- |
| `payment_date` | Fecha efectiva de pago o cobro relevante para una obligacion de criterio de caja. |
| `vatCashAccountingEnabled` | Flag del perfil fiscal que obliga a asignar el IVA por `payment_date` en lugar de `issue_date` u `operation_date`. |
| `manual_override` | Asignacion persistida y explicita para una obligacion concreta cuando la base temporal automatica no debe usarse o no existe. |
| `review set` | Conjunto de obligaciones del documento que requieren resolucion humana antes de entrar en sus superficies. Valores admitidos en este delta: `vat`, `withholding`. |
| `quarters set` | Conjunto de inclusiones esperadas en borradores trimestrales con forma `YYYY-QN:obligation`. |
| `archive set` | Conjunto de inclusiones esperadas en archivo legal con la misma forma `YYYY-QN:obligation`. |

## 5. Regla unica de asignacion por obligacion

### 5.1 IVA

Prioridad de resolucion para `vat_period_assignment`:

1. `manual_override` del IVA, si existe
2. `payment_date`, si `vatCashAccountingEnabled = true`
3. `operation_date`, si `vatCashAccountingEnabled = false` y existe
4. `issue_date`, si `vatCashAccountingEnabled = false` y no existe `operation_date`

Reglas de fallo:

- si `vatCashAccountingEnabled = true` y falta `payment_date`, el IVA entra en `review`
- no existe fallback de IVA desde `payment_date` a `operation_date` o `issue_date` cuando el perfil esta en criterio de caja

### 5.2 Retenciones

Prioridad de resolucion para `withholding_period_assignment`:

1. `manual_override` de retenciones, si existe
2. `payment_date`, si la retencion aplica

Reglas de fallo:

- si la retencion aplica y faltan `payment_date` y `manual_override`, la retencion entra en `review`
- no existe fallback de retenciones hacia `issue_date`
- no existe fallback de retenciones hacia `operation_date`

### 5.3 Regla de consumo por superficie

- `quarters` incluye un documento en un trimestre si existe al menos una asignacion de ese trimestre
- `archive` replica exactamente la misma semantica que `quarters`
- `303` solo mira `vat_period_assignment`
- `115` solo mira `withholding_period_assignment`
- un mismo documento puede pertenecer a trimestres distintos segun obligacion

## 6. Matriz canonica cerrada

Convencion de la matriz:

- `issue_date = 2026-01-15` equivale a `2026-Q1`
- `operation_date = 2026-04-02` equivale a `2026-Q2`
- `payment_date = 2026-04-20` equivale a `2026-Q2`
- `manual_override = 2026-Q2` significa asignacion persistida explicita para la obligacion indicada
- la columna `review` es un set de obligaciones pendientes de resolucion humana
- las columnas `quarters`, `archive`, `303` y `115` son expected sets cerrados

| Caso | Preconditions | Expected `review` | Expected `quarters` | Expected `archive` | Expected `303` | Expected `115` |
| --- | --- | --- | --- | --- | --- | --- |
| `vat-issue-date-default` | IVA aplicable. `vatCashAccountingEnabled = false`. `issue_date = Q1`. `operation_date = null`. `payment_date = null`. Sin `manual_override`. | `{}` | `{2026-Q1:vat}` | `{2026-Q1:vat}` | `{2026-Q1}` | `{}` |
| `vat-operation-date-default` | IVA aplicable. `vatCashAccountingEnabled = false`. `issue_date = Q1`. `operation_date = Q2`. `payment_date = null`. Sin `manual_override`. | `{}` | `{2026-Q2:vat}` | `{2026-Q2:vat}` | `{2026-Q2}` | `{}` |
| `vat-cash-accounting-payment-date` | IVA aplicable. `vatCashAccountingEnabled = true`. `issue_date = Q1`. `operation_date = Q1`. `payment_date = Q2`. Sin `manual_override`. | `{}` | `{2026-Q2:vat}` | `{2026-Q2:vat}` | `{2026-Q2}` | `{}` |
| `vat-cash-accounting-missing-payment-date` | IVA aplicable. `vatCashAccountingEnabled = true`. `issue_date = Q1`. `operation_date = Q1`. `payment_date = null`. Sin `manual_override`. | `{vat}` | `{}` | `{}` | `{}` | `{}` |
| `vat-manual-override` | IVA aplicable. `vatCashAccountingEnabled = false`. `issue_date = Q1`. `operation_date = Q1`. `payment_date = null`. `manual_override` de IVA a `Q2`. | `{}` | `{2026-Q2:vat}` | `{2026-Q2:vat}` | `{2026-Q2}` | `{}` |
| `rent-payment-date-split-quarter` | Factura con IVA y retencion de alquiler. `vatCashAccountingEnabled = false`. `issue_date = Q1`. `operation_date = null`. `payment_date = Q2`. Sin `manual_override`. | `{}` | `{2026-Q1:vat, 2026-Q2:withholding}` | `{2026-Q1:vat, 2026-Q2:withholding}` | `{2026-Q1}` | `{2026-Q2}` |
| `rent-manual-override-without-payment-date` | Factura con IVA y retencion de alquiler. `vatCashAccountingEnabled = false`. `issue_date = Q1`. `operation_date = null`. `payment_date = null`. `manual_override` de retenciones a `Q2`. | `{}` | `{2026-Q1:vat, 2026-Q2:withholding}` | `{2026-Q1:vat, 2026-Q2:withholding}` | `{2026-Q1}` | `{2026-Q2}` |
| `rent-missing-payment-date-without-override` | Factura con IVA y retencion de alquiler. `vatCashAccountingEnabled = false`. `issue_date = Q1`. `operation_date = null`. `payment_date = null`. Sin `manual_override`. | `{withholding}` | `{2026-Q1:vat}` | `{2026-Q1:vat}` | `{2026-Q1}` | `{}` |

## 7. Criterios de aceptacion

La tarea queda bien interpretada si cualquier implementacion futura puede demostrar lo siguiente:

- la asignacion centralizada produce exactamente los expected sets de la matriz anterior
- `quarters` y `archive` dejan de usar fallback local por `operation_date ?? issue_date`
- `303` y `115` siguen dependiendo solo de asignaciones persistidas
- una factura de alquiler puede entrar en `303` y `115` en trimestres distintos
- una retencion sin `payment_date` ni `manual_override` queda fuera de `115`
- una retencion sin `payment_date` ni `manual_override` no expulsa al IVA ya resuelto de `303`, `quarters` y `archive`
- el criterio de caja del IVA solo usa `payment_date`
- `manual_override` gana siempre frente a la base temporal automatica de la misma obligacion

Frontera de fallo:

- si `quarters` o `archive` muestran un documento por simple pertenencia de `issue_date` u `operation_date` sin asignacion centralizada
- si `115` usa `issue_date` u `operation_date` como fallback
- si una ausencia de asignacion de retenciones impide por defecto que el IVA resuelto aparezca en sus superficies
- si `vatCashAccountingEnabled = true` permite caer silenciosamente a `issue_date` o `operation_date`

## 8. Impacto contractual sobre codigo futuro

Este delta obliga a alinear el comportamiento de estas superficies:

- [models/fiscal/quarterly-draft.ts](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/models/fiscal/quarterly-draft.ts)
- [models/fiscal/legal-archive.ts](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/models/fiscal/legal-archive.ts)
- [models/tax-forms/model-303.ts](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/models/tax-forms/model-303.ts)
- [models/tax-forms/model-115.ts](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/models/tax-forms/model-115.ts)

Decision material para implementacion:

- la inclusion por superficie debe pasar a depender del resultado centralizado por obligacion
- la ausencia de asignacion de una obligacion no autoriza fallback local
- el tratamiento del `review_status` agregado del documento puede resolverse despues, pero no puede contradecir los expected sets de esta spec

## 9. Impacto sobre el fixture golden

No hace falta modificar [tests/fixtures/fiscal/golden-quarter.json](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/tests/fixtures/fiscal/golden-quarter.json) en esta tarea.

Motivo:

- el fixture actual ya contiene el caso positivo de retencion con `manual_override` en `received-rent-withholding`
- no existe en el fixture actual ningun caso que contradiga la regla cerrada de "retenciones solo con `payment_date` o `manual_override`"
- los casos nuevos de matriz cerrada son requerimiento documental para la siguiente tarea de implementacion y ampliacion del dataset, no un prerequisito para mantener consistente el fixture actual

## 10. Siguientes pasos recomendados para handoff

- implementar un resolvedor central de asignacion por obligacion que materialice esta matriz
- adaptar `quarters` y `archive` para consumir solo el resolvedor central
- ampliar el golden dataset con los casos negativos y cross-quarter de esta matriz en una tarea posterior
