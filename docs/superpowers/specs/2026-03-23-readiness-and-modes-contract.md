# Readiness And Modes Contract

## Modos
- `setup`
  - falta al menos un requisito bloqueante
- `daily`
  - empresa, IA y perfil fiscal están listos

## Readiness mínimo
- empresa
  - nombre y dirección de negocio
- proveedor IA
  - al menos un proveedor operativo o `pool_cloud`
- perfil fiscal
  - acceso fiscal listo para la organización activa
- backup básico
  - baseline local detectado

## Reglas
- empresa, IA y perfil fiscal bloquean el paso a `daily`
- backup no bloquea el modo, pero sí mantiene el checklist abierto hasta quedar listo
- el CTA principal del checklist siempre apunta al primer paso incompleto con más impacto
- el checklist aparece en dashboard y settings mientras el tenant no esté listo
