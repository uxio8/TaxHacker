# Golden Quarter Dataset Q1 2026

## Objetivo

Definir un fixture canónico y estable para validar de forma determinista:

- `review_status`
- líneas de libro IVA
- contribuciones por documento a Modelo 303
- contribuciones por documento a Modelo 115
- agregados trimestrales de Q1 2026

El dataset representa una S.L. española pequeña, ejercicio natural, IVA trimestral, con empleados, con alquiler con retención y sin intracomunitarias. V1 queda fijado a `EUR`. Rectificativas fuera de corte. Modelo 111 sigue gated y solo aparece como `payroll_placeholder`.

## Alcance

El fixture vive en [tests/fixtures/fiscal/golden-quarter.json](/Users/uxiomarcosmacmini/Documents/Nuevos desarrollos/taxhacker/tests/fixtures/fiscal/golden-quarter.json) y contiene facts fiscales canónicos, no transacciones OCR crudas. La intención es que backend pueda cargar el JSON y comparar salidas exactas sin resolver ambigüedades de mapping.

Se incluyen los casos mínimos obligatorios:

- factura recibida con IVA deducible
- factura de alquiler con retención
- factura emitida
- gasto no deducible
- documento con varias líneas y varios tipos de IVA
- documento mixto deducible/no deducible
- `payroll_placeholder`

Además se añade un caso de control `needs_review` para cerrar mejor la validación de `review_status` sin ampliar el alcance funcional.

## Convenciones del oracle

- Todos los importes monetarios están en céntimos.
- Todos los tipos porcentuales están en basis points.
- Solo los documentos con `review_status = ready` pueden generar líneas de libro IVA o entrar en 303/115.
- `payroll_placeholder` siempre queda fuera de 303, 115 y libros IVA.
- En 303 se separan tres vistas:
  - `output_vat_by_rate`
  - `input_vat_deductible_by_rate`
  - `input_vat_non_deductible_by_rate`
- Semántica estricta de `model_303_contribution.included`:
  - `included = true` si el documento aporta cualquier importe distinto de cero a cualquiera de los buckets del 303, aunque toda su aportación sea no deducible.
  - `included = false` solo si todos los buckets del 303 valen cero.
  - `expected_quarter.model_303.documents_included` debe contener exactamente los `fiscal_document_id` con `included = true`.
- En 115 solo cuentan líneas con `withholding_regime = rent` y readiness positiva.
- `perceptor_count` de 115 se calcula por `counterparty_id` único dentro del trimestre.
- Las líneas agregadas de libro IVA están ordenadas por `issue_date`, `invoice_number`, `line_number`.

## Estructura del fixture

Cada documento expone dos bloques:

- `document`: cabecera y líneas canónicas alineadas con el contrato fiscal
- `expected`: oracle cerrado por documento

Campos esperados en `expected`:

- `review`
- `vat_book_lines`
- `model_303_contribution`
- `model_115_contribution`

Además existe un bloque `expected_quarter` con los agregados trimestrales definitivos.

## Inventario de casos

| `case_id` | Caso | Estado esperado | En libro IVA | En 303 | En 115 |
| --- | --- | --- | --- | --- | --- |
| `received-office-supplies` | Factura recibida deducible al 21% | `ready` | sí | sí | no |
| `received-rent-withholding` | Alquiler con IVA 21% y retención 19% | `ready` | sí | sí | sí |
| `issued-services-invoice` | Factura emitida al 21% | `ready` | sí | sí | no |
| `received-team-meal-nondeductible` | Gasto no deducible al 10% | `ready` | sí | sí, solo bucket no deducible | no |
| `received-mixed-vat-rates` | Factura recibida con líneas al 21% y 4% | `ready` | sí | sí | no |
| `received-mixed-deductibility` | Factura recibida con una línea deducible y otra no deducible | `ready` | sí | sí parcial | no |
| `payroll-placeholder-blocked` | Nómina sin fuente estructurada | `blocked` | no | no | no |
| `received-missing-counterparty-relation` | Caso de control con relación fuerte ausente | `needs_review` | no | no | no |

## Oracle trimestral esperado

### Review status

- `ready`: 6 documentos
- `needs_review`: 1 documento
- `blocked`: 1 documento
- `pending`: 0 documentos

### Libro IVA

- libro recibido: 7 líneas
- libro emitido: 1 línea

### Modelo 303

Buckets esperados del trimestre:

- IVA repercutido:
  - `2100`: base `200000`, cuota `42000`
  - `1000`: base `0`, cuota `0`
  - `400`: base `0`, cuota `0`
- IVA soportado deducible:
  - `2100`: base `155000`, cuota `32550`
  - `1000`: base `0`, cuota `0`
  - `400`: base `12000`, cuota `480`
- IVA soportado no deducible:
  - `2100`: base `0`, cuota `0`
  - `1000`: base `23000`, cuota `2300`
  - `400`: base `0`, cuota `0`

Totales esperados:

- `output_vat_total_cents = 42000`
- `input_vat_deductible_total_cents = 33030`
- `result_vat_payable_cents = 8970`

### Modelo 115

- perceptores únicos: `1`
- base sujeta a retención: `100000`
- retención trimestral: `19000`

## Cierre

El oracle queda deliberadamente cerrado:

- cada documento declara su estado esperado
- cada línea esperada de libro IVA aparece materializada
- cada documento declara su contribución exacta a 303 y 115
- los agregados trimestrales reconcilián exactamente con la suma de contribuciones incluidas

Con esto, backend puede escribir tests deterministas tanto a nivel unitario por documento como a nivel de agregación trimestral sin depender de inferencias externas.
