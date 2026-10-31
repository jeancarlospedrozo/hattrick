# Constitución — Reservas de Canchas

## Principios fundamentales

### I. Integridad de reservas (NO NEGOCIABLE)

- NUNCA PUEDEN existir dos reservas confirmadas que se solapen en la misma cancha.
- La base de datos DEBE hacer cumplir esta garantía mediante una restricción propia; una
  validación solo en la aplicación NO es suficiente.

**Razón**: las comprobaciones en la aplicación no protegen frente a escrituras concurrentes;
solo la base de datos puede impedir la doble reserva en todos los casos.

### II. Tiempo

- Todas las fechas DEBEN guardarse en UTC.
- Las fechas DEBEN mostrarse en la zona horaria de la sede (America/Bogota por defecto).
- Los intervalos DEBEN ser semiabiertos `[inicio, fin)`: una reserva que termina a las 10:00 no
  se solapa con otra que empieza a las 10:00.

**Razón**: una única convención evita errores de conversión y hace inequívoca la definición de
solapamiento del Principio I.

### III. Test-first

- Cada criterio de aceptación de una spec DEBE tener al menos un test automatizado.
- Los tests DEBEN escribirse antes de la implementación que verifican.
- Las reglas de negocio DEBEN probarse en la capa de dominio, sin HTTP ni base de datos.

**Razón**: los tests previos prueban que cada criterio se cumple, y aislar el dominio mantiene
esas pruebas rápidas y centradas en las reglas.

### IV. Contratos primero

- Toda API DEBE definirse en OpenAPI antes de implementarse.
- El frontend DEBE consumir tipos generados a partir de ese contrato.

**Razón**: un contrato único y previo evita divergencias entre frontend y backend.

### V. Simplicidad

- El sistema DEBE ser un monolito modular hasta que exista una razón medible para separar
  servicios.
- NO SE PUEDE agregar una dependencia sin justificarla en `plan.md`.

**Razón**: cada servicio y cada dependencia añaden un coste permanente que debe compensarse con
un beneficio demostrable.

### VI. Seguridad y datos personales

- El sistema DEBE cumplir la Ley 1581 de 2012 (habeas data): consentimiento explícito y
  recolección de los datos mínimos necesarios.
- NINGÚN endpoint de escritura PUEDE exponerse sin autenticación.

**Razón**: el tratamiento de datos personales es una obligación legal, y las escrituras
anónimas pondrían en riesgo la integridad de las reservas.

## Stack aprobado

- **Lenguaje**: TypeScript en modo estricto
- **Frontend**: React/Next.js
- **Backend**: NestJS
- **Base de datos**: PostgreSQL
- **Tests**: Jest/Vitest (unitarios e integración), Playwright (extremo a extremo)

Usar una tecnología fuera de esta lista DEBE aprobarse mediante una enmienda a esta constitución.

## Flujo de desarrollo y puertas de calidad

Cada `plan.md` DEBE verificar, antes de implementar, que:

- Todo cambio en las reservas conserva la restricción de no solapamiento en la base de datos
  (Principio I).
- Fechas e intervalos siguen las convenciones del Principio II.
- Cada criterio de aceptación tiene un test previsto (Principio III).
- Los contratos OpenAPI están definidos antes de implementar las APIs (Principio IV).
- Cada dependencia nueva está justificada en `plan.md` (Principio V).
- Los datos personales y endpoints de escritura cumplen el Principio VI.

## Gobernanza

Esta constitución prevalece sobre cualquier otra práctica del proyecto.

- **Enmiendas**: DEBEN hacerse mediante un cambio documentado a este archivo, que indique el
  motivo y el plan de migración si afecta a trabajo existente.
- **Versionado**: semántico. MAJOR para eliminar o redefinir principios de forma incompatible;
  MINOR para añadir un principio o sección o ampliar su alcance; PATCH para aclaraciones sin
  cambio de significado.
- **Cumplimiento**: toda revisión de código y de plan DEBE verificar el cumplimiento. Una
  excepción a los Principios II a VI DEBE justificarse por escrito en `plan.md`. El Principio I
  no admite excepciones.

**Versión**: 1.0.0 | **Ratificada**: 2026-10-31 | **Última enmienda**: 2026-10-31
