# Track VERI*FACTU para facturas emitidas en Espana

Fecha: 2026-03-21  
Estado: propuesta operativa base, revisada el 2026-03-23  
Ambito: diseno tecnico y plan de implementacion futuro, sin cambios de codigo

## Gate de producto 2026-03-23

- La miniapp actual de `app/(app)/apps/invoices` sigue siendo un generador de borradores y un flujo de `Save as Transaction`.
- No existe hoy un contrato de `emitir factura` irreversible con:
  - snapshot inmutable
  - QR
  - hash encadenado
  - registro de eventos
  - registro `VERI*FACTU` o `NO VERI*FACTU`
- Por tanto, VERI*FACTU queda `fuera del core fiscal trimestral` de TaxHacker y no debe bloquear el roadmap de `303`, `115`, expediente y cierre recurrente.
- El gate solo se abrirá si TaxHacker pasa a vender la miniapp de facturas como `sistema de facturación` real y no como generador documental interno.

## 1. Objetivo

Definir un track de cumplimiento para facturas emitidas en Espana que:

- encaje con el monolito actual y con la miniapp `app/(app)/apps/invoices`
- quede separado del MVP trimestral fiscal y de los cierres de IVA
- permita evolucionar el generador actual hacia una emision con trazabilidad, QR y cadena de eventos
- evite decisiones en el flujo actual que bloqueen una implementacion compatible despues

Este documento no intenta cerrar una tesis legal completa. Su funcion es fijar un contrato tecnico pragmatico para el repo actual. La validacion normativa final contra AEAT/BOE sigue siendo un gate previo a implementar.

## 2. Conclusiones ejecutivas

- El generador actual de `invoices` sirve como editor de borradores y renderer PDF, pero hoy no debe considerarse un flujo de emision conforme.
- La unidad futura de cumplimiento no debe ser `Transaction`; debe ser un documento de factura emitida con snapshot inmutable, eventos y metadatos de cadena.
- `Transaction` y `TransactionFiscal` deben quedar como proyecciones reutilizables para reporting, navegacion y fiscalidad trimestral, no como ledger de cumplimiento.
- El boton actual "Save as Transaction" no basta para Espana. El flujo futuro debe separar con claridad `borrador`, `emitir` y `proyeccion contable/fiscal`.
- La implementacion puede reutilizar gran parte del UI actual, pero necesita una capa nueva de validacion, persistencia, trazabilidad y estados.
- Mientras ese contrato no exista, las facturas emitidas desde la miniapp actual deben seguir tratandose como `documentos generados por usuario`, no como `facturas emitidas conformes`.

## 3. Estado actual del repo que condiciona el diseno

## 3.1 Flujo actual de `app/(app)/apps/invoices`

- `page.tsx` carga `user`, `settings`, `currencies` y `AppData` de la miniapp.
- `InvoiceGenerator` mantiene un `InvoiceFormData` en cliente, soporta plantillas y permite:
  - descargar PDF
  - guardar plantilla
  - guardar como transaccion
- `saveInvoiceAsTransactionAction()`:
  - renderiza el PDF
  - calcula subtotal, impuestos y total desde `InvoiceFormData`
  - crea una `Transaction` generica de `type: "income"` y `status: "pending"`
  - guarda el PDF en filesystem y crea un `File`
  - enlaza el `File` con la `Transaction`

## 3.2 Limites funcionales actuales

- El emisor se deriva de `companyDetails`, texto libre, no del `FiscalProfile`.
- El receptor vive en `billTo`, tambien texto libre.
- `invoiceNumber` no tiene contrato de serie, unicidad ni irreversible cut.
- `additionalTaxes` y `additionalFees` son estructuras de UI, no un modelo fiscal o de cumplimiento estable.
- El PDF generado hoy es editable por definicion funcional: basta con volver a abrir el formulario y regenerar otro.
- No existe estado de emision, ni cadena hash, ni QR, ni log append-only.
- No existe operacion de rectificacion.
- El flujo actual crea la `Transaction` antes de validar almacenamiento o suscripcion; eso ya introduce riesgo de persistencia parcial incluso antes de hablar de cumplimiento.

## 3.3 Activos reutilizables ya existentes

- `FiscalProfile` ya existe y debe convertirse en la fuente del emisor fiscal.
- `TransactionFiscal` ya existe y soporta `issued_invoice`, `direction`, lineas fiscales y estados de revision.
- El renderer PDF y la UI de composicion actual pueden reaprovecharse como capa de borrador/previsualizacion.
- `File` ya sirve como almacenamiento de artefactos, pero no como ledger de cumplimiento.

## 4. Principio de arquitectura recomendado

Separar cuatro capas con ownership claro:

- `Draft authoring`: formulario, plantillas, preview y export manual de PDF. Mutable. No conforme.
- `Issuance contract`: validacion fuerte y normalizacion del borrador a una factura emitida canonica.
- `Compliance ledger`: snapshot inmutable, hash, enlace al anterior, QR, eventos y estado de emision.
- `Fiscal/accounting projections`: `Transaction`, `TransactionFiscal` y futuras vistas de tax workspace derivadas desde la factura emitida.

Decision central:

- la fuente de verdad para cumplimiento debe ser un recurso nuevo de `issued invoice`
- la fuente de verdad para cierre trimestral sigue siendo `TransactionFiscal`
- la sincronizacion entre ambas debe ser una proyeccion explicita, no un acoplamiento implcito

## 5. Impacto sobre el flujo actual de `invoices`

## 5.1 Que se mantiene

- La pagina actual y su editor pueden seguir existiendo como experiencia de creacion de borradores.
- Las plantillas en `AppData` pueden mantenerse para acelerar rellenado.
- La generacion de PDF puede seguir existiendo como preview o descarga no conforme.

## 5.2 Que debe cambiar cuando se implemente

- `Download PDF` debe quedar etiquetado como preview/export y no como emision legal.
- `Save as Transaction` no debe ser el paso final de emision espanola.
- Debe aparecer una accion distinta: `Emitir factura`.
- Antes de emitir, el sistema debe bloquear si faltan:
  - `FiscalProfile` valido
  - identificacion minima del cliente
  - numero y serie compatibles
  - impuestos normalizados
  - moneda y fechas admitidas
- Tras emitir:
  - el snapshot deja de ser editable
  - se genera QR y cadena
  - se registra al menos un evento `issued`
  - se crea o actualiza la proyeccion hacia `Transaction` y `TransactionFiscal`

## 5.3 Regla de compatibilidad con el MVP trimestral

- El cierre trimestral no debe depender de VERI*FACTU para funcionar.
- VERI*FACTU puede reutilizar `TransactionFiscal` para no duplicar logica fiscal basica.
- Ningun modulo trimestral debe asumir que todas las facturas emitidas del sistema ya tienen compliance ledger.
- Mientras el track no exista, las facturas emitidas desde la miniapp actual deben considerarse `documentos generados por usuario`, no `facturas emitidas conformes`.

## 6. Modelo minimo recomendado

## 6.1 Recurso principal: `IssuedInvoice`

Recurso nuevo y estable para facturas emitidas.

Campos minimos:

- `id`
- `ownerScopeId`
- `sourceApp = "invoices"`
- `schemaVersion`
- `issuanceStatus`
- `invoiceNumber`
- `invoiceSeries`
- `issueDate`
- `operationDate`
- `currencyCode`
- `issuerFiscalProfileSnapshot`
- `customerSnapshot`
- `totalsSnapshot`
- `linesSnapshot`
- `pdfFileId`
- `qrPayload`
- `hashAlgorithm`
- `documentHash`
- `previousDocumentHash`
- `chainPosition`
- `sourceTransactionId`
- `sourceTransactionFiscalId`
- `rectifiesIssuedInvoiceId`
- `issuedAt`
- `createdAt`
- `updatedAt`

Notas de modelado:

- `issuerFiscalProfileSnapshot` debe congelar nombre fiscal y NIF del emisor en el momento de emitir.
- `customerSnapshot` no debe depender solo del texto libre de `billTo`; necesita campos normalizados minimos.
- `linesSnapshot` debe preservar el detalle suficiente para recalcular totales y reconstruir el QR/hash sin releer UI state.
- `schemaVersion` es obligatorio para poder evolucionar el snapshot sin romper documentos ya emitidos.
- `rectifiesIssuedInvoiceId` queda reservado para track posterior de rectificaciones.

## 6.2 Recurso append-only: `IssuedInvoiceEvent`

Ledger de eventos para trazabilidad operativa.

Campos minimos:

- `id`
- `issuedInvoiceId`
- `ownerScopeId`
- `eventType`
- `eventAt`
- `actorType`
- `actorId`
- `idempotencyKey`
- `payload`
- `previousEventHash`
- `eventHash`

Eventos minimos recomendados:

- `draft_validated`
- `issued`
- `pdf_sealed`
- `qr_generated`
- `chain_linked`
- `projection_transaction_synced`
- `projection_fiscal_synced`
- `compliance_delivery_pending`
- `compliance_delivery_recorded`
- `compliance_delivery_failed`
- `rectification_linked`

Regla:

- este recurso es append-only
- nunca se reescribe un evento ya persistido

## 6.3 Estado de emision minimo

Estados recomendados:

- `draft`
- `validated`
- `issued`
- `compliance_pending`
- `compliance_recorded`
- `compliance_failed`
- `rectified`

Semantica minima:

- `draft`: editable, sin hash ni QR persistidos.
- `validated`: listo para emitir, pero aun no irreversible.
- `issued`: snapshot sellado; hash, referencia al anterior y QR ya persistidos.
- `compliance_pending`: emitido pero con entrega/registro posterior pendiente si ese subtrack existe.
- `compliance_recorded`: ya existe constancia del paso posterior de cumplimiento.
- `compliance_failed`: hubo error operativo y requiere accion humana.
- `rectified`: existe documento posterior que corrige este original.

## 6.4 Datos minimos de trazabilidad

Minimo obligatorio para compatibilidad futura:

- hash del documento emitido a partir de snapshot canonico, no del estado React
- referencia al hash del documento anterior dentro del ambito del emisor
- posicion de cadena monotona por `ownerScopeId`
- QR persistido como payload y, si conviene, tambien como imagen derivada
- marca temporal de emision
- version de esquema del snapshot
- idempotency key de la operacion de emitir
- eventos append-only con su propio hash

## 6.5 Rectificaciones

Fuera del primer corte de implementacion, pero debe quedar preparada la extension:

- no borrar ni mutar una factura emitida para corregirla
- modelar correccion como nueva factura enlazada al original
- el original permanece en cadena
- el nuevo documento debe poder apuntar a `rectifiesIssuedInvoiceId`

## 7. Contrato operativo minimo

## 7.1 Operacion critica: emitir factura

Operacion propuesta:

- nombre interno sugerido: `issueInvoiceFromDraft`

Entrada minima:

- `draftPayload`
- `ownerScopeId`
- `idempotencyKey`
- `requestSource`

Validaciones minimas:

- `FiscalProfile` existente y valido
- `currencyCode = EUR` en el primer corte
- numero y serie presentes segun politica definida
- cliente identificado con snapshot normalizado minimo
- lineas e impuestos consistentes
- total recalculado igual al total persistido
- el documento no esta ya emitido con la misma `idempotencyKey`

Respuesta de exito canonica:

```json
{
  "success": true,
  "data": {
    "issuedInvoiceId": "uuid",
    "issuanceStatus": "issued",
    "pdfFileId": "uuid",
    "documentHash": "sha256:...",
    "previousDocumentHash": "sha256:...",
    "qrPayload": "verifactu:...",
    "transactionId": "uuid",
    "transactionFiscalId": "uuid"
  }
}
```

Respuesta de error canonica:

```json
{
  "success": false,
  "error": {
    "code": "MISSING_FISCAL_PROFILE",
    "message": "No se puede emitir la factura sin perfil fiscal valido",
    "retryable": false
  }
}
```

Codigos de error estables recomendados:

- `MISSING_FISCAL_PROFILE`
- `INVALID_CUSTOMER_IDENTITY`
- `INVALID_INVOICE_NUMBER`
- `INVALID_CURRENCY`
- `UNBALANCED_TOTALS`
- `ISSUANCE_ALREADY_FINALIZED`
- `IDEMPOTENCY_CONFLICT`
- `CHAIN_PREDECESSOR_NOT_FOUND`
- `COMPLIANCE_ARTIFACT_WRITE_FAILED`

## 7.2 Operacion critica: consultar estado de factura emitida

Operacion propuesta:

- nombre interno sugerido: `getIssuedInvoiceStatus`

Respuesta de exito canonica:

```json
{
  "success": true,
  "data": {
    "issuedInvoiceId": "uuid",
    "issuanceStatus": "compliance_pending",
    "invoiceNumber": "2026-001",
    "issueDate": "2026-03-21",
    "documentHash": "sha256:...",
    "hasQr": true,
    "lastEventType": "compliance_delivery_pending"
  }
}
```

Respuesta de error canonica:

```json
{
  "success": false,
  "error": {
    "code": "ISSUED_INVOICE_NOT_FOUND",
    "message": "Factura emitida no encontrada en el ambito del usuario",
    "retryable": false
  }
}
```

## 7.3 Scope, autorizacion e idempotencia

- Todo registro debe ir scoped por `ownerScopeId`.
- El emisor fiscal debe leerse del `FiscalProfile`, no de `User.businessName` o `companyDetails`.
- La operacion de emitir debe ser idempotente.
- La clave de idempotencia debe persistirse en el recurso y en el evento principal.
- Reintentos de red o doble click no deben crear dos documentos emitidos ni dos saltos de cadena.

## 8. Modulos y componentes nuevos necesarios

Propuesta minima de modulos futuros:

- `models/invoices/issued-invoices.ts`
  - CRUD de solo lectura/escritura controlada del recurso `IssuedInvoice`
- `models/invoices/issued-invoice-events.ts`
  - append-only del ledger de eventos
- `models/invoices/issued-invoice-projections.ts`
  - sincronizacion hacia `Transaction` y `TransactionFiscal`
- `lib/invoices/normalize-issued-invoice.ts`
  - normalizacion de `InvoiceFormData` a snapshot canonico
- `lib/invoices/hash-chain.ts`
  - calculo de hash de documento y enlace al anterior
- `lib/invoices/qr.ts`
  - construccion persistible del payload QR
- `lib/invoices/issuance-guards.ts`
  - validaciones previas a emitir
- `app/(app)/apps/invoices/actions.ts`
  - debe dividir responsabilidades entre preview/export y emision
- `app/(app)/apps/invoices/components/invoice-compliance-panel.tsx`
  - bloque de estado, errores y trazabilidad
- `app/(app)/apps/invoices/components/issue-invoice-button.tsx`
  - CTA separada de emitir
- `app/(app)/apps/invoices/components/issued-invoice-status-badge.tsx`
  - estado visible en la UI

Regla de modularidad:

- QR y hash deben vivir fuera del renderer PDF
- las proyecciones a `Transaction` y `TransactionFiscal` no deben contener logica de cadena
- el formulario visual no debe decidir por si solo el snapshot final de cumplimiento

## 9. Que no se debe hacer sobre el flujo actual si se quiere ser compatible luego

- No convertir `Save as Transaction` en sinonimo de emision conforme.
- No usar `Transaction` como ledger principal de factura emitida.
- No derivar identidad fiscal del emisor solo desde `companyDetails`.
- No dejar el cliente solo en un blob de texto libre si luego se quiere QR, trazabilidad y matching estable.
- No recalcular o sobrescribir una factura ya emitida en el mismo registro.
- No generar el hash o el QR sobre HTML/PDF renderizado; debe salir de un snapshot canonico persistido.
- No persistir metadatos de cumplimiento unicamente dentro de `File.metadata`.
- No hacer deletes o updates destructivos de documentos emitidos.
- No acoplar la emision a los estados de cierre trimestral.
- No mezclar en el mismo paso logico `editar borrador`, `emitir` y `cerrar trimestre`.
- No asumir que las plantillas actuales en ingles/aleman definen un formato espanol valido.

## 10. Orden recomendado de implementacion por hitos

## Hito 0. Congelar contrato y gates

- cerrar este documento
- fijar validaciones minimas
- fijar estados y codigos de error
- decidir politica de serie y unicidad

## Hito 1. Modelo persistente de factura emitida

- crear `IssuedInvoice`
- crear `IssuedInvoiceEvent`
- persistir `schemaVersion`, `issuanceStatus` e `idempotencyKey`
- sin tocar aun AEAT ni rectificaciones

## Hito 2. Orquestacion de emision

- separar el flujo actual en:
  - preview/export
  - emitir
- introducir guardas sobre `FiscalProfile`, cliente, numeracion y totales
- hacer que emitir sea irreversible a nivel de snapshot

## Hito 3. QR, hash y cadena

- calcular hash desde snapshot canonico
- enlazar con el documento previo del mismo `ownerScopeId`
- persistir `qrPayload`
- registrar eventos `issued`, `qr_generated` y `chain_linked`

## Hito 4. Proyecciones operativas

- crear o actualizar la `Transaction`
- crear o actualizar `TransactionFiscal` con `document_kind = issued_invoice`
- asegurar que un cambio en la proyeccion no muta el snapshot emitido

## Hito 5. UI de estado y soporte

- mostrar badge de estado
- mostrar errores accionables
- mostrar hash, QR y ultimos eventos
- permitir reintentos solo en operaciones retryable

## Hito 6. Track posterior de rectificaciones y entrega externa

- enlazar factura rectificativa con original
- ampliar eventos
- anadir subflujo de entrega/registro externo si aplica

## 11. Riesgos si se mantiene el generador actual sin capa de cumplimiento

- El usuario puede creer que una factura descargada o guardada como transaccion ya es operativamente valida para Espana cuando no lo es.
- No existe trazabilidad inmutable del momento exacto de emision.
- No existe hash enlazado al documento anterior.
- No existe QR persistido.
- No existe distincion entre borrador editable y documento emitido.
- Un cambio posterior del formulario puede producir PDFs distintos con el mismo numero sin evidencia del cambio.
- El emisor y el receptor siguen capturandose como texto libre, con alto riesgo de incoherencia fiscal.
- La numeracion no tiene guardas de serie ni de unicidad.
- La `Transaction` puede quedar creada aunque fallen pasos posteriores del guardado actual.
- Si mas adelante se intenta "parchear" cumplimiento encima del flujo actual sin separar ledger y proyecciones, el coste de migracion y los errores ocultos seran mucho mayores.

## 12. Compatibilidad y migracion

- No se recomienda migrar retroactivamente todas las facturas generadas hoy a `IssuedInvoice` conforme.
- Se recomienda tratarlas como historico `legacy_generated_invoice`.
- La migracion segura es hacia adelante:
  - las nuevas emisiones usan el track nuevo
  - lo legacy queda visible pero marcado como no conforme
- Si se necesita enlazar historico a reporting, la proyeccion a `TransactionFiscal` puede mantenerse sin prometer trazabilidad de cumplimiento.

## 13. Decisiones pendientes que bloquean una implementacion segura

- Politica exacta de numeracion y series por emisor.
- Campos minimos exigidos para identificar al cliente en el primer corte.
- Si la entrega/registro posterior se implementa en el mismo track o en un subtrack separado.
- Formato exacto del payload QR y del algoritmo de hash que se adoptara tras revision normativa.
- Si la miniapp actual seguira siendo global/multilenguaje y el modo espanol conforme se activara como variante explicita.

## 14. Recomendacion final

La ruta mas segura para este repo es tratar la miniapp actual como `invoice draft builder` y anadir por encima un track de `issued invoices` con snapshot inmutable, ledger de eventos y proyecciones hacia `Transaction` y `TransactionFiscal`.

Eso evita mezclar cumplimiento con el MVP trimestral, reutiliza la inversion ya hecha en perfil fiscal y facts fiscales, y reduce el riesgo de tener que rehacer despues la emision espanola desde cero.
