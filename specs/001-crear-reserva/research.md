# Research: Crear reserva

**Feature**: `001-crear-reserva` | **Fecha**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

El repositorio no tiene código todavía, así que estas decisiones fijan el punto de partida. El stack
lo impone la constitución (TypeScript estricto, NestJS, Next.js, PostgreSQL, Jest/Vitest, Playwright).

---

## R1. Cómo impedir el solapamiento en la base de datos (Principio I, FR-004)

- **Decision**: una restricción de exclusión de PostgreSQL sobre `reservas`:
  `EXCLUDE USING gist (cancha_id WITH =, tstzrange(inicio, fin, '[)') WITH &&) WHERE (estado IN ('pendiente_pago','confirmada'))`,
  con la extensión `btree_gist`. Si el `INSERT` choca con la restricción, PostgreSQL devuelve el
  error `23P01`, que se traduce a "Esta franja ya no está disponible" (HTTP 409).
- **Rationale**: es la única forma de garantizar en la base de datos que no haya solapamientos, aunque
  lleguen escrituras concurrentes. El rango `'[)'` cumple el Principio II (`[inicio, fin)`). Con dos
  `INSERT` simultáneos que se solapan, el segundo espera a que el primero termine y luego falla. Así
  se cubren AC2 y SC-002 sin bloqueos explícitos.
- **Alternatives considered**:
  - Comprobar en la aplicación con `SELECT ... FOR UPDATE`: no bloquea filas que todavía no existen,
    y la constitución exige que la garantía esté en la base de datos.
  - Aislamiento `SERIALIZABLE`: funciona, pero obliga a reintentar transacciones y no deja la regla
    escrita en el esquema.
  - Una fila por bloque de 30 minutos con `UNIQUE (cancha, bloque)`: multiplica las filas y complica
    las duraciones variables.

## R2. Expiración a los 10 minutos sin un proceso programado (FR-007, SC-004)

- **Decision**: **expiración perezosa con estado efectivo**.
  - Cada reserva guarda `expira_en = creada_en + 10 min`.
  - El **estado efectivo** de una reserva es `expirada` si su estado guardado es `pendiente_pago` y
    `expira_en <= ahora`. Lo calcula una función pura del dominio. Todas las lecturas (disponibilidad,
    consulta de la reserva, pago) usan el estado efectivo.
  - Antes de insertar una reserva, la misma transacción **materializa** el cambio a `expirada` de las
    reservas pendientes ya vencidas de esa cancha y de ese jugador (`UPDATE ... SET estado='expirada'`).
    Así dejan de contar para la restricción de exclusión y para el límite de RN3.
- **Rationale**: la condición `WHERE` de una restricción de exclusión no puede depender de `now()`,
  así que la restricción solo ve el estado guardado. Materializar justo antes del `INSERT` resuelve
  eso, y el estado efectivo cumple el caso "expiración pendiente de procesar" (la franja está libre en
  cuanto se cumplen los 10 minutos). No hace falta un planificador, ni una dependencia nueva
  (Principio V).
- **Alternatives considered**:
  - Un proceso cada minuto con `@nestjs/schedule`: deja hasta 1 minuto de retraso (incumple SC-004 si
    no se usa también el estado efectivo) y añade una dependencia. Podría añadirse más adelante para
    mantener los datos ordenados, pero la corrección no depende de él.
  - `pg_cron`: es una extensión de infraestructura que no está en el stack aprobado.

## R3. Límite de 2 reservas pendientes con solicitudes simultáneas (FR-013)

- **Decision**: cada transacción de creación toma primero
  `pg_advisory_xact_lock(hashtextextended('jugador:' || jugador_id, 0))`. Con ese bloqueo puesto,
  materializa las expiraciones, cuenta las reservas pendientes vigentes del jugador y, si ya tiene 2,
  rechaza la solicitud.
- **Rationale**: el bloqueo pone en fila solo las solicitudes del mismo jugador, así que la cuenta no
  puede quedar desactualizada. Se libera solo al terminar la transacción y no necesita una tabla de
  jugadores (esa tabla es de la feature de autenticación, que todavía no existe).
- **Alternatives considered**: `SELECT ... FOR UPDATE` sobre la fila del jugador (depende de una
  tabla que no controlamos); un disparador que cuente (oculta la regla de negocio en la base de datos
  y es más difícil de probar en el dominio).

## R4. Doble envío / reintentos (FR-016, Clarificación 2)

- **Decision**: una solicitud se considera repetida si es del **mismo jugador, misma cancha, mismo
  inicio y mismo fin**, y ya existe una reserva vigente con esos datos (pendiente sin vencer o
  confirmada). En ese caso se devuelve la reserva existente con **HTTP 200**. Una reserva nueva
  devuelve **201**. La comprobación se hace con el bloqueo de R3 puesto, así que dos envíos
  simultáneos del mismo jugador quedan en fila y el segundo ve la reserva del primero.
- **Rationale**: cumple la clarificación ("devuelve la misma reserva, sin error") sin obligar al
  frontend a generar claves.
- **Alternatives considered**: cabecera `Idempotency-Key`. Es más general, pero necesita guardar las
  claves y obliga al cliente a enviarlas. Además, un reintento con otra clave volvería a caer en el 409.

## R5. Zonas horarias y cálculo de franjas (Principio II, FR-009, FR-011, FR-015)

- **Decision**: usar **Luxon** (dependencia justificada en plan.md) en el dominio para convertir la
  hora local de la sede (`fecha` + `horaInicio`, en la zona IANA de la sede) a instantes UTC, y para
  formatear las respuestas. En la base de datos, todo se guarda en `timestamptz` (UTC).
- **Rationale**: la API nativa `Intl` sabe formatear fechas en una zona horaria, pero no convertir
  una hora local de una zona a UTC. Y `Temporal` todavía no está disponible sin opciones especiales
  en Node 22 LTS. Luxon es una sola dependencia, sin dependencias propias, y usa los datos de zonas
  que ya trae Node.
- **Alternatives considered**: `date-fns` + `@date-fns/tz` (son dos paquetes y la API de zonas es
  más reciente); `@js-temporal/polyfill` (pesado y aún no es estable); hacer la conversión a mano
  (propenso a errores; Bogotá no tiene horario de verano, pero otras sedes podrían tenerlo).

## R6. Acceso a datos y migraciones

- **Decision**: usar `pg` (node-postgres) con SQL parametrizado en los repositorios, y migraciones en
  archivos `.sql` numerados que aplica un script propio de unas 40 líneas (`backend/src/db/migrate.ts`),
  con una tabla `schema_migrations`.
- **Rationale**: la restricción de exclusión, `btree_gist`, los bloqueos consultivos y los rangos
  `tstzrange` se escriben de forma natural en SQL. Los ORM (TypeORM, Prisma) no los modelan bien o
  obligan a usar SQL sin procesar de todos modos. Es una sola dependencia (Principio V).
- **Alternatives considered**: Prisma (no soporta restricciones de exclusión en su esquema), TypeORM
  (añade decoradores y metadatos sin ventaja aquí), Kysely (buen tipado, pero es otra capa que no
  hace falta para 3 tablas), node-pg-migrate (es una dependencia más para lo que hace un script corto).

## R7. Autenticación (Principio VI, FR-001)

- **Decision**: un guard de NestJS que verifica un JWT Bearer firmado con HS256, usando `@nestjs/jwt`
  y un secreto en `AUTH_JWT_SECRET`. La identidad del jugador sale del claim `sub`. Los endpoints de
  escritura y la consulta de una reserva propia lo exigen. La consulta de disponibilidad es pública,
  porque no expone datos personales (FR-018).
- **Rationale**: la feature de autenticación no existe todavía. Acordar desde ya el formato del token
  (JWT con `sub` = id del jugador) permite probar FR-001 de verdad (los tests generan sus propios
  tokens). La futura feature de autenticación solo tiene que emitir tokens compatibles.
- **Alternatives considered**: una cabecera falsa `X-Jugador-Id` (no autentica nada e incumpliría el
  Principio VI si llegara a producción); Passport (más piezas para un solo mecanismo).

## R8. Contrato, tipos generados y validación (Principio IV)

- **Decision**: el contrato OpenAPI 3.1 está en `contracts/openapi.yaml` (en la raíz del repositorio;
  la versión de diseño está en `specs/001-crear-reserva/contracts/`). A partir de él, `openapi-typescript`
  (dependencia de desarrollo) genera `packages/contracts/src/schema.ts`, que **usan tanto el frontend
  como el backend**. Para comprobar que el backend cumple el contrato, los tests de contrato usan
  `supertest` y validan cada respuesta contra el esquema con `ajv`.
- **Rationale**: un solo contrato y tipos generados en los dos lados, como pide la constitución. Los
  tests de contrato detectan si la implementación se aparta del contrato.
- **Alternatives considered**: generar el OpenAPI desde los decoradores de NestJS (`@nestjs/swagger`):
  invierte el orden "contrato primero" que exige la constitución. `orval` u `openapi-fetch` en el
  cliente: no hacen falta para 3 endpoints.

## R9. Tests y reloj controlable (Principio III)

- **Decision**: Jest en el backend y en el frontend, y Playwright para los tests de extremo a extremo.
  El dominio recibe un puerto `Reloj` (`ahora(): Date`). En los tests unitarios se usa un reloj fijo,
  y en los de integración y extremo a extremo se usa un reloj ajustable que se sobrescribe en el
  módulo de NestJS para simular que pasan los 10 minutos. PostgreSQL 16 corre en Docker Compose
  (`docker compose up db`).
- **Rationale**: los criterios de expiración y antelación no se pueden probar de forma fiable con el
  reloj real. Usar Jest en todos lados (el que trae NestJS por defecto) evita mantener dos
  herramientas de test.
- **Alternatives considered**: Vitest (con NestJS necesita SWC para los metadatos de los
  decoradores); Testcontainers (una dependencia más, cuando Compose basta).

## R10. Valor de la reserva (FR-019)

- **Decision**: la tarifa se guarda en `canchas.tarifa_por_hora_cop` como pesos enteros. El valor se
  calcula como `round(tarifa × minutos / 60)` (redondeando las mitades hacia arriba) en el dominio y
  se guarda en `reservas.valor_cop` al crear la reserva.
- **Rationale**: el peso colombiano no usa centavos en la práctica, y como las duraciones son
  múltiplos de 30 minutos, solo puede haber medio peso de diferencia. Guardar el valor en la reserva
  hace que un cambio posterior de tarifa no la afecte.
- **Alternatives considered**: `numeric(12,2)` (precisión que no se necesita); calcular el valor al
  pagar (incumple la clarificación 3).

## R11. Sedes y canchas mientras no exista su feature

- **Decision**: crear tablas mínimas `sedes` (zona horaria, apertura, cierre) y `canchas` (sede,
  nombre, tarifa) en un módulo `catalogo`, que en esta feature solo se lee. Los datos se cargan con un
  seed de desarrollo y prueba. La futura feature de sedes y canchas será dueña de estas tablas y las
  ampliará.
- **Rationale**: las reservas necesitan claves foráneas, horario y tarifa reales para probar FR-009 y
  FR-019. No se construye nada de administración (fuera de alcance).
- **Alternatives considered**: guardar el horario y la tarifa en una configuración (no permite
  claves foráneas ni varias sedes).

## R12. Supuestos de escala y rendimiento

- **Decision**: decenas de sedes, cientos de canchas, unas miles de reservas por día y picos de
  decenas de solicitudes por segundo. Objetivo: p95 por debajo de 300 ms en crear una reserva y en
  consultar la disponibilidad, con un solo proceso de backend.
- **Rationale**: coincide con un sistema de reservas a escala de ciudad. El índice GiST de la
  restricción también sirve para las consultas de disponibilidad.
- **Alternatives considered**: no aplica (sin datos reales todavía; se revisará con métricas).
