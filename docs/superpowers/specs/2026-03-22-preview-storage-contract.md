# Contrato de storage para previews y derivados

Fecha: 2026-03-22  
Estado: congelado para el cierre de `Phase B`  
Ámbito: previews de imagen/PDF y artefactos derivados regenerables

## Objetivo

Cerrar un contrato único para previews tenant-aware que funcione igual con provider `local` y `s3`, sin volver a introducir rutas por usuario ni paths absolutos en el dominio.

## Reglas canónicas

- todo preview nuevo cuelga de:
  - `organizations/{organizationId}/derived/previews/{fileId}/{page}.webp`
- `organizationId` es obligatorio
- `fileId` es el identificador estable del artefacto origen
- `page` empieza en `1`
- el formato normalizado del preview es `webp`
- el preview es regenerable; no es fuente de verdad

## Cobertura

- imagen subida:
  - genera una sola preview `page=1`
- PDF:
  - genera una preview por página dentro del límite configurado
- futuros thumbnails:
  - deben vivir bajo el mismo namespace `derived`
  - no se mezclan con uploads originales

## Compatibilidad temporal

Mientras siga existiendo histórico legacy:

- lectura:
  - se permite leer previews antiguas por path legacy
- escritura:
  - toda preview nueva debe escribirse ya en clave canónica
- persistencia:
  - las nuevas referencias deben guardar `objectKey`, no path absoluto

## Reglas de runtime

- la generación de previews no debe depender de que el storage final sea local
- para providers remotos:
  - el worker puede materializar temporalmente a disco local si una librería lo necesita
  - el artefacto final se persiste siempre vía storage provider
- la ruta de serving:
  - si el provider devuelve buffer, responde con buffer
  - si el provider local puede abrir path seguro, puede servirlo como path local interno

## Límite de páginas

- el límite de páginas para PDF lo manda `config`
- la generación debe ser idempotente:
  - si la preview canónica ya existe, no se regenera sin motivo
- al reducir el límite de páginas:
  - no hace falta borrar previews sobrantes en esta fase
  - basta con no generarlas nuevas y no depender de ellas

## Lo que queda prohibido

- escribir previews nuevas en `uploads/{email}/previews/...`
- persistir paths absolutos de preview en BD o metadata
- asumir que una preview siempre se lee desde filesystem local
- usar `userId` o email como raíz de namespace nueva

## Validación mínima

- preview de imagen nueva -> `organizations/{organizationId}/derived/previews/{fileId}/1.webp`
- preview de PDF nuevo -> una clave por página dentro del límite
- preview legacy existente -> sigue sirviéndose
- provider local y provider S3-compatible comparten el mismo `objectKey`
