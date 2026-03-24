# Diseño fase 2 móvil: PWA ligera y acceso directo a captura

## Objetivo

Hacer que TaxHacker se comporte como una web app instalable y cómoda desde móvil, reforzando el canal ya existente de `captura -> inbox -> revisión rápida`, sin convertir todavía el producto en una app offline-first ni en un clon móvil del workspace completo.

## Contexto actual

- La fase 1 móvil ya está cerrada como V1.
- Existen las rutas:
  - `/capture`
  - `/capture/inbox`
  - `/capture/review/[fileId]`
- El manifest actual en [public/site.webmanifest](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/public/site.webmanifest) es mínimo:
  - `name` y `short_name` vacíos
  - sin `start_url`
  - sin `scope`
  - sin `shortcuts`
- Ya hay iconos suficientes para una primera iteración instalable:
  - [public/android-chrome-192x192.png](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/public/android-chrome-192x192.png)
  - [public/android-chrome-512x512.png](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/public/android-chrome-512x512.png)
  - [public/apple-touch-icon.png](/Users/uxiomarcosmacmini/Documents/Nuevos%20desarrollos/taxhacker/public/apple-touch-icon.png)

## Criterios externos relevantes

La propuesta se apoya en criterios actuales de installability y manifest documentados por Chrome/MDN:

- Chrome/Chromium siguen necesitando un manifest instalable con `name` o `short_name`, iconos `192x192` y `512x512`, `start_url` y `display` válido para disparar instalación.
- `start_url` y `scope` deben definirse explícitamente para que el comportamiento del lanzador no dependa de inferencias del navegador.
- `shortcuts` aporta accesos directos útiles en PWAs instaladas.
- `display: standalone` es el modo adecuado para la experiencia instalada.

## Opciones valoradas

### Opción A: parche mínimo del manifest

- Rellenar `name`, `short_name`, `start_url` y `display`.
- No tocar UX de instalación ni modo standalone.

Pros:
- Muy rápida.

Contras:
- Deja la instalación escondida.
- No mejora el acceso directo al flujo móvil.
- Demasiado pobre para el objetivo real de uso diario desde teléfono.

### Opción B: PWA ligera orientada a captura

Recomendada.

- Manifest completo y coherente.
- Instalación visible desde móvil.
- `start_url` enfocado al caso principal.
- Ajustes de UI cuando la app se abre instalada en modo standalone.
- Sin service worker offline ni background sync.

Pros:
- Encaja con el objetivo real.
- Bajo riesgo.
- Aprovecha el canal móvil ya validado.

Contras:
- No da offline.
- Requiere tocar varias superficies de UX.

### Opción C: PWA completa con offline-first

- Manifest + service worker + cache + cola local.

Pros:
- Máxima ambición.

Contras:
- Prematura para este repo.
- Aumenta mucho el riesgo operacional y de coherencia con análisis/worker.

## Decisión

Implementar la **Opción B**.

La fase 2 debe ser una **PWA ligera y deliberadamente online**, centrada en:

1. instalar la app con una identidad clara
2. abrirla en un punto de entrada útil para móvil
3. hacer más rápido volver a `Captura` e `Inbox`
4. ajustar la UI en modo standalone para no duplicar cromos innecesarios

## Diseño funcional

### 1. Manifest real de producto

El manifest debe dejar de ser genérico y pasar a representar la app instalada:

- `name`: `TaxHacker`
- `short_name`: `TaxHacker`
- `description`: centrada en captura y revisión rápida
- `start_url`: `/capture?source=pwa`
- `scope`: `/`
- `display`: `standalone`
- `background_color` y `theme_color`: alineados con la identidad actual
- `icons`: reutilizar los iconos existentes
- `shortcuts`:
  - `Captura` -> `/capture`
  - `Inbox móvil` -> `/capture/inbox`
  - opcionalmente `Sin revisar` -> `/unsorted`

No añadiría `share_target`, `file_handlers` ni miembros experimentales en esta fase.

### 2. Instalación visible, no implícita

La instalación no debe depender solo del UI nativo del navegador.

Hay que añadir una capa propia y ligera:

- botón o CTA `Instalar app` en móvil
- escucha de `beforeinstallprompt` cuando exista
- fallback para iOS/Safari con instrucciones cortas de “Añadir a pantalla de inicio”
- ocultar el CTA cuando la app ya esté instalada o el modo sea `standalone`

### 3. Entrada instalada orientada a captura

Cuando la app se abra instalada, el punto de arranque debe favorecer el caso principal móvil:

- `start_url` irá a `/capture?source=pwa`
- no cambiaría el comportamiento normal web de `/dashboard`
- la instalación debe optimizar el acceso móvil, no alterar el producto de escritorio

### 4. Ajustes de UI en modo standalone

La app instalada debe sentirse menos “web metida en un navegador”.

Aplicaría cambios pequeños, no un rediseño:

- detectar `display-mode: standalone`
- simplificar cabeceras redundantes
- mantener visible el acceso a `Captura` e `Inbox`
- evitar duplicar navegación superior cuando ya existe el shell móvil

### 5. Límites explícitos de esta fase

Fuera de alcance:

- offline-first
- cache agresiva de documentos
- background sync
- `getUserMedia` como base obligatoria
- `share_target`
- reescritura total del layout móvil general

## Impacto en arquitectura

No cambia el backend de captura ni el contrato móvil actual.

El trabajo vive sobre todo en:

- manifest y metadata
- componentes cliente de instalación
- ajustes de navegación móvil
- lógica de detección de `standalone`

No debe tocar:

- pipeline de análisis
- fiscal
- sync móvil
- modelos de datos

## Testing esperado

- tests unitarios del manifest/metadata y del helper de install prompt
- tests de render del CTA de instalación y del modo standalone
- validación manual real:
  - app web normal
  - app abierta instalada/standalone
  - acceso por shortcut a `Captura` e `Inbox`

## Criterio de éxito

La fase 2 se considerará buena si:

- la app es instalable con identidad correcta
- al abrirla instalada entra por `Captura`
- existe acceso rápido a `Inbox móvil`
- el CTA de instalación no aparece donde no toca
- la UI en modo standalone se siente más limpia que la web normal
