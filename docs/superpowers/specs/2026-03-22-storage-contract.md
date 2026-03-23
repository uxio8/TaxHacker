# Contrato de storage multitenant para TaxHacker

Fecha: 2026-03-22  
Estado: congelado para la Task 0.1  
Ámbito: contrato abstracto de storage previo a Prisma, previo a adapters finales y válido para web + worker

## 1. Problema y objetivo aclarado

El storage actual de TaxHacker está acoplado a filesystem local, rutas por email de usuario y operaciones directas de `fs`. Eso no sirve como contrato estable para un producto `organization-centric`, ni permite convivir limpiamente con proveedor local y S3-compatible.

El objetivo de este documento es fijar un contrato único de storage para:

- persistir uploads y derivados por `organizationId`
- desacoplar capas altas de filesystem y de S3
- permitir que web y worker usen la misma semántica
- mantener proveedor local ahora y habilitar S3-compatible después sin cambiar el dominio

## 2. Decisiones fundacionales

- la unidad de tenancy del storage es `ownerOrganizationId`
- toda clave nueva de objeto debe vivir bajo el namespace `organizations/{organizationId}/...`
- la clave persistida es un `objectKey` lógico, no una ruta absoluta de disco ni una URL pública
- el contrato debe poder implementarse sobre:
  - filesystem local
  - S3-compatible object storage
- `copy` y `move` son operaciones del contrato, aunque internamente el proveedor local use rename y el S3 haga copy+delete

## 3. Vocabulario canónico

| Término | Significado canónico | Regla |
| --- | --- | --- |
| `objectKey` | Identificador lógico estable de un objeto dentro del storage. | Nunca contiene ruta absoluta ni bucket físico. |
| `storedObject` | Descriptor persistible de un objeto guardado. | Debe incluir `objectKey`, `ownerOrganizationId` y metadatos básicos. |
| `preview` | Artefacto derivado de un fichero fuente para render o inspección. | Pertenece al mismo tenant que el fichero origen. |
| `static asset` | Objeto estable de apoyo de producto, por ejemplo logo de negocio. | No se usa para adjuntos de transacción ni para previews. |
| `download handle` | Resultado de abrir un objeto para descarga. | Puede ser stream proxied o URL firmada; las capas altas no deben asumir cuál. |

## 4. Interfaz mínima estable

El contrato mínimo de storage para TaxHacker queda fijado a estas operaciones:

| Operación | Input mínimo | Garantía |
| --- | --- | --- |
| `put` | `ownerOrganizationId`, `objectKey`, contenido, `contentType` | Guarda o sobrescribe el objeto bajo una clave canónica. |
| `get` | `ownerOrganizationId`, `objectKey` | Recupera metadatos y acceso de lectura al objeto. |
| `delete` | `ownerOrganizationId`, `objectKey` | Borra el objeto de forma idempotente. |
| `copy` | `ownerOrganizationId`, `fromObjectKey`, `toObjectKey` | Duplica contenido dentro del mismo tenant. |
| `move` | `ownerOrganizationId`, `fromObjectKey`, `toObjectKey` | Mueve el objeto dentro del mismo tenant. |
| `list` | `ownerOrganizationId`, `prefix` | Enumera sólo objetos del prefijo pedido y del tenant dueño. |
| `openDownload` | `ownerOrganizationId`, `objectKey`, modo inline/attachment | Devuelve un `download handle` seguro y temporal. |

Forma mínima sugerida del descriptor:

```ts
type StorageObjectKind = "unsorted" | "transaction" | "preview" | "static"

type StoredObject = {
  ownerOrganizationId: string
  objectKey: string
  kind: StorageObjectKind
  contentType: string
  size: number
  checksum?: string | null
}
```

Reglas del contrato:

- `objectKey` lo construye el servidor, nunca el cliente
- `ownerOrganizationId` es obligatorio en todas las operaciones tenant-owned
- `move` y `copy` entre organizaciones quedan prohibidos en runtime de producto
- `list` sólo se usa para prefijos internos controlados, no para navegación libre por paths arbitrarios

## 5. Convención canónica de `objectKey`

### 5.1 Regla general

Todo objeto nuevo de negocio debe colgar de:

```text
organizations/{organizationId}/...
```

Reglas de composición:

- usar IDs estables (`organizationId`, `fileId`, `assetId`)
- preservar extensión sólo cuando aporte tipo de fichero real
- no usar email, nombre de usuario ni nombres mutables como prefijo de namespace
- sanitizar nombres visibles antes de incorporarlos a la clave

### 5.2 Namespaces obligatorios

| Caso | `objectKey` canónico |
| --- | --- |
| Upload a bandeja `unsorted` | `organizations/{organizationId}/uploads/unsorted/{fileId}{ext}` |
| Adjunto ya asignado a transacción | `organizations/{organizationId}/uploads/transactions/{fileId}/{YYYY}/{MM}/{storedFilename}` |
| Preview derivada | `organizations/{organizationId}/derived/previews/{fileId}/{page}.webp` |
| Static asset de organización | `organizations/{organizationId}/static/{assetType}/{assetId}{ext}` |

Ejemplos:

```text
organizations/9c5.../uploads/unsorted/1db....pdf
organizations/9c5.../uploads/transactions/1db.../2026/03/FV-23-0004 ACME SL.pdf
organizations/9c5.../derived/previews/1db.../1.webp
organizations/9c5.../static/business-logo/logo.png
```

Decisiones específicas:

- el paso `unsorted -> transaction` es un `move` lógico
- la carpeta por `fileId` en adjuntos de transacción se mantiene para evitar colisiones sin perder nombre visible
- `preview` vive en namespace derivado, no mezclado con el upload original
- `static` se reserva para activos persistentes y relativamente estables del tenant

### 5.3 Compatibilidad temporal

Durante migración, el proveedor local podrá leer claves legacy ya persistidas que sigan representando rutas relativas antiguas por usuario, pero:

- las nuevas escrituras no pueden generar rutas basadas en email
- el contrato canónico nuevo no debe exponer esas rutas legacy a nuevas capas
- cualquier shim de compatibilidad debe quedar encapsulado en el adapter local

Excepción temporal permitida:

- activos puramente personales como avatar de usuario pueden seguir usando namespace de usuario mientras no exista decisión de moverlos al tenant, pero no deben mezclarse con los objetos de negocio de organización

## 6. Convivencia entre provider local y S3-compatible

### Provider local

- implementa `objectKey` sobre filesystem local bajo un directorio base seguro
- resuelve la ruta absoluta como detalle interno del adapter
- puede usar `rename` para `move`
- `openDownload` puede responder con stream proxy o con route interna del monolito

### Provider S3-compatible

- usa el mismo `objectKey` como key del bucket o del prefijo configurado
- `move` puede implementarse como `copy + delete`
- `openDownload` puede responder con URL firmada temporal

### Regla común

- la base de datos guarda el `objectKey` lógico
- ninguna capa alta puede depender de si debajo hay disco o bucket
- cambiar de provider no debe obligar a reescribir modelos, routes o workers

## 7. Restricciones de seguridad y tenancy

- ninguna operación tenant-owned se ejecuta sin `ownerOrganizationId`
- toda lectura, descarga, preview, listado, copia o borrado valida pertenencia al tenant activo
- el cliente nunca aporta paths arbitrarios ni prefijos de listado libres
- `openDownload` nunca devuelve enlaces permanentes públicos
- `copy` y `move` cross-tenant quedan prohibidos fuera de tooling explícito de migración/admin
- previews y derivados heredan exactamente la misma pertenencia y visibilidad que el fichero origen
- el namespace no debe filtrar PII evitable; por eso se prohíbe usar email en claves nuevas

## 8. Qué queda prohibido en capas altas

Queda prohibido en `app/*`, `models/*` y cualquier código de dominio que no sea el adapter de storage:

- construir rutas con `path.join` para objetos de negocio
- usar `fs.readFile`, `fs.writeFile`, `fs.rename`, `fs.unlink` o equivalentes para adjuntos del producto
- importar SDKs de S3 directamente para operaciones del dominio
- persistir rutas absolutas de disco en BD
- persistir URLs firmadas o públicas como fuente de verdad
- usar `user.email` o `userId` como namespace de nuevos objetos de negocio
- listar directorios o prefijos fuera del scope del tenant activo
- decidir `objectKey` desde el cliente o desde datos no saneados

## 9. Criterios de aceptación

El contrato queda bien definido si un backend engineer puede implementar el adapter y los refactors sin inventar:

- qué operaciones mínimas debe exponer storage
- cómo se nombran las claves de `unsorted`, `transactions`, `previews` y `static`
- cómo conviven provider local y provider S3-compatible
- qué diferencias son internas del provider y cuáles son visibles al dominio
- qué accesos están prohibidos en capas altas

Se considera fallo del contrato si sigue habiendo duda sobre cualquiera de estos puntos:

- si la BD guarda paths de disco o claves lógicas
- si el namespace nuevo depende de email de usuario
- si `move` entre tenants está permitido
- si web y worker pueden usar APIs de storage distintas

## 10. Supuestos, riesgos y decisiones abiertas

Supuestos usados:

- el campo persistido actual de `File.path` podrá reutilizarse o migrarse para almacenar `objectKey`
- previews seguirán siendo artefactos derivados y regenerables
- el monolito seguirá pudiendo proxyar descargas incluso cuando exista S3

Riesgos:

- hoy hay varias escrituras directas a disco repartidas entre `app/*`, `models/*` y `lib/*`
- existe deuda de compatibilidad por rutas legacy basadas en usuario/email
- backups y exports aún no están modelados contra este contrato abstracto

Decisiones abiertas que no bloquean este corte:

- si `File.path` mantiene ese nombre o se renombra a `storageKey`
- si `openDownload` se estandariza como stream interno, URL firmada o ambos
- si los exports/backups usan este mismo storage o un canal separado de artefactos temporales

## 11. Siguiente paso recomendado

Con este contrato congelado, el siguiente paso es introducir una abstracción única de storage en la capa `lib/*` y rehacer gradualmente las escrituras/lecturas directas para que:

1. todas las nuevas claves salgan ya bajo `organizations/{organizationId}/...`
2. el provider local mantenga compatibilidad de lectura legacy
3. el futuro provider S3-compatible pueda entrar sin cambiar la semántica del dominio
