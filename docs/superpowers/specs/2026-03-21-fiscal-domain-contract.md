# Contrato del dominio fiscal canónico

Fecha: 2026-03-21  
Estado: congelado para la Task 0.1  
Ámbito: contrato funcional previo a Prisma y previo a cualquier código de aplicación

## 1. Problema y alcance normalizado

TaxHacker necesita un contrato fiscal canónico para una S.L. española pequeña, con ejercicio natural, IVA trimestral, fuera de SII, con empleados, con alquiler sujeto a retención y sin operaciones intracomunitarias.

El objetivo de este documento es fijar una semántica única para transformar una transacción genérica del producto en facts fiscales utilizables por:

- periodos fiscales trimestrales
- cierre trimestral
- preparación de Modelo 303
- preparación de Modelo 115
- advisor pack

Queda expresamente fuera del objetivo de esta Task diseñar Prisma, interfaces o workflows de aplicación. Este documento congela vocabulario, límites y reglas mínimas para que el subagente de backend modele sin ambigüedad la diferencia entre cabecera fiscal y líneas fiscales.

## 2. Alcance confirmado

En alcance para V1:

- facturas emitidas
- facturas recibidas
- documentos con una o varias líneas fiscales
- maestro de terceros operativo con relación fuerte desde el fact fiscal
- IVA soportado y repercutido a nivel de línea
- retención a nivel de línea
- deducibilidad a nivel de línea
- estado de revisión fiscal a nivel de documento
- asignación de periodo fiscal para IVA y para retenciones
- caso específico de alquiler con retención
- caso específico de empleados solo como fact fiscal bloqueado o gated hasta tener fuente de nómina válida

Fuera de alcance para V1:

- SII
- REDEME
- operaciones intracomunitarias
- inversión del sujeto pasivo
- criterio de caja
- bienes de inversión y prorrata compleja
- recargo de equivalencia
- canarias, ceuta o melilla
- facturación electrónica B2B reglamentaria
- VERI*FACTU
- facturas rectificativas o `credit_note` en el primer corte Prisma/V1
- automatización completa de Modelo 111 sin fuente de nómina fiable
- Modelo 190
- Modelo 347
- Modelo 390
- Impuesto sobre Sociedades 200/202

## 3. Vocabulario canónico

| Término | Significado canónico | No significa |
| --- | --- | --- |
| `transacción genérica` | Registro actual de producto capturado desde OCR, CSV o alta manual. Puede ser incompleto o ambiguo. | Un hecho fiscal listo para modelos. |
| `fact fiscal` | Documento normalizado que representa un hecho fiscal con semántica estable. Es la unidad que entra en libros, periodos y modelos. | La transacción cruda ni una fila del banco. |
| `cabecera fiscal` | Datos comunes al documento completo: identidad, contraparte, fechas, totales agregados, estado de revisión y asignación a periodo. | El lugar donde vivirán bases, tipos o cuotas de cada línea. |
| `línea fiscal` o `tax line` | Línea homogénea en tratamiento fiscal. Cada línea tiene su propia base, IVA, retención y deducibilidad. | Una línea visual del PDF sin relevancia fiscal obligatoria. |
| `contraparte fiscal` | Cliente, proveedor, arrendador o empleado asociado al fact fiscal. | El texto libre `merchant` sin normalizar. |
| `asignación de periodo` | Decisión explícita de a qué trimestre pertenece el documento para cada obligación tributaria. | Un simple uso de `issuedAt` sin criterio declarado. |
| `review status` | Estado que indica si el documento puede o no entrar en libros, cierres y modelos. | El estado del workflow de UX o de OCR. |
| `deducibilidad` | Porcentaje de IVA soportado deducible por línea y, opcionalmente, motivo de restricción. | La categoría contable o de gasto. |
| `retención` | Importe retenido a declarar, calculado sobre la base sujeta a retención, normalmente para alquiler o nómina. | Un descuento comercial. |

## 4. Principios del modelo

- La unidad canónica es el `fact fiscal`.
- Un `fact fiscal` tiene exactamente una `cabecera fiscal`.
- Un `fact fiscal` tiene una o más `líneas fiscales`, salvo el caso excepcional de `payroll_placeholder`, que puede existir con importes fiscales a cero y un importe observado no fiscal separado.
- Las líneas fiscales son la única fuente de verdad para base imponible, tipo de IVA, cuota de IVA, base de retención, tipo de retención, cuota de retención y deducibilidad.
- La cabecera solo puede guardar agregados derivados de las líneas y metadatos comunes.
- La asignación de periodo no es única para todo el documento: V1 necesita, como mínimo, una asignación para IVA y otra para retenciones.
- Los importes canónicos deben expresarse con precisión de céntimo. Los tipos porcentuales deben expresarse con precisión mínima de basis points.
- `direction` es canónica y primaria en V1. No debe depender de inferencia tardía desde otros campos.
- V1 queda fijado a moneda fiscal única `EUR`. Cualquier soporte multimoneda queda para track futuro.
- En V1, los enums no usan `null` cuando exista una ausencia semántica canónica; se usan valores como `none`, `unknown` o `not_applicable`. `null` queda reservado para texto libre, relaciones opcionales transitorias y objetos no aplicables.
- Si backend decide usar `Decimal` en Prisma en vez de enteros, la semántica no cambia: importes en moneda fiscal, tipos como porcentaje exacto, sin floats binarios.

## 5. Modelo canónico mínimo

### 5.1 Cabecera fiscal

Campos mínimos obligatorios de la cabecera:

| Campo | Tipo lógico | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `fiscal_document_id` | string | sí | Identificador interno estable del fact fiscal. |
| `source_transaction_id` | string | sí | Referencia a la transacción genérica origen. |
| `document_kind` | enum | sí | `issued_invoice`, `received_invoice`, `payroll_placeholder`. |
| `direction` | enum | sí | `outgoing` o `incoming`. Campo primario y canónico en V1. |
| `invoice_number` | string \| null | no | Número de factura o referencia documental. Obligatorio para `ready` salvo `payroll_placeholder`. |
| `invoice_series` | string \| null | no | Serie si existe. |
| `issue_date` | date | sí | Fecha documental principal. |
| `operation_date` | date \| null | no | Fecha de operación/devengo si difiere de `issue_date`. |
| `currency_code` | enum | sí | En V1 solo se admite `EUR`. Multimoneda queda fuera del corte actual. |
| `counterparty_id` | string \| null | no | Relación fuerte a `Counterparty`. Obligatoria para `ready` salvo `payroll_placeholder`. Resuelve identidad dentro del ámbito de unicidad V1 definido en el apartado 5.1.1. |
| `counterparty_role` | enum | sí | `customer`, `supplier`, `landlord`, `employee`, `unknown`. |
| `counterparty_name` | string \| null | no | Campo transitorio de captura o resolución. Sirve para alta o matching cuando todavía no existe `counterparty_id`. |
| `counterparty_tax_id` | string \| null | no | Campo transitorio de captura o resolución. Si existe, debe usarse como identidad fiscal preferente de `Counterparty`. |
| `counterparty_country_code` | string | sí | En V1 valor canónico `ES`, salvo track futuro. |
| `company_tax_id` | string \| null | no | NIF de la sociedad emisora o receptora. Recomendado en snapshot. |
| `review_status` | enum | sí | `pending`, `needs_review`, `ready`, `blocked`. |
| `review_reasons` | string[] | sí | Lista de códigos explicativos, vacía si `ready`. |
| `vat_period_assignment` | objeto \| null | no | Trimestre al que va el IVA del documento. |
| `withholding_period_assignment` | objeto \| null | no | Trimestre al que va la retención del documento. |
| `observed_amount_cents` | integer | sí | Importe observado no fiscal. En documentos normales será `0`. En `payroll_placeholder` recoge el movimiento observado. |
| `total_net_cents` | integer | sí | Suma de bases de todas las líneas. |
| `total_vat_cents` | integer | sí | Suma de cuotas de IVA de todas las líneas. |
| `total_withholding_cents` | integer | sí | Suma de cuotas de retención de todas las líneas. |
| `total_gross_cents` | integer | sí | `total_net_cents + total_vat_cents`. |
| `total_payable_cents` | integer | sí | `total_gross_cents - total_withholding_cents`. |
| `source_confidence` | enum | sí | `manual`, `ocr_partial`, `ocr_complete`, `imported`. |
| `notes` | string \| null | no | Observaciones fiscales o motivo humano de revisión. |

Definición mínima de `vat_period_assignment` y `withholding_period_assignment`:

| Campo | Tipo lógico | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `fiscal_year` | integer | sí | Año fiscal, en V1 coincide con año natural. |
| `quarter` | integer | sí | `1`, `2`, `3`, `4`. |
| `period_key` | string | sí | Formato recomendado `YYYY-QN`, por ejemplo `2026-Q1`. |
| `basis` | enum | sí | `issue_date`, `operation_date`, `payment_date`, `manual_override`. |
| `assigned_at` | datetime | sí | Momento de asignación. |

### 5.1.1 Contrato mínimo de `Counterparty`

`Counterparty` es la entidad maestra operativa de tercero para V1. Su objetivo es evitar duplicados materiales en cierres y permitir una relación fuerte desde cada fact fiscal `ready`.

Ámbito de unicidad:

- la unicidad de `Counterparty` es por ámbito del contribuyente propietario, no global
- el ámbito propietario debe ser la entidad fiscal dueña del dato en Prisma V1
- si el schema todavía no tiene `FiscalProfile`, el equivalente práctico es el propietario fiscal actual del workspace o usuario
- dos terceros con el mismo NIF en compañías distintas pueden coexistir; dentro de la misma sociedad no

Clave canónica primaria y fallback:

- la clave primaria técnica de la entidad es `counterparty_id`
- además, toda entidad debe tener una clave canónica de negocio `canonical_identity_key`
- si existe NIF normalizado, `canonical_identity_key` debe construirse como `ES:NIF:<tax_id_normalized>`
- si no existe NIF, el fallback obligatorio es `ES:NAME:<normalized_name_fingerprint>`
- `normalized_name_fingerprint` debe derivarse, como mínimo, de:
  - mayúsculas
  - trim de espacios
  - colapso de espacios internos
  - eliminación de puntuación no significativa
- el fallback por nombre solo vale dentro del ámbito del contribuyente propietario y se considera identidad débil, pero suficiente para V1
- si posteriormente aparece un NIF fiable para una contraparte creada por fallback, la entidad debe consolidarse a la clave por NIF sin cambiar `counterparty_id`

Campos mínimos obligatorios de `Counterparty`:

| Campo | Tipo lógico | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `counterparty_id` | string | sí | Clave primaria técnica estable. |
| `owner_scope_id` | string | sí | Ámbito del contribuyente propietario donde aplica la unicidad. |
| `canonical_identity_key` | string | sí | Clave canónica de negocio única dentro de `owner_scope_id`. |
| `identity_basis` | enum | sí | `tax_id` o `name_fallback`. |
| `display_name` | string | sí | Nombre visible canónico del tercero. |
| `normalized_name` | string | sí | Nombre normalizado para matching y fallback. |
| `tax_id` | string \| null | no | NIF/NIE/CIF si existe. |
| `tax_id_normalized` | string | sí | NIF normalizado o `none` si no existe. |
| `country_code` | enum | sí | En V1 solo `ES`. |
| `is_active` | boolean | sí | Indicador operativo básico. |

Reglas de unicidad V1:

- unicidad obligatoria de `canonical_identity_key` dentro de `owner_scope_id`
- si `identity_basis = tax_id`, entonces `tax_id_normalized != none`
- si `identity_basis = name_fallback`, entonces `tax_id_normalized = none`
- si `identity_basis = name_fallback`, entonces `normalized_name` no puede estar vacío

Roles:

- en V1 el rol fiscal autoritativo vive en el fact fiscal, en `counterparty_role`
- `Counterparty` no necesita un campo de rol autoritativo para Prisma V1
- si más adelante se añaden tags o roles agregados en la entidad, deberán ser derivados de los facts y nunca sustituirán el rol del documento concreto

Consecuencia operativa:

- un mismo `Counterparty` puede aparecer como `supplier` en una factura recibida y como `landlord` en otra
- el cálculo fiscal siempre debe leer el rol del fact, no de la entidad maestra

### 5.2 Líneas fiscales

Cada línea fiscal debe representar un tratamiento fiscal homogéneo. Campos mínimos:

| Campo | Tipo lógico | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `line_id` | string | sí | Identificador interno estable de la línea. |
| `fiscal_document_id` | string | sí | Referencia a la cabecera. |
| `line_number` | integer | sí | Orden dentro del documento. |
| `concept` | string | sí | Descripción fiscal corta de la línea. |
| `base_amount_cents` | integer | sí | Base imponible o base fiscal de la línea. En V1 no se admiten rectificativas. |
| `vat_treatment` | enum | sí | `taxable`, `exempt`, `non_subject`, `out_of_scope`. |
| `vat_rate_bps` | integer | sí | Tipo de IVA en basis points. `2100` = 21%. Si no aplica, `0`. |
| `vat_amount_cents` | integer | sí | Cuota de IVA de la línea. Si no aplica, `0`. |
| `withholding_applicable` | boolean | sí | Indica si la línea soporta retención. |
| `withholding_regime` | enum | sí | `rent`, `salary`, `none`. |
| `withholding_base_cents` | integer | sí | Base sujeta a retención. Si no aplica, `0`. |
| `withholding_rate_bps` | integer | sí | Tipo de retención. Si no aplica, `0`. |
| `withholding_amount_cents` | integer | sí | Cuota retenida. Si no aplica, `0`. |
| `deductibility_percent_bps` | integer | sí | `0` a `10000`. Para IVA repercutido debe ser `0`. |
| `deductibility_reason` | enum | sí | `fully_deductible`, `partially_deductible`, `non_deductible`, `blocked_missing_support`, `not_applicable`. |
| `expense_family` | enum | sí | `rent`, `payroll`, `services`, `supplies`, `meals`, `other`, `none`. |
| `is_ready_for_vat_books` | boolean | sí | Derivado de la línea y de la cabecera. |
| `is_ready_for_withholding_books` | boolean | sí | Derivado de la línea y de la cabecera. |

### 5.3 Catálogos mínimos recomendados

`document_kind`

- `issued_invoice`
- `received_invoice`
- `payroll_placeholder`

`review_status`

- `pending`: mapeado automático inicial, todavía no validado.
- `needs_review`: el sistema tiene estructura suficiente pero hay dudas materiales.
- `ready`: puede entrar en libros, periodos y modelos del ámbito V1.
- `blocked`: no puede computar fiscalmente hasta resolver faltantes.

Códigos mínimos de `review_reasons`

- `missing_invoice_number`
- `missing_counterparty_relation`
- `missing_counterparty_tax_id`
- `missing_vat_breakdown`
- `mixed_tax_treatment_unresolved`
- `missing_rent_withholding`
- `employee_payroll_source_missing`
- `period_assignment_unclear`
- `manual_override_required`
- `header_totals_mismatch`
- `invalid_currency_code`
- `invalid_direction_document_kind_combo`

Severidad canónica de `review_reasons`

Razones bloqueantes:

- `missing_vat_breakdown`
- `missing_rent_withholding`
- `employee_payroll_source_missing`
- `period_assignment_unclear`
- `manual_override_required`
- `header_totals_mismatch`
- `invalid_currency_code`
- `invalid_direction_document_kind_combo`

Razones revisables pero no bloqueantes:

- `missing_invoice_number`
- `missing_counterparty_relation`
- `missing_counterparty_tax_id`
- `mixed_tax_treatment_unresolved`

## 5.4 Semántica cerrada de readiness

La readiness es derivable y no admite interpretación libre.

Regla 1. `review_status = pending`

- se usa solo cuando el documento todavía no tiene clasificación fiscal mínima
- condición exacta: falta cualquiera de estos mínimos estructurales: `document_kind`, `direction` o al menos una línea fiscal
- un documento `pending` no puede tener `is_ready_for_vat_books = true` ni `is_ready_for_withholding_books = true`

Regla 2. `review_status = blocked`

- condición exacta: existe al menos una `review_reason` bloqueante
- un documento `blocked` no puede entrar en libros ni modelos

Regla 3. `review_status = needs_review`

- condición exacta: no está `pending`, no está `blocked` y existe al menos una `review_reason` revisable
- un documento `needs_review` tampoco entra en libros ni modelos

Regla 4. `review_status = ready`

- condición exacta: no está `pending`, no tiene ninguna `review_reason` y cumple todas las invariantes del apartado 7
- `ready` es el único estado que permite readiness fiscal positiva

Regla 5. `is_ready_for_vat_books`

- valor derivado por línea
- es `true` solo si:
  - `review_status = ready`
  - `document_kind` es `issued_invoice` o `received_invoice`
  - `vat_period_assignment` existe
  - la línea tiene un `vat_treatment` válido
  - si `vat_treatment = taxable`, entonces `vat_rate_bps > 0`
  - si `vat_treatment` es `exempt`, `non_subject` u `out_of_scope`, entonces `vat_rate_bps = 0` y `vat_amount_cents = 0`
- en cualquier otro caso es `false`

Regla 6. `is_ready_for_withholding_books`

- valor derivado por línea
- es `true` solo si:
  - `review_status = ready`
  - `withholding_applicable = true`
  - `withholding_regime = rent`
  - `withholding_base_cents > 0`
  - `withholding_rate_bps > 0`
  - `withholding_amount_cents > 0`
  - `withholding_period_assignment` existe
- en cualquier otro caso es `false`

Regla 7. Cuándo exigir `withholding_period_assignment`

- es obligatorio si existe al menos una línea con `is_ready_for_withholding_books = true`
- es obligatorio si existe al menos una línea con `withholding_applicable = true` y el documento aspira a `review_status = ready`
- no se exige para documentos sin retención
- no se exige para `payroll_placeholder` en V1 porque siempre queda `blocked`

Regla 8. `payroll_placeholder`

- siempre debe quedar en `review_status = blocked`
- siempre debe tener `is_ready_for_vat_books = false`
- siempre debe tener `is_ready_for_withholding_books = false`
- siempre debe dejar los importes fiscales a cero
- el importe observado del movimiento vive en `observed_amount_cents`

## 6. Reglas funcionales mínimas

### 6.1 Regla general de IVA

- El IVA siempre vive en línea, no en cabecera.
- Un documento con varios tipos de IVA necesita varias líneas fiscales si la base o el tipo no son homogéneos.
- `vat_treatment = taxable` exige `vat_rate_bps > 0` y `vat_amount_cents != 0`, salvo base cero.
- `vat_treatment = exempt`, `non_subject` u `out_of_scope` exige `vat_rate_bps = 0` y `vat_amount_cents = 0`.
- Para facturas recibidas, la deducibilidad del IVA soportado también vive en línea y no puede inferirse solo desde la categoría contable.

### 6.2 Regla general de deducibilidad

- `deductibility_percent_bps` solo aplica al IVA soportado de documentos `incoming`.
- Para `outgoing`, `deductibility_percent_bps` debe ser `0` y `deductibility_reason = not_applicable`.
- Si la línea tiene IVA soportado pero el sistema no puede justificar deducibilidad, la línea queda `needs_review` o `blocked` según falte soporte crítico.
- V1 debe soportar al menos `10000`, `0` y valores intermedios explícitos. No debe asumir que toda factura recibida es 100% deducible.

### 6.3 Regla específica de alquiler con retención

- Una factura de alquiler recibida con arrendador sujeto a retención debe modelarse como `received_invoice` con `counterparty_role = landlord`.
- La retención se modela por línea, no en cabecera, aunque solo exista una línea.
- La línea de alquiler debe tener:
  - `expense_family = rent`
  - `withholding_applicable = true`
  - `withholding_regime = rent`
  - `withholding_base_cents > 0`
  - `withholding_rate_bps > 0`
  - `withholding_amount_cents > 0`
- La base de retención del alquiler debe excluir el IVA.
- Si el documento mezcla alquiler con otros conceptos no sujetos a retención, debe partirse en varias líneas fiscales.
- Si falta la relación fuerte a `Counterparty`, el NIF del arrendador o el desglose de retención, el documento no puede quedar en `ready` para 115.

### 6.4 Regla específica de empleados

- Un pago a empleado sin fuente de nómina estructurada no genera un documento listo para Modelo 111.
- En V1, un movimiento de nómina puede existir como `payroll_placeholder` para preservar el rastro fiscal, pero debe quedar en `blocked` con `review_reasons = ["employee_payroll_source_missing"]`.
- `payroll_placeholder` no debe contaminar 303 ni 115.
- `payroll_placeholder` debe guardar el pago observado en `observed_amount_cents` y mantener `total_net_cents`, `total_vat_cents`, `total_withholding_cents`, `total_gross_cents` y `total_payable_cents` en `0`.
- Si en el futuro entra una fuente de nómina fiable, el placeholder deberá poder convertirse en facts fiscales de nómina con bases y retenciones reales sin reinterpretar el significado de los campos definidos aquí.

## 7. Invariantes de datos

- Toda cabecera fiscal tiene `source_transaction_id`.
- Toda línea fiscal referencia exactamente una cabecera fiscal.
- toda cabecera `ready`, salvo `payroll_placeholder`, debe resolver `counterparty_id`
- no puede existir más de un `Counterparty` con la misma `canonical_identity_key` dentro de `owner_scope_id`
- `currency_code` debe ser siempre `EUR` en V1.
- Si `document_kind` = `issued_invoice`, `direction` debe ser `outgoing`.
- Si `document_kind` = `received_invoice`, `direction` debe ser `incoming`.
- Si `document_kind` = `payroll_placeholder`, `direction` debe ser `incoming`.
- `total_net_cents` de cabecera = suma de `base_amount_cents` de sus líneas.
- `total_vat_cents` de cabecera = suma de `vat_amount_cents` de sus líneas.
- `total_withholding_cents` de cabecera = suma de `withholding_amount_cents` de sus líneas.
- `total_gross_cents = total_net_cents + total_vat_cents`.
- `total_payable_cents = total_gross_cents - total_withholding_cents`.
- Si `withholding_applicable = false`, entonces `withholding_regime = none`, `withholding_base_cents = 0`, `withholding_rate_bps = 0` y `withholding_amount_cents = 0`.
- Si `withholding_applicable = true`, entonces `withholding_regime != none`.
- Si `review_status = ready`, `review_reasons` debe estar vacío.
- Si `review_status = blocked`, `review_reasons` no puede estar vacío.
- Un documento `ready` para IVA debe tener `vat_period_assignment` no nulo.
- Un documento `ready` para retenciones debe tener `withholding_period_assignment` no nulo.
- Un `payroll_placeholder` no puede tener `is_ready_for_vat_books = true`.
- Un `payroll_placeholder` debe tener `observed_amount_cents >= 0`.
- Un `payroll_placeholder` debe tener todos los importes fiscales de cabecera a `0`.
- Ningún agregado de cabecera puede ser la única fuente de verdad si contradice a las líneas. En caso de discrepancia, el documento queda `blocked`.

## 8. Criterios de aceptación para backend

El contrato queda suficientemente definido para pasar a modelado cuando se pueda demostrar lo siguiente:

- backend puede crear un `fact fiscal` separando cabecera y líneas sin guardar tipos de IVA o retenciones en cabecera como fuente primaria
- backend puede representar un documento con varias líneas y tipos de IVA distintos
- backend puede representar una factura de alquiler con retención y calcular `total_payable_cents`
- backend puede representar una factura recibida con IVA no deducible o parcialmente deducible
- backend puede exigir relación fuerte a `Counterparty` para cualquier documento que vaya a quedar `ready`
- backend puede marcar un documento como `ready` o `blocked` con motivos explícitos
- backend puede asignar un trimestre para IVA y otro para retenciones sin asumir que siempre coinciden
- backend puede representar un pago a empleado como `payroll_placeholder` bloqueado sin mezclarlo con 115 ni 303

Frontera de fallo:

- si una única fila o cabecera intenta almacenar el IVA total sin líneas fiscales detalladas
- si la retención se modela solo a nivel de documento y no por línea
- si deducibilidad se intenta resolver solo por categoría
- si `issuedAt` se usa como criterio temporal universal sin declarar la base de asignación
- si el modelo operativo permite facts `ready` sin relación fuerte a `Counterparty`
- si nómina entra en 111 sin fuente estructurada

## 9. Supuestos y riesgos de dependencia

Supuestos adoptados para V1:

- la sociedad tributa por IVA trimestral y no por criterio de caja
- no hay intracomunitarias ni inversión del sujeto pasivo en el MVP comercial
- todos los documentos fiscales operativos de V1 están en EUR
- la aplicación ya dispone de una transacción genérica origen con `merchant`, `total`, `type`, `categoryCode`, `issuedAt`, `text`, `items` y `extra`

Riesgos de dependencia:

- si OCR o importación no extraen número de factura, NIF o desglose fiscal, el porcentaje de documentos `needs_review` será alto
- si no existe una fuente de pago o devengo diferenciada, la asignación temporal de retenciones puede ser incorrecta
- si el maestro de terceros no se normaliza a tiempo, 115 y futuros modelos anuales sufrirán duplicados por variaciones de nombre

## 10. Decisiones cerradas para Prisma

Las siguientes decisiones quedan fijadas en este contrato y ya no deben tratarse como abiertas en el primer corte:

1. Retenciones en V1.
   Decisión: `withholding_period_assignment` se modela desde el inicio y será obligatorio en cualquier documento `ready` con retención.
   Nota: el criterio temporal exacto de negocio podrá ser `payment_date` o `manual_override`, pero el contrato ya reserva ambas bases y no bloquea Prisma.

2. Nómina en V1.
   Decisión: solo existe `payroll_placeholder` bloqueado, con importes fiscales a cero y `observed_amount_cents` separado.

3. Contrapartes en V1.
   Decisión: el modelo operativo usa relación fuerte a `Counterparty`; el snapshot textual mínimo se reserva para facts cerrados o snapshots de cierre, no como identidad operativa principal.

4. Rectificativas en V1.
   Decisión: `credit_note` queda fuera del primer corte Prisma/V1 y pasa a track futuro.

## 11. Ejemplos concretos de mapping desde transacción genérica

Los siguientes ejemplos usan la forma actual de `Transaction` del repo como entrada conceptual: `merchant`, `total`, `type`, `categoryCode`, `issuedAt`, `items`, `extra`.

Para centrar el mapping funcional, los ejemplos omiten algunos campos obligatorios de infraestructura o resolución que backend deberá rellenar igualmente, como `line_id`, `fiscal_document_id` dentro de cada línea, `source_confidence`, `assigned_at` y `counterparty_country_code`.

### Ejemplo A. Factura recibida estándar con IVA deducible

Entrada genérica:

```json
{
  "id": "tx_001",
  "merchant": "Papeleria Centro SL",
  "total": 12100,
  "currencyCode": "EUR",
  "type": "expense",
  "categoryCode": "office",
  "issuedAt": "2026-01-15",
  "extra": {
    "invoiceNumber": "FC-2026-103",
    "counterpartyTaxId": "B12345678",
    "vatRatePercent": 21,
    "baseAmount": 10000,
    "vatAmount": 2100
  }
}
```

Salida fiscal canónica:

```json
{
  "header": {
    "fiscal_document_id": "fd_001",
    "source_transaction_id": "tx_001",
    "document_kind": "received_invoice",
    "direction": "incoming",
    "invoice_number": "FC-2026-103",
    "issue_date": "2026-01-15",
    "currency_code": "EUR",
    "counterparty_id": "cp_papeleria_centro_sl",
    "counterparty_role": "supplier",
    "counterparty_name": "Papeleria Centro SL",
    "counterparty_tax_id": "B12345678",
    "review_status": "ready",
    "review_reasons": [],
    "vat_period_assignment": {
      "fiscal_year": 2026,
      "quarter": 1,
      "period_key": "2026-Q1",
      "basis": "issue_date"
    },
    "withholding_period_assignment": null,
    "observed_amount_cents": 0,
    "total_net_cents": 10000,
    "total_vat_cents": 2100,
    "total_withholding_cents": 0,
    "total_gross_cents": 12100,
    "total_payable_cents": 12100
  },
  "lines": [
    {
      "line_number": 1,
      "concept": "Material de oficina",
      "base_amount_cents": 10000,
      "vat_treatment": "taxable",
      "vat_rate_bps": 2100,
      "vat_amount_cents": 2100,
      "withholding_applicable": false,
      "withholding_regime": "none",
      "withholding_base_cents": 0,
      "withholding_rate_bps": 0,
      "withholding_amount_cents": 0,
      "deductibility_percent_bps": 10000,
      "deductibility_reason": "fully_deductible",
      "expense_family": "supplies",
      "is_ready_for_vat_books": true,
      "is_ready_for_withholding_books": false
    }
  ]
}
```

### Ejemplo B. Factura de alquiler con retención

Entrada genérica:

```json
{
  "id": "tx_002",
  "merchant": "Inmuebles Gran Via SL",
  "total": 102000,
  "currencyCode": "EUR",
  "type": "expense",
  "categoryCode": "rental",
  "issuedAt": "2026-02-01",
  "extra": {
    "invoiceNumber": "ALQ-02-2026",
    "counterpartyTaxId": "B76543210",
    "baseAmount": 100000,
    "vatRatePercent": 21,
    "vatAmount": 21000,
    "withholdingRatePercent": 19,
    "withholdingAmount": 19000
  }
}
```

Salida fiscal canónica:

```json
{
  "header": {
    "fiscal_document_id": "fd_002",
    "source_transaction_id": "tx_002",
    "document_kind": "received_invoice",
    "direction": "incoming",
    "invoice_number": "ALQ-02-2026",
    "issue_date": "2026-02-01",
    "currency_code": "EUR",
    "counterparty_id": "cp_inmuebles_gran_via_sl",
    "counterparty_role": "landlord",
    "counterparty_name": "Inmuebles Gran Via SL",
    "counterparty_tax_id": "B76543210",
    "review_status": "ready",
    "review_reasons": [],
    "vat_period_assignment": {
      "fiscal_year": 2026,
      "quarter": 1,
      "period_key": "2026-Q1",
      "basis": "issue_date"
    },
    "withholding_period_assignment": {
      "fiscal_year": 2026,
      "quarter": 1,
      "period_key": "2026-Q1",
      "basis": "manual_override"
    },
    "observed_amount_cents": 0,
    "total_net_cents": 100000,
    "total_vat_cents": 21000,
    "total_withholding_cents": 19000,
    "total_gross_cents": 121000,
    "total_payable_cents": 102000
  },
  "lines": [
    {
      "line_number": 1,
      "concept": "Renta mensual local",
      "base_amount_cents": 100000,
      "vat_treatment": "taxable",
      "vat_rate_bps": 2100,
      "vat_amount_cents": 21000,
      "withholding_applicable": true,
      "withholding_regime": "rent",
      "withholding_base_cents": 100000,
      "withholding_rate_bps": 1900,
      "withholding_amount_cents": 19000,
      "deductibility_percent_bps": 10000,
      "deductibility_reason": "fully_deductible",
      "expense_family": "rent",
      "is_ready_for_vat_books": true,
      "is_ready_for_withholding_books": true
    }
  ]
}
```

Nota: en este ejemplo la asignación de retención queda con `basis = "manual_override"` porque el contrato permite override explícito si la base temporal no viene informada en la transacción origen.

### Ejemplo C. Factura emitida

Entrada genérica:

```json
{
  "id": "tx_003",
  "merchant": "Cliente Demo SL",
  "total": 242000,
  "currencyCode": "EUR",
  "type": "income",
  "categoryCode": "invoice",
  "issuedAt": "2026-03-10",
  "extra": {
    "invoiceNumber": "2026-0007",
    "counterpartyTaxId": "B99887766",
    "baseAmount": 200000,
    "vatRatePercent": 21,
    "vatAmount": 42000
  }
}
```

Salida fiscal canónica:

```json
{
  "header": {
    "fiscal_document_id": "fd_003",
    "source_transaction_id": "tx_003",
    "document_kind": "issued_invoice",
    "direction": "outgoing",
    "invoice_number": "2026-0007",
    "issue_date": "2026-03-10",
    "currency_code": "EUR",
    "counterparty_id": "cp_cliente_demo_sl",
    "counterparty_role": "customer",
    "counterparty_name": "Cliente Demo SL",
    "counterparty_tax_id": "B99887766",
    "review_status": "ready",
    "review_reasons": [],
    "vat_period_assignment": {
      "fiscal_year": 2026,
      "quarter": 1,
      "period_key": "2026-Q1",
      "basis": "issue_date"
    },
    "withholding_period_assignment": null,
    "observed_amount_cents": 0,
    "total_net_cents": 200000,
    "total_vat_cents": 42000,
    "total_withholding_cents": 0,
    "total_gross_cents": 242000,
    "total_payable_cents": 242000
  },
  "lines": [
    {
      "line_number": 1,
      "concept": "Servicios profesionales",
      "base_amount_cents": 200000,
      "vat_treatment": "taxable",
      "vat_rate_bps": 2100,
      "vat_amount_cents": 42000,
      "withholding_applicable": false,
      "withholding_regime": "none",
      "withholding_base_cents": 0,
      "withholding_rate_bps": 0,
      "withholding_amount_cents": 0,
      "deductibility_percent_bps": 0,
      "deductibility_reason": "not_applicable",
      "expense_family": "services",
      "is_ready_for_vat_books": true,
      "is_ready_for_withholding_books": false
    }
  ]
}
```

### Ejemplo D. Pago a empleado sin fuente de nómina

Entrada genérica:

```json
{
  "id": "tx_004",
  "merchant": "Nomina Ana Perez",
  "total": 185000,
  "currencyCode": "EUR",
  "type": "expense",
  "categoryCode": "salary",
  "issuedAt": "2026-01-31",
  "extra": {}
}
```

Salida fiscal canónica:

```json
{
  "header": {
    "fiscal_document_id": "fd_004",
    "source_transaction_id": "tx_004",
    "document_kind": "payroll_placeholder",
    "direction": "incoming",
    "invoice_number": null,
    "issue_date": "2026-01-31",
    "currency_code": "EUR",
    "counterparty_id": null,
    "counterparty_role": "employee",
    "counterparty_name": "Nomina Ana Perez",
    "counterparty_tax_id": null,
    "review_status": "blocked",
    "review_reasons": ["employee_payroll_source_missing"],
    "vat_period_assignment": null,
    "withholding_period_assignment": null,
    "observed_amount_cents": 185000,
    "total_net_cents": 0,
    "total_vat_cents": 0,
    "total_withholding_cents": 0,
    "total_gross_cents": 0,
    "total_payable_cents": 0
  },
  "lines": [
    {
      "line_number": 1,
      "concept": "Pago de nomina pendiente de fuente estructurada",
      "base_amount_cents": 0,
      "vat_treatment": "out_of_scope",
      "vat_rate_bps": 0,
      "vat_amount_cents": 0,
      "withholding_applicable": true,
      "withholding_regime": "salary",
      "withholding_base_cents": 0,
      "withholding_rate_bps": 0,
      "withholding_amount_cents": 0,
      "deductibility_percent_bps": 0,
      "deductibility_reason": "not_applicable",
      "expense_family": "payroll",
      "is_ready_for_vat_books": false,
      "is_ready_for_withholding_books": false
    }
  ]
}
```

## 12. Siguiente paso recomendado para handoff de ingeniería

Cuando producto o fiscalidad resuelvan las decisiones abiertas del apartado 10, backend puede pasar a Prisma con esta secuencia:

1. modelar `fiscal_document_header` y `fiscal_tax_line` como entidades separadas
2. exigir relación fuerte a `Counterparty` en el modelo operativo y reservar snapshots textuales para cierres y exportables
3. almacenar asignación de periodo separada para IVA y retenciones
4. dejar nómina fuera del flujo 111 hasta cerrar el gate de fuente

Este contrato permite arrancar el modelado del núcleo de IVA y alquiler con retención sin mezclar semánticas de cabecera, línea, revisión y periodo.
