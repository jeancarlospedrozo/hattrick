# Implementation Plan: Crear reserva

**Branch**: `001-crear-reserva` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-crear-reserva/spec.md`

## Summary

Un jugador autenticado consulta la disponibilidad de una cancha para un día y reserva una franja
libre. La reserva queda "pendiente de pago" durante 10 minutos, con un valor fijado en ese momento,
y si no se paga expira y libera la franja.

Enfoque técnico:

- **Sin solapamientos**: una restricción de exclusión de PostgreSQL (`btree_gist`, `tstzrange '[)'`)
  garantiza que no haya solapamientos, incluso con escrituras concurrentes.
- **Límite de pendientes y reintentos**: un bloqueo consultivo por jugador pone en fila sus
  solicitudes, de modo que el límite de 2 pendientes (RN3) y los reintentos se resuelven sin carreras.
- **Expiración**: es perezosa. Cada lectura calcula el estado efectivo, y las reservas vencidas se
  marcan como expiradas justo antes de cada `INSERT`, sin un proceso programado.
- **Reglas en el dominio**: las reglas de la franja (RN1, RN2, horario, alineación) son funciones
  puras del dominio, con un puerto `Reloj` y Luxon para la zona horaria de la sede.
- **Contrato primero**: el contrato OpenAPI 3.1 es la fuente de los tipos que usan el frontend
  (Next.js) y el backend (NestJS).

## Technical Context

**Language/Version**: TypeScript 5.x en modo `strict`, sobre Node.js 22 LTS

**Primary Dependencies**:

- Backend: NestJS 11, `pg`, `luxon`, `@nestjs/jwt`
- Frontend: Next.js 15 con App Router y React 19
- Contrato: `openapi-typescript` (dev)

**Storage**: PostgreSQL 16 con la extensión `btree_gist`; todas las fechas en `timestamptz` (UTC)

**Testing**:

- Jest para las pruebas unitarias del dominio, las de integración con la base de datos y las de
  contrato (`supertest` + `ajv` contra el OpenAPI).
- Playwright para las pruebas de extremo a extremo.

**Target Platform**: servidor Linux (contenedor) y navegadores actuales (móvil y escritorio)

**Project Type**: aplicación web (monolito modular: un backend NestJS, un frontend Next.js y un
paquete de contrato compartido)

**Performance Goals**: p95 por debajo de 300 ms en `POST /reservas` y en `GET /disponibilidad`, con
picos de decenas de solicitudes por segundo (research R12); SC-001: reservar en menos de 1 minuto

**Constraints**:

- Cero solapamientos, aunque lleguen solicitudes concurrentes.
- La franja se libera exactamente a los 10 minutos, sin retraso.
- Las horas se muestran en la zona horaria de la sede.
- La reserva solo guarda el id del jugador como dato personal.

**Scale/Scope**: decenas de sedes, cientos de canchas, miles de reservas por día; 3 endpoints y
1 pantalla

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Puerta | Cómo se cumple | Estado |
| --- | --- | --- |
| **I. Integridad**: no solapamiento en la base de datos | `EXCLUDE USING gist (cancha_id WITH =, tstzrange(inicio, fin, '[)') WITH &&) WHERE estado IN ('pendiente_pago','confirmada')`. Es más estricta que la constitución, porque también cubre las pendientes (spec, Assumptions). Un test de integración inserta directamente con SQL y comprueba el error `23P01`. | ✅ |
| **II. Tiempo**: UTC, zona de la sede, `[inicio, fin)` | Columnas `timestamptz`. Luxon convierte la hora local de la sede a UTC en el dominio. El rango es `'[)'`. Las respuestas usan el desfase de la sede. Hay un test para las franjas contiguas 19–20 / 20–21. | ✅ |
| **III. Test-first** | Cada criterio de aceptación tiene un test previsto (tabla siguiente). Las reglas se prueban en `dominio/` sin HTTP ni base de datos. En las tareas, los tests van antes de la implementación. | ✅ |
| **IV. Contratos primero** | [contracts/openapi.yaml](./contracts/openapi.yaml) se define antes de implementar. `openapi-typescript` genera `packages/contracts`, que usan el frontend y el backend. Los tests de contrato validan las respuestas con `ajv`. | ✅ |
| **V. Simplicidad** | Un solo backend con los módulos `reservas`, `catalogo` y `auth`. No hay un proceso programado. Cada dependencia está justificada en la tabla de dependencias. | ✅ |
| **VI. Seguridad y datos personales** | `POST /reservas` y `GET /reservas/{id}` exigen JWT. Las reservas solo guardan el `jugador_id`. La disponibilidad no expone datos de jugadores. El consentimiento se obtiene en el registro, que es otra feature. | ✅ |

**Resultado**: pasa sin excepciones. La revisión después del diseño (Phase 1) no cambió nada: el
modelo de datos y el contrato mantienen las 6 puertas.

### Tests previstos por criterio de aceptación (Principio III)

| Criterio | Test previsto | Capa |
| --- | --- | --- |
| AC1 / FR-002, FR-003 | Crear la reserva → `pendiente_pago`, y la disponibilidad muestra la franja ocupada | integración + e2e |
| US1-2 | Una reserva en C1 no ocupa C2 | integración |
| US1-3 / FR-005 | Las franjas 19–20 y 20–21 se aceptan las dos | dominio + integración |
| US1-4 / FR-001 | Sin token → 401, y no se crea ninguna reserva | contrato |
| US1-5 / FR-002, FR-019 | La respuesta trae `expiraEn` en la hora de la sede y `valorCop` | dominio (valor) + contrato |
| US1-6 / FR-017 | La fila de la reserva no tiene más datos personales que `jugador_id`; la disponibilidad no expone jugadores | integración + contrato |
| US1-7 / FR-018 | Disponibilidad por día con bloques libres y ocupados | integración + e2e |
| AC2 / SC-002 | N solicitudes simultáneas de jugadores distintos → exactamente 1 creada (201) y el resto 409 con el mensaje | integración + e2e (mensaje) |
| US2-2 / FR-004 | Un solapamiento parcial (19:00–20:30 contra 20:00–21:00) → 409 | dominio + integración |
| Principio I | Un `INSERT` SQL directo que se solapa → `23P01` | integración |
| AC3 / FR-007, SC-004 | Reloj +10 min → estado `expirada` y franja libre; otro jugador puede reservarla | dominio + integración + e2e |
| US3-2 / FR-008 | `confirmarPago` de una reserva expirada → `RESERVA_EXPIRADA`, también exactamente a los 10:00 | dominio + integración |
| AC4 / FR-009 | 22:30–23:30 rechazada; 22:00–23:00 aceptada | dominio + e2e |
| RN1 / FR-010 | 30 y 75 minutos rechazados; 60 y 90 aceptados | dominio |
| FR-011 | 19:15 rechazado con `INICIO_NO_ALINEADO` | dominio |
| RN2 / FR-012 | Más de 14 días → rechazada; exactamente 14 días → aceptada; inicio pasado → rechazada | dominio |
| RN3 / FR-013 | Tercera pendiente rechazada; tras expirar una, se acepta; 3 solicitudes simultáneas del mismo jugador → como máximo 2 | dominio + integración |
| FR-014 / SC-005 | Cada rechazo trae su `codigo` y su `mensaje` y no crea ninguna fila | contrato |
| FR-015 | El horario y las respuestas se interpretan en `America/Bogota` | dominio |
| FR-016 | Doble envío secuencial y simultáneo → 1 fila; el segundo responde 200 con el mismo `id` | integración + contrato |
| FR-019 | Valor = tarifa × duración; un cambio de tarifa no altera las reservas ya creadas | dominio + integración |

### Dependencias nuevas (Principio V)

| Dependencia | Dónde | Justificación |
| --- | --- | --- |
| `pg` | backend | Driver de PostgreSQL. La restricción de exclusión, los bloqueos consultivos y `tstzrange` piden SQL directo (research R6). |
| `luxon` (+ `@types/luxon`, dev) | backend (dominio) | Convierte la hora local de una zona IANA a UTC, algo que no hace `Intl`, y `Temporal` todavía no es estable en Node 22 (R5). |
| `@nestjs/jwt` | backend | Verifica el JWT de los endpoints de escritura (Principio VI, R7). Es del ecosistema oficial de NestJS. |
| `openapi-typescript` (dev) | packages/contracts | Genera los tipos a partir del contrato (Principio IV, R8). |
| `supertest`, `ajv`, `ajv-formats`, `yaml` (dev) | backend | Tests de contrato: llaman a la API y validan las respuestas contra el OpenAPI (R8). |
| `@playwright/test` (dev) | e2e | Tests de extremo a extremo; ya está en el stack aprobado. |

Las dependencias propias de NestJS, Next.js, React, Jest y TypeScript vienen del stack aprobado.

## Project Structure

### Documentation (this feature)

```text
specs/001-crear-reserva/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── openapi.yaml     # Phase 1 (versión de diseño del contrato)
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json                  # npm workspaces: backend, frontend, packages/contracts, e2e
docker-compose.yml            # servicio db: postgres:16
.env.example
contracts/
└── openapi.yaml              # contrato vivo (copiado desde specs/001-crear-reserva/contracts)
packages/contracts/
└── src/schema.ts             # tipos generados por openapi-typescript (no se editan a mano)

backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── db/
│   │   ├── pool.ts
│   │   ├── migrate.ts        # aplica los .sql en orden (schema_migrations)
│   │   ├── seed.ts
│   │   └── migrations/
│   │       └── 001_reservas.sql   # btree_gist, sedes, canchas, reservas + EXCLUDE
│   ├── auth/
│   │   ├── jwt.guard.ts      # Bearer HS256 → jugadorId (claim sub)
│   │   └── jugador.decorator.ts
│   ├── catalogo/             # lectura de sedes y canchas
│   │   └── catalogo.repository.ts
│   ├── compartido/
│   │   └── reloj.ts          # puerto Reloj + RelojSistema + RelojAjustable (solo en test)
│   └── reservas/
│       ├── dominio/          # puro: sin NestJS, sin pg
│       │   ├── franja.ts             # hora local → [inicio, fin) UTC (Luxon)
│       │   ├── reglas.ts             # FR-009..FR-013 → resultado o código de rechazo
│       │   ├── reserva.ts            # estadoEfectivo, vigente, confirmarPago
│       │   ├── valor.ts              # FR-019
│       │   ├── disponibilidad.ts     # bloques de 30 min libres u ocupados
│       │   └── errores.ts            # códigos y mensajes en español
│       ├── aplicacion/
│       │   ├── crear-reserva.service.ts      # bloqueo → reintento → materializar → límite → INSERT
│       │   ├── confirmar-pago.service.ts     # lo llamará en proceso el futuro módulo de pagos
│       │   ├── obtener-reserva.service.ts
│       │   └── consultar-disponibilidad.service.ts
│       ├── infraestructura/
│       │   └── reservas.repository.ts        # SQL; traduce 23P01 → FRANJA_NO_DISPONIBLE
│       ├── http/
│       │   ├── reservas.controller.ts
│       │   ├── disponibilidad.controller.ts
│       │   └── errores.filter.ts             # errores de dominio → 409/422/404
│       └── reservas.module.ts
└── test/
    ├── unit/reservas/        # dominio (reloj fijo)
    ├── integration/          # PostgreSQL real; concurrencia con Promise.all
    └── contract/             # supertest + ajv contra contracts/openapi.yaml

frontend/
├── src/
│   ├── app/canchas/[canchaId]/page.tsx   # disponibilidad del día + reservar + resultado
│   ├── components/
│   │   ├── SelectorFranja.tsx
│   │   └── ResultadoReserva.tsx          # estado, expiración en la hora de la sede, valor
│   └── lib/api.ts                        # fetch tipado con packages/contracts
└── test/                                  # Jest para la lógica de presentación pura (formato de hora y valor); la UI se cubre en e2e

e2e/
└── reservas.spec.ts          # Playwright: AC1, AC2 (mensaje), AC3, AC4, disponibilidad
```

**Structure Decision**: es una aplicación web en un monorepo con npm workspaces, y sigue siendo un
monolito modular (Principio V): un solo proceso de backend con los módulos `reservas`, `catalogo` y
`auth`. Dentro de `reservas`, el dominio puro está separado de las capas de aplicación,
infraestructura y HTTP, para que las reglas se prueben sin HTTP ni base de datos (Principio III). El
futuro módulo de pagos usará `ConfirmarPagoService` en el mismo proceso, sin exponer un endpoint
nuevo.

## Flujo de `POST /reservas` (una transacción)

1. El guard JWT obtiene `jugadorId`. Se valida la forma del cuerpo; si es inválida → 400.
2. Se cargan la cancha y su sede; si no existen → 404. El dominio convierte la franja a UTC y aplica
   las reglas FR-010, FR-011, FR-009 y FR-012. El primer rechazo → 422.
3. `BEGIN`; `pg_advisory_xact_lock(jugador)`.
4. Si ya hay una reserva vigente con el mismo jugador, cancha, inicio y fin → `COMMIT` y 200 con esa
   reserva.
5. `UPDATE ... SET estado='expirada'` sobre las reservas pendientes vencidas de esa cancha y de ese
   jugador.
6. Se cuentan las pendientes vigentes del jugador; si son 2 o más → `ROLLBACK` y 422
   `LIMITE_PENDIENTES`.
7. `INSERT` con `valor_cop` y `expira_en = ahora + 10 min`. Si da `23P01` → `ROLLBACK` y 409
   "Esta franja ya no está disponible".
8. `COMMIT` → 201.

## Complexity Tracking

No hay violaciones de la constitución que justificar.
