---

description: "Lista de tareas para implementar la feature 001-crear-reserva"
---

# Tasks: Crear reserva

**Input**: documentos de diseño en `/specs/001-crear-reserva/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md)

**Tests**: son **obligatorios**. El Principio III de la constitución (test-first) exige al menos un
test automatizado por criterio de aceptación, escrito **antes** de la implementación, y que las reglas
de negocio se prueben en el dominio sin HTTP ni base de datos. En cada historia, las tareas de test van
primero y deben **fallar** antes de implementar.

**Organization**: las tareas se agrupan por historia de usuario. Las rutas siguen la estructura de
plan.md (monorepo: `backend/`, `frontend/`, `packages/contracts/`, `contracts/`, `e2e/`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede hacerse en paralelo (otro archivo, sin depender de tareas pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1–US4)

## Convenciones para todas las tareas

- **TypeScript**: `strict: true`; nada de `any` implícito.
- **Dominio**: el código de `backend/src/reservas/dominio/` no importa NestJS ni `pg`. La hora actual
  siempre llega como parámetro (`ahora: Date`) o por el puerto `Reloj`; nunca se usa `new Date()`
  directamente.
- **Horas e intervalos**: todas las horas se guardan en UTC (`timestamptz`), y los intervalos son
  `[inicio, fin)`.
- **Respuestas**: las fechas van en ISO 8601 con el desfase de la sede, usando Luxon `toISO()` en la
  zona de la sede.
- **Mensajes**: los textos que ve el jugador están en español y se centralizan en
  `backend/src/reservas/dominio/errores.ts`.
- **Tipos de la API**: los del frontend y el backend se importan de `@reservas/contracts` (generados).
  No se escriben a mano.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: dejar el monorepo, las herramientas y la base de datos listos para desarrollar

- [ ] T001 Crear el `package.json` raíz con npm workspaces `["backend", "frontend", "packages/contracts", "e2e"]`, `"private": true`, `engines.node: ">=22"`, y los scripts `dev` (backend y frontend a la vez con `npm run dev --workspaces --if-present`), `contracts:generate`, `test:e2e`, `lint` y `typecheck`, en `package.json`
- [ ] T002 [P] Crear `tsconfig.base.json` en la raíz con `strict: true`, `noUncheckedIndexedAccess: true`, `target: "ES2022"`, `module: "NodeNext"` y `moduleResolution: "NodeNext"`, para que lo extiendan todos los workspaces
- [ ] T003 [P] Crear `docker-compose.yml` con el servicio `db` (`postgres:16`, puerto 5432, usuario y contraseña `reservas`, bases `reservas` y `reservas_test` creadas con un script en `docker/db-init/01-test-db.sql`), y `.env.example` con `DATABASE_URL`, `DATABASE_URL_TEST`, `AUTH_JWT_SECRET`, `PORT=3001`, `NEXT_PUBLIC_API_URL=http://localhost:3001/api` y `RELOJ_AJUSTABLE=0`
- [ ] T004 Crear el backend NestJS 11 en `backend/`: `package.json` con las dependencias `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/jwt`, `pg`, `luxon`, `reflect-metadata` y `rxjs`; las de desarrollo `@nestjs/testing`, `jest`, `ts-jest`, `@types/jest`, `@types/pg`, `@types/luxon`, `supertest`, `@types/supertest`, `ajv`, `ajv-formats`, `yaml` y `tsx`; `tsconfig.json` (extiende la base, con `experimentalDecorators` y `emitDecoratorMetadata`); `src/main.ts` con el prefijo global `api` y CORS para `http://localhost:3000`; y `src/app.module.ts` vacío
- [ ] T005 Configurar Jest en el backend con tres proyectos en `backend/jest.config.ts`: `unit` (`test/unit/**`), `integration` (`test/integration/**`, `maxWorkers: 1`) y `contract` (`test/contract/**`, `maxWorkers: 1`). Añadir a `backend/package.json` los scripts `test:unit`, `test:integration`, `test:contract`, `db:migrate`, `db:seed` y `token:dev`
- [ ] T006 [P] Crear el frontend Next.js 15 (App Router, React 19) en `frontend/`, con `package.json` (scripts `dev -p 3000`, `build`, `test` con Jest y `ts-jest`) y `tsconfig.json` que extiende la base. Sin librerías de UI adicionales
- [ ] T007 [P] Crear `contracts/openapi.yaml` copiando [specs/001-crear-reserva/contracts/openapi.yaml](./contracts/openapi.yaml) sin cambios. Crear el workspace `packages/contracts/` (`package.json` con `name: "@reservas/contracts"` y la dependencia de desarrollo `openapi-typescript`; script `generate`: `openapi-typescript ../../contracts/openapi.yaml -o src/schema.ts`; `src/index.ts` reexporta `paths` y `components` y define alias como `Reserva = components["schemas"]["Reserva"]`). Generar `packages/contracts/src/schema.ts` por primera vez
- [ ] T008 [P] Crear el workspace `e2e/` con `@playwright/test`, un `playwright.config.ts` (chromium; `webServer` levanta backend y frontend con `RELOJ_AJUSTABLE=1` y `DATABASE_URL=$DATABASE_URL_TEST`; `baseURL: http://localhost:3000`) y `e2e/package.json`. Además:
  - `e2e/global-setup.ts` migra y siembra la base de test `DATABASE_URL_TEST` y vacía la tabla `reservas`.
  - `e2e/helpers.ts` tiene `tokenPara(uuid)`, que firma un JWT HS256 con `AUTH_JWT_SECRET` usando `node:crypto` (sin dependencias nuevas), y `fijarReloj(request, iso)`, que llama a `POST /api/test/reloj` con un token.
  - Cada test fija en `beforeEach` el reloj en `2026-11-10T12:00:00-05:00` y usa el sábado `2026-11-14`.
- [ ] T009 [P] Configurar ESLint (flat config con `typescript-eslint` en modo strict) y Prettier en `eslint.config.mjs` y `.prettierrc` en la raíz. Añadir una regla `no-restricted-imports` que impida importar `@nestjs/*`, `pg` y `luxon` fuera de `franja.ts` dentro de `backend/src/reservas/dominio/**`

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: esquema de base de datos, reloj, conversión de franjas, autenticación, catálogo y
utilidades de test que necesitan todas las historias

**⚠️ CRITICAL**: ninguna historia de usuario puede empezar hasta terminar esta fase

### Tests de la base (escribir primero)

- [ ] T010 [P] Escribir los tests unitarios de `franja.ts` en `backend/test/unit/reservas/franja.spec.ts`:
  - `fecha "2026-11-14"` + `horaInicio "19:00"` + 60 minutos en `America/Bogota` → `inicio = 2026-11-15T00:00:00Z`, `fin = 2026-11-15T01:00:00Z` (FR-015).
  - `formatearEnSede(instante, zona)` devuelve `"2026-11-14T19:00:00.000-05:00"`.
  - Una fecha o una hora inválidas lanzan `SolicitudInvalida`.
  - Dos franjas contiguas (19–20 y 20–21) no se solapan según `seSolapan([a,b),[c,d))` (FR-005, Principio II).
- [ ] T011 [P] Escribir el test de integración del esquema en `backend/test/integration/esquema.spec.ts`:
  - Insertar con SQL directo dos reservas que se solapan en la misma cancha (`pendiente_pago` y `confirmada`) → la segunda falla con el código `23P01`.
  - Una reserva `expirada` que se solapa sí se inserta.
  - Reservas contiguas `[19:00,20:00)` y `[20:00,21:00)` → se aceptan.
  - La misma franja en otra cancha → se acepta.
  - `CHECK (fin > inicio)` rechaza `fin = inicio`.
  - (Principio I)

### Implementación de la base

- [ ] T012 Crear la migración `backend/src/db/migrations/001_reservas.sql`:
  - `CREATE EXTENSION IF NOT EXISTS btree_gist`.
  - Tabla `sedes`: `id uuid PK default gen_random_uuid()`, `nombre text NOT NULL CHECK (nombre <> '')`, `zona_horaria text NOT NULL DEFAULT 'America/Bogota'`, `apertura time NOT NULL`, `cierre time NOT NULL`, `CHECK (cierre > apertura)`.
  - Tabla `canchas`: `id uuid PK`, `sede_id uuid NOT NULL REFERENCES sedes(id)`, `nombre text NOT NULL CHECK (nombre <> '')`, `tarifa_por_hora_cop integer NOT NULL CHECK (tarifa_por_hora_cop > 0)`, `UNIQUE (sede_id, nombre)`.
  - Tabla `reservas`: `id uuid PK`, `cancha_id uuid NOT NULL REFERENCES canchas(id)`, `jugador_id uuid NOT NULL` (sin FK), `inicio timestamptz NOT NULL`, `fin timestamptz NOT NULL`, `estado text NOT NULL CHECK (estado IN ('pendiente_pago','confirmada','expirada'))`, `valor_cop integer NOT NULL CHECK (valor_cop >= 0)`, `creada_en timestamptz NOT NULL`, `expira_en timestamptz NOT NULL`, `confirmada_en timestamptz NULL`, `CHECK (fin > inicio)`, `CHECK (expira_en > creada_en)`.
  - Restricción `reservas_sin_solapamiento EXCLUDE USING gist (cancha_id WITH =, tstzrange(inicio, fin, '[)') WITH &&) WHERE (estado IN ('pendiente_pago','confirmada'))`.
  - Índice `reservas_pendientes_jugador ON reservas (jugador_id) WHERE estado = 'pendiente_pago'`.
- [ ] T013 Implementar `backend/src/db/pool.ts` (un `Pool` de `pg` creado desde `DATABASE_URL`, y el helper `enTransaccion<T>(fn: (cliente) => Promise<T>)` que hace BEGIN/COMMIT/ROLLBACK y libera el cliente) y `backend/src/db/migrate.ts` (crea `schema_migrations(nombre text PK, aplicada_en timestamptz)` y aplica los `.sql` de `migrations/` pendientes, en orden alfabético y cada uno en una transacción). Script `db:migrate` = `tsx src/db/migrate.ts`
- [ ] T014 [P] Implementar `backend/src/db/seed.ts`, que sea idempotente con `ON CONFLICT DO NOTHING` e ids fijos: la sede "Sede Norte" (`apertura 06:00`, `cierre 23:00`, `America/Bogota`) y las canchas `C1` y `C2` (`tarifa_por_hora_cop = 80000`). Debe imprimir los ids. Script `db:seed`
- [ ] T015 Implementar (depende de T019 por el `JwtGuard`) `backend/src/compartido/reloj.ts`: la interfaz `Reloj { ahora(): Date }`, el token de inyección `RELOJ`, `RelojSistema`, y `RelojAjustable` con `fijar(d: Date)` y `avanzar(ms: number)`. Además, `backend/src/compartido/reloj.module.ts`, que provee `RelojAjustable` si `RELOJ_AJUSTABLE=1` y `RelojSistema` en caso contrario. Con `RELOJ_AJUSTABLE=1` se expone `POST /api/test/reloj` (body `{ fijar?: string, avanzarMs?: number }`), registrado **solo** en ese caso, protegido con `JwtGuard` (Principio VI: ningún endpoint de escritura sin autenticación) y usado únicamente por los tests e2e
- [ ] T016 [P] Implementar `backend/src/reservas/dominio/errores.ts`: la clase base `ErrorDominio { codigo; mensaje }` y las subclases con sus mensajes en español:
  - `SolicitudInvalida`
  - `CanchaNoEncontrada` ("Cancha no encontrada")
  - `ReservaNoEncontrada` ("Reserva no encontrada")
  - `FranjaNoDisponible` ("Esta franja ya no está disponible")
  - `ReservaExpirada` ("La reserva expiró y ya no puede pagarse")
  - `RechazoRegla`, con un `codigo` del tipo `'DURACION_INVALIDA' | 'INICIO_NO_ALINEADO' | 'FUERA_DE_HORARIO' | 'FRANJA_PASADA' | 'ANTELACION_EXCEDIDA' | 'LIMITE_PENDIENTES'`
- [ ] T017 Implementar `backend/src/reservas/dominio/franja.ts` (es el único archivo del dominio que importa `luxon`) hasta que pase T010:
  - `aFranjaUtc({ fecha, horaInicio, duracionMinutos }, zona) → { inicio: Date; fin: Date; inicioLocal; finLocal }`
  - `formatearEnSede(d: Date, zona) → string`
  - `seSolapan(a, b)`, con la semántica `[inicio, fin)`
- [ ] T018 [P] Implementar `backend/src/catalogo/catalogo.repository.ts` y `catalogo.module.ts`. El método `obtenerCanchaConSede(canchaId) → { cancha: { id, nombre, tarifaPorHoraCop }, sede: { id, zonaHoraria, apertura: "HH:mm", cierre: "HH:mm" } } | null` hace una sola consulta con JOIN y devuelve `apertura` y `cierre` como texto `HH:mm`
- [ ] T019 [P] Implementar la autenticación en `backend/src/auth/`:
  - `jwt.guard.ts` verifica `Authorization: Bearer <jwt>` con HS256 y `AUTH_JWT_SECRET`, y exige que `sub` sea un uuid. Si falla, responde `401 { codigo: "NO_AUTENTICADO", mensaje: "Debes iniciar sesión para reservar" }`.
  - `jugador.decorator.ts` (`@JugadorId()`) devuelve el `sub`.
  - `auth.module.ts`.
  - `backend/scripts/token-dev.ts` imprime un JWT de 24 h para el uuid recibido como argumento (script `token:dev`).
- [ ] T020 [P] Implementar `backend/src/reservas/http/errores.filter.ts`, un filtro global que convierte los errores en respuestas `{ codigo, mensaje }`:
  - `SolicitudInvalida` → 400
  - `CanchaNoEncontrada` y `ReservaNoEncontrada` → 404
  - `FranjaNoDisponible` → 409
  - `RechazoRegla` → 422
  - cualquier otro error → 500 `{ codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado" }`, registrando el stack con `Logger`
- [ ] T021 Crear los helpers de test en `backend/test/helpers/`:
  - `db.ts`: `prepararBaseDeTest()` migra `DATABASE_URL_TEST`; `limpiar()` hace `TRUNCATE reservas`; `sembrarCatalogo()` reutiliza el seed y devuelve los ids.
  - `app.ts`: `crearAppDeTest()` arma el `AppModule` con `RELOJ` sobrescrito por un `RelojAjustable` y devuelve `{ app, reloj, http: supertest(app.getHttpServer()) }`.
  - `tokens.ts`: `tokenPara(jugadorId)`.
  - `contrato.ts`: carga `contracts/openapi.yaml` con `yaml`, compila los esquemas con `ajv` y `ajv-formats`, y expone `esperarConformeAlContrato(res, operationId)`, que valida el cuerpo contra el esquema de la respuesta según el código de estado.
- [ ] T022 Implementar el cliente base del frontend en `frontend/src/lib/api.ts`: `fetch` tipado con `paths` de `@reservas/contracts`, la URL base `NEXT_PUBLIC_API_URL`, un token leído de `localStorage['token']` que se envía como Bearer, y resultados del tipo `{ ok: true, status, data } | { ok: false, status, error: { codigo, mensaje } }`. Además, `frontend/src/lib/formato.ts`, con `horaLocal(iso, zonaHoraria)` → `"19:00"`, que usa `Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zonaHoraria })` y nunca la zona del navegador (Principio II), y `pesos(valorCop)` → `"$ 80.000"` usando `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`

**Checkpoint**: T010 y T011 pasan, `npm run db:migrate && npm run db:seed` funcionan, y la app arranca
sin endpoints de reserva todavía.

---

## Phase 3: User Story 1 - Reservar una franja libre (Priority: P1) 🎯 MVP

**Goal**: un jugador autenticado consulta la disponibilidad de una cancha para un día, reserva una
franja libre y ve la reserva "pendiente de pago", con su momento de expiración (hora de la sede) y
el valor a pagar. La franja pasa a mostrarse ocupada.

**Independent Test**: con el seed cargado, reservar C1 el sábado de 19:00 a 20:00 → 201,
`pendiente_pago`, `valorCop 80000` y `expiraEn = creadaEn + 10 min` con desfase `-05:00`. La
disponibilidad de C1 muestra 19:00 y 19:30 ocupadas, y la de C2 libres. Sin token → 401.

### Tests for User Story 1 (escribir primero; deben fallar) ⚠️

- [ ] T023 [P] [US1] Escribir los tests unitarios de `valor.ts` en `backend/test/unit/reservas/valor.spec.ts`: 80000 COP/h × 60 min = 80000; × 90 min = 120000; 75 COP/h × 90 min = 113 (redondeo hacia arriba de 112,5) (FR-019)
- [ ] T024 [P] [US1] Escribir los tests unitarios de `reserva.ts` en `backend/test/unit/reservas/reserva.spec.ts`:
  - `crearReservaNueva({ ..., ahora })` → `estado 'pendiente_pago'`, `creadaEn = ahora`, `expiraEn = ahora + 10 min` (FR-002, FR-007).
  - `estadoEfectivo` devuelve el estado guardado mientras `ahora < expiraEn`.
  - `esVigente` es true para `pendiente_pago` y `confirmada`, y false para `expirada`.
- [ ] T025 [P] [US1] Escribir los tests unitarios de `disponibilidad.ts` en `backend/test/unit/reservas/disponibilidad.spec.ts`:
  - Una sede de 06:00 a 23:00 da 34 bloques de 30 minutos en la hora de la sede.
  - Una reserva vigente de 19:00 a 20:00 marca solo los bloques 19:00 y 19:30 como `ocupada`.
  - Una reserva de 19:00 a 20:30 ocupa 3 bloques.
  - Las reservas expiradas no ocupan.
  - El resultado no contiene `jugadorId` (FR-018, FR-017).
- [ ] T026 [P] [US1] Escribir los tests de integración en `backend/test/integration/crear-reserva.spec.ts`:
  - AC1: crear C1 el sábado de 19:00 a 20:00 → una fila `pendiente_pago` con `valor_cop = 80000`.
  - US1-2: después de eso, reservar C2 de 19:00 a 20:00 se acepta.
  - US1-3: C1 de 20:00 a 21:00 se acepta (contigua).
  - US1-6: las columnas de `reservas` (consultadas en `information_schema.columns`) son exactamente las de data-model.md, y el único dato personal es `jugador_id`.
  - FR-019: después de `UPDATE canchas SET tarifa_por_hora_cop = 100000`, el `valor_cop` de la reserva sigue en 80000.
- [ ] T027 [P] [US1] Escribir los tests de integración de disponibilidad en `backend/test/integration/disponibilidad.spec.ts`: después de reservar C1 de 19:00 a 20:00, `consultarDisponibilidad(C1, sábado)` devuelve 19:00 y 19:30 `ocupada` y los demás bloques `libre`; para C2 todos están `libre` (US1-7, FR-003)
- [ ] T028 [P] [US1] Escribir los tests de contrato en `backend/test/contract/reservas.contract.spec.ts`, cada uno validado con `esperarConformeAlContrato`:
  - `POST /api/reservas` válido → 201 con `Reserva` (`estado`, `expiraEn` con `-05:00`, `valorCop`).
  - Sin token o con token inválido → 401 `NO_AUTENTICADO`, y `SELECT count(*) FROM reservas` = 0 (US1-4, FR-001).
  - Cancha inexistente → 404 `CANCHA_NO_ENCONTRADA`.
  - `horaInicio: "7pm"` o un campo extra → 400 `SOLICITUD_INVALIDA`.
  - `GET /api/reservas/{id}` propia → 200; de otro jugador → 404.
- [ ] T029 [P] [US1] Escribir los tests de contrato de disponibilidad en `backend/test/contract/disponibilidad.contract.spec.ts`:
  - `GET /api/canchas/{C1}/disponibilidad?fecha=...` sin token → 200 conforme a `Disponibilidad`, y ningún bloque trae datos del jugador.
  - `fecha=2026-13-01` → 400.
  - Cancha inexistente → 404.
- [ ] T030 [P] [US1] Escribir el e2e en `e2e/reservas.spec.ts`, en el grupo `US1`, con `test.use({ timezoneId: 'Europe/Madrid' })` para demostrar que la página muestra la hora de la sede aunque el navegador esté en otra zona:
  1. Abrir `/canchas/{C1}?fecha=2026-11-14` con `tokenPara(JUGADOR_A)` en `localStorage` (mediante `page.addInitScript`).
  2. Elegir el bloque 19:00 y 60 minutos, y pulsar "Reservar".
  3. Comprobar que se ve "Pendiente de pago", "Expira a las HH:mm" (hora de la sede) y "$ 80.000".
  4. Comprobar que, al recargar, los bloques 19:00 y 19:30 aparecen como ocupados (AC1, SC-001).
- [ ] T031 [P] [US1] Escribir el test unitario de `frontend/test/formato.spec.ts`: `horaLocal("2026-11-14T19:00:00.000-05:00", "America/Bogota")` → `"19:00"`; con `TZ=Asia/Tokyo` en el script de test, `horaLocal("2026-11-15T00:00:00Z", "America/Bogota")` → `"19:00"`; `pesos(80000)` → `"$ 80.000"` (los espacios del formato pueden ser no separables; compararlos normalizados)

### Implementation for User Story 1

- [ ] T032 [P] [US1] Implementar `backend/src/reservas/dominio/valor.ts`: `calcularValor(tarifaPorHoraCop: number, duracionMinutos: number): number` = `Math.round(tarifa * minutos / 60)` (hasta que pase T023)
- [ ] T033 [P] [US1] Implementar `backend/src/reservas/dominio/reserva.ts`:
  - Los tipos `EstadoReserva = 'pendiente_pago' | 'confirmada' | 'expirada'` y `Reserva { id, canchaId, jugadorId, inicio, fin, estado, valorCop, creadaEn, expiraEn, confirmadaEn }`.
  - La constante `PLAZO_PAGO_MS = 10 * 60 * 1000` (fija para todas las sedes).
  - Las funciones `crearReservaNueva`, `estadoEfectivo(reserva, ahora)` (`pendiente_pago` con `ahora >= expiraEn` → `expirada`) y `esVigente(reserva, ahora)`.
  - Debe pasar T024.
- [ ] T034 [US1] Implementar `backend/src/reservas/dominio/disponibilidad.ts`: `calcularBloques({ fecha, zona, apertura, cierre, reservas, ahora })` → bloques de 30 minutos `{ inicio, fin, estado: 'libre' | 'ocupada' }`, usando `seSolapan` y `esVigente` (hasta que pase T025)
- [ ] T035 [US1] Implementar `backend/src/reservas/infraestructura/reservas.repository.ts` con SQL parametrizado:
  - `insertar(cliente, reserva)`
  - `obtenerPorId(id)`
  - `listarVigentesEnRango(canchaId, desde, hasta)`: `estado IN ('pendiente_pago','confirmada') AND tstzrange(inicio,fin,'[)') && tstzrange($desde,$hasta,'[)')`, aprovechando el índice GiST
  - Un mapeo fila → `Reserva` que no expone otras columnas.
- [ ] T036 [US1] Implementar `backend/src/reservas/aplicacion/crear-reserva.service.ts`. El método `crear(jugadorId, solicitud)` hace, en orden:
  1. Carga la cancha y la sede con `CatalogoRepository`; si no existen → `CanchaNoEncontrada`.
  2. Convierte la franja con `aFranjaUtc`.
  3. `enTransaccion`: `SELECT pg_advisory_xact_lock(hashtextextended('jugador:' || $1, 0))`, luego `crearReservaNueva` con `reloj.ahora()` y `calcularValor`, e `insertar`.
  4. Devuelve `{ reserva, creada: true }`.
  - Deja marcados con un comentario los puntos donde se enchufan US2 (reintento y 23P01), US3 (materializar expiradas) y US4 (reglas y límite).
- [ ] T037 [P] [US1] Implementar `backend/src/reservas/aplicacion/obtener-reserva.service.ts`: `obtener(jugadorId, id)` lanza `ReservaNoEncontrada` si la reserva no existe o es de otro jugador, y devuelve la reserva con `estadoEfectivo` y la zona de su sede
- [ ] T038 [P] [US1] Implementar `backend/src/reservas/aplicacion/consultar-disponibilidad.service.ts`: `consultar(canchaId, fecha)` valida la fecha, carga la sede, calcula el rango UTC del día local entre la apertura y el cierre, llama a `listarVigentesEnRango` y a `calcularBloques`, y devuelve `Disponibilidad`
- [ ] T039 [US1] Implementar `backend/src/reservas/http/reservas.controller.ts`:
  - `POST /reservas` con `JwtGuard`: valida el cuerpo a mano contra `CrearReservaRequest` (las claves exactas; `fecha` con `YYYY-MM-DD`; `horaInicio` con `^([01]\d|2[0-3]):[0-5]\d$`; `duracionMinutos` entero `>= 1`; si no → `SolicitudInvalida`), llama al servicio y responde 201 con `Reserva` formateada en la zona de la sede.
  - `GET /reservas/:reservaId` con `JwtGuard`.
  - Las respuestas se tipan con `@reservas/contracts`.
- [ ] T040 [P] [US1] Implementar `backend/src/reservas/http/disponibilidad.controller.ts`: `GET /canchas/:canchaId/disponibilidad?fecha=`, público y sin guard, que responde `Disponibilidad`
- [ ] T041 [US1] Crear `backend/src/reservas/reservas.module.ts`, que registra los controladores, los servicios y el repositorio. Importarlo en `backend/src/app.module.ts` junto con `AuthModule`, `CatalogoModule` y `RelojModule`, y registrar el filtro global de T020 en `main.ts` y en `crearAppDeTest`. Comprobar que T026–T029 pasan
- [ ] T042 [P] [US1] Implementar `frontend/src/components/SelectorFranja.tsx`: grilla de bloques (los `libre` se pueden pulsar; los `ocupada` están deshabilitados y llevan `aria-disabled`), un selector de duración (60, 90, 120… minutos, hasta el cierre) y el botón "Reservar"
- [ ] T043 [P] [US1] Implementar `frontend/src/components/ResultadoReserva.tsx`: muestra "Pendiente de pago", "Expira a las {horaLocal(expiraEn)}" y "Valor: {pesos(valorCop)}", y un `role="alert"` para los errores con `error.mensaje`
- [ ] T044 [US1] Implementar `frontend/src/app/canchas/[canchaId]/page.tsx`, un componente cliente:
  - Lee `fecha` de la URL (por defecto, hoy en `America/Bogota`).
  - Carga la disponibilidad, permite elegir un bloque y una duración, y envía `POST /reservas` con `api.ts`.
  - Si la respuesta es 201 o 200, muestra `ResultadoReserva` y vuelve a cargar la disponibilidad.
  - Si es 401, muestra "Debes iniciar sesión para reservar".
  - Comprobar que T030 y T031 pasan.

**Checkpoint**: la US1 funciona sola. Ya es un MVP que se puede mostrar.

---

## Phase 4: User Story 2 - Resolver reservas simultáneas (Priority: P1)

**Goal**: cuando varios jugadores piden la misma franja (o franjas que se solapan) a la vez, solo uno
la obtiene y los demás ven "Esta franja ya no está disponible". Un doble envío del mismo jugador
devuelve la misma reserva.

**Independent Test**: lanzar 10 `POST /reservas` simultáneos de jugadores distintos para C1 de 19:00
a 20:00 → exactamente un 201, nueve 409 con el mensaje y 1 fila. Dos envíos simultáneos del mismo
jugador → 1 fila, y las dos respuestas tienen el mismo `id`.

### Tests for User Story 2 (escribir primero; deben fallar) ⚠️

- [ ] T045 [P] [US2] Escribir los tests de integración de concurrencia en `backend/test/integration/concurrencia.spec.ts`:
  - AC2 / SC-002: `Promise.all` de 10 solicitudes de 10 jugadores para la misma franja → exactamente 1 éxito y 9 `FranjaNoDisponible`; `count(*)` de vigentes = 1. Repetir 20 veces dentro del test para dar estabilidad.
  - US2-2: con C1 reservada de 19:00 a 20:30, otro jugador pide de 20:00 a 21:00 → `FranjaNoDisponible`.
  - Disponibilidad desactualizada: la franja se ocupa entre la consulta y el envío → `FranjaNoDisponible`.
- [ ] T046 [P] [US2] Escribir los tests de integración de reintentos en `backend/test/integration/reintentos.spec.ts`:
  - FR-016 secuencial: el mismo jugador envía la misma solicitud dos veces → la segunda devuelve `{ creada: false }` con el mismo `id`, y hay 1 fila.
  - FR-016 simultáneo: `Promise.all` de 2 envíos iguales del mismo jugador → 1 fila, los mismos `id`, y ninguno lanza error.
  - Si el mismo jugador pide la misma cancha con otra franja que se solapa → `FranjaNoDisponible` (no cuenta como reintento).
- [ ] T047 [P] [US2] Añadir a `backend/test/contract/reservas.contract.spec.ts`:
  - Un segundo `POST` idéntico del mismo jugador → 200 conforme a `Reserva` y con el mismo `id`.
  - Un `POST` de otro jugador sobre la misma franja → 409 con el cuerpo exacto `{ codigo: "FRANJA_NO_DISPONIBLE", mensaje: "Esta franja ya no está disponible" }`.
- [ ] T048 [P] [US2] Escribir el e2e en `e2e/reservas.spec.ts`, en el grupo `US2`: el jugador A reserva C1 a las 19:00 por la API; el jugador B, con la página abierta desde antes (disponibilidad desactualizada), intenta reservar 19:00 → ve "Esta franja ya no está disponible" y la grilla se recarga con la franja ocupada

### Implementation for User Story 2

- [ ] T049 [US2] En `backend/src/reservas/infraestructura/reservas.repository.ts`:
  - Capturar el error `23P01` de `pg` (código `err.code === '23P01'` y constraint `reservas_sin_solapamiento`) en `insertar` y lanzar `FranjaNoDisponible`.
  - Añadir `buscarReintento(cliente, { jugadorId, canchaId, inicio, fin, ahora })`, que devuelve la reserva con `estado = 'confirmada' OR (estado = 'pendiente_pago' AND expira_en > $ahora)` y esos mismos datos, o `null`.
- [ ] T050 [US2] En `backend/src/reservas/aplicacion/crear-reserva.service.ts`: justo después del bloqueo consultivo, llamar a `buscarReintento`. Si encuentra una reserva, devolver `{ reserva, creada: false }` sin insertar (hasta que pasen T045 y T046)
- [ ] T051 [US2] En `backend/src/reservas/http/reservas.controller.ts`: responder `200` cuando `creada === false` y `201` cuando es `true`, usando `@Res({ passthrough: true })` para fijar el código. Comprobar que pasa T047
- [ ] T052 [US2] En `frontend/src/app/canchas/[canchaId]/page.tsx`: con un 409, mostrar `error.mensaje` en `ResultadoReserva` y volver a cargar la disponibilidad. Deshabilitar el botón "Reservar" mientras la solicitud está en curso (reduce los dobles clics; el backend igual es idempotente). Comprobar que pasa T048

**Checkpoint**: la US1 y la US2 funcionan. Se garantizan cero solapamientos y un doble clic no da error.

---

## Phase 5: User Story 3 - Liberar franjas sin pago (Priority: P2)

**Goal**: una reserva pendiente que no se paga en 10 minutos pasa a "expirada", su franja queda libre
en ese mismo instante y un pago posterior se rechaza.

**Independent Test**: crear una reserva, avanzar el `RelojAjustable` 10 minutos → `GET /reservas/{id}`
devuelve `expirada`, la disponibilidad muestra la franja libre y otro jugador la reserva con 201.
`confirmarPago` a los 10:00 exactos → `ReservaExpirada`.

### Tests for User Story 3 (escribir primero; deben fallar) ⚠️

- [ ] T053 [P] [US3] Añadir a `backend/test/unit/reservas/reserva.spec.ts`:
  - `estadoEfectivo` a `expiraEn - 1 ms` → `pendiente_pago`; a `expiraEn` exacto → `expirada` (caso "Pago en el límite").
  - `confirmarPago(reserva, ahora)`: con `ahora < expiraEn` → `{ estado: 'confirmada', confirmadaEn: ahora }`; con `ahora >= expiraEn` → lanza `ReservaExpirada` (US3-2, FR-008); si ya está `confirmada` → no cambia nada.
  - `estadoEfectivo` de una `confirmada` nunca expira.
- [ ] T054 [P] [US3] Escribir los tests de integración en `backend/test/integration/expiracion.spec.ts`:
  - AC3 / SC-004: crear, `reloj.avanzar(10 min)` → `obtener` devuelve `expirada`; la disponibilidad muestra el bloque `libre`; otro jugador crea la misma franja → éxito; y la fila original queda guardada como `estado = 'expirada'` (materializada).
  - A los 9:59 el otro jugador recibe `FranjaNoDisponible`.
  - US3-2: `ConfirmarPagoService.confirmar(id)` tras 10 minutos → `ReservaExpirada` y la fila pasa a `expirada`; antes de 10 minutos → `confirmada`, con `confirmada_en` lleno, y después de eso nunca expira.
  - Carrera entre el pago y una reserva nueva: el pago confirma a los 9:59, y una reserva de otro jugador a los 10:00 recibe `FranjaNoDisponible`.
  - Interbloqueo: con 5 reservas vencidas sin marcar en C1, 10 jugadores piden a la vez una franja que se solapa → ninguna respuesta es un error 500, y hay exactamente 1 éxito.
- [ ] T055 [P] [US3] Añadir a `backend/test/contract/reservas.contract.spec.ts`: después de avanzar el reloj 10 minutos, `GET /api/reservas/{id}` → 200 con `estado: "expirada"`, conforme al contrato
- [ ] T056 [P] [US3] Escribir el e2e en `e2e/reservas.spec.ts`, en el grupo `US3`: reservar 19:00, llamar a `POST /api/test/reloj { avanzarMs: 600000 }`, recargar → el bloque 19:00 vuelve a estar libre y un segundo jugador puede reservarlo

### Implementation for User Story 3

- [ ] T057 [US3] En `backend/src/reservas/dominio/reserva.ts`: implementar `confirmarPago(reserva, ahora)`, que devuelve la reserva confirmada o lanza `ReservaExpirada` (hasta que pase T053)
- [ ] T058 [US3] En `backend/src/reservas/infraestructura/reservas.repository.ts`, añadir:
  - `materializarExpiradas(cliente, { canchaId, jugadorId, ahora })`, que bloquea las filas siempre en el mismo orden para evitar interbloqueos: `WITH vencidas AS (SELECT id FROM reservas WHERE estado = 'pendiente_pago' AND expira_en <= $ahora AND (cancha_id = $canchaId OR jugador_id = $jugadorId) ORDER BY id FOR UPDATE) UPDATE reservas r SET estado = 'expirada' FROM vencidas v WHERE r.id = v.id`.
  - `obtenerParaActualizar(cliente, id)`: `SELECT ... FOR UPDATE`.
  - `guardarEstado(cliente, id, estado, confirmadaEn)`.
- [ ] T059 [US3] En `backend/src/reservas/aplicacion/crear-reserva.service.ts`: después de `buscarReintento` y antes de `insertar`, llamar a `materializarExpiradas` con `reloj.ahora()` (así las pendientes vencidas dejan de bloquear la restricción de exclusión)
- [ ] T060 [US3] Implementar `backend/src/reservas/aplicacion/confirmar-pago.service.ts`, que se exporta desde `ReservasModule` para el futuro módulo de pagos (no tiene endpoint HTTP). El método `confirmar(reservaId)`, dentro de `enTransaccion`, llama a `obtenerParaActualizar` y a `confirmarPago(reserva, ahora)`. Si la reserva expiró, guarda `expirada` y la transacción **devuelve** `{ resultado: 'expirada' }` sin lanzar ningún error, así que se hace el commit. Si se puede pagar, guarda `confirmada` y devuelve `{ resultado: 'confirmada', reserva }`. **Fuera** de la transacción, si el resultado es `'expirada'`, se lanza `ReservaExpirada`. Comprobar que pasan T054–T056
- [ ] T061 [US3] En `frontend/src/components/ResultadoReserva.tsx`: si `estado === 'expirada'`, mostrar "La reserva expiró; la franja quedó libre"

**Checkpoint**: las reservas abandonadas ya no bloquean canchas, y la US1 y la US2 siguen pasando.

---

## Phase 6: User Story 4 - Aplicar las reglas de reserva (Priority: P2)

**Goal**: rechazar las solicitudes que incumplen el horario de la sede, la duración (RN1), la
alineación, la antelación (RN2) o el límite de 2 pendientes (RN3), indicando el motivo y sin crear
ninguna reserva.

**Independent Test**: cada solicitud que incumple una regla responde 422 con su `codigo` y su `mensaje`,
y `count(*)` no cambia. 22:00–23:00, 60 y 90 minutos, y exactamente 14 días se aceptan.

### Tests for User Story 4 (escribir primero; deben fallar) ⚠️

- [ ] T062 [P] [US4] Escribir los tests unitarios de `reglas.ts` en `backend/test/unit/reservas/reglas.spec.ts`, con la sede de 06:00 a 23:00 en `America/Bogota` y un `ahora` fijo. Cada rechazo se comprueba con su `codigo` y su `mensaje`:
  - AC4 (FR-009): 22:30–23:30 → `FUERA_DE_HORARIO` con el mensaje "La sede abre de 06:00 a 23:00"; 22:00–23:00 → se acepta; 05:30–06:30 → `FUERA_DE_HORARIO`.
  - RN1 (FR-010): 30 y 75 minutos → `DURACION_INVALIDA` ("La duración debe ser de al menos 60 minutos y múltiplo de 30"); 60, 90 y 120 → se aceptan.
  - FR-011: 19:15 → `INICIO_NO_ALINEADO` ("La franja debe empezar en una hora en punto o una media hora").
  - RN2 (FR-012): inicio en `ahora + 14 días + 30 min` → `ANTELACION_EXCEDIDA` ("Solo puedes reservar con hasta 14 días de antelación"); inicio en exactamente `ahora + 14 × 24 h` → se acepta; inicio igual a `ahora` o anterior → `FRANJA_PASADA` ("No puedes reservar una franja que ya empezó").
  - Orden de evaluación: duración → alineación → horario → pasada → antelación. Se devuelve el primer rechazo.
  - RN3 (FR-013): `validarLimitePendientes(2)` → `LIMITE_PENDIENTES` ("Ya tienes 2 reservas pendientes de pago"); con 0 y 1 → se acepta.
- [ ] T063 [P] [US4] Escribir los tests de integración en `backend/test/integration/reglas.spec.ts`:
  - RN3: con 2 pendientes en canchas o franjas distintas, una tercera → `LIMITE_PENDIENTES`.
  - RN3-8: con 2 pendientes, `reloj.avanzar(10 min)` y crear otra → se acepta (depende de la materialización de T059).
  - Solicitudes simultáneas del mismo jugador: `Promise.all` de 3 franjas distintas → como máximo 2 éxitos y el resto `LIMITE_PENDIENTES`.
  - Las confirmadas no cuentan para el límite.
  - El límite es global: 2 pendientes en sedes distintas también llenan el cupo.
- [ ] T064 [P] [US4] Añadir a `backend/test/contract/reservas.contract.spec.ts`: un caso por cada código de `ErrorRegla` (`DURACION_INVALIDA`, `INICIO_NO_ALINEADO`, `FUERA_DE_HORARIO`, `FRANJA_PASADA`, `ANTELACION_EXCEDIDA`, `LIMITE_PENDIENTES`) → 422, conforme a `ErrorRegla`, y `count(*) FROM reservas` sin cambios (FR-014, SC-005)
- [ ] T065 [P] [US4] Escribir el e2e en `e2e/reservas.spec.ts`, en el grupo `US4`: elegir 22:30 y 60 minutos → se ve "La sede abre de 06:00 a 23:00"; elegir 22:00 y 60 minutos → se ve "Pendiente de pago" (AC4)

### Implementation for User Story 4

- [ ] T066 [US4] Implementar `backend/src/reservas/dominio/reglas.ts`:
  - `validarFranja({ duracionMinutos, inicioLocal, finLocal, inicio, apertura, cierre, ahora })` aplica, en el orden de data-model.md: duración `>= 60` y `% 30 == 0`; minuto local `00`/`30` con segundos en 0; `inicioLocal >= apertura`, `finLocal <= cierre` y el mismo día; `inicio > ahora`; `inicio <= ahora + 14 × 24 h`. Lanza `RechazoRegla` con el mensaje correspondiente.
  - `validarLimitePendientes(cantidad)`, con `MAX_PENDIENTES = 2`.
  - Debe pasar T062.
- [ ] T067 [US4] En `backend/src/reservas/infraestructura/reservas.repository.ts`: añadir `contarPendientesVigentes(cliente, jugadorId, ahora)`, que hace `SELECT count(*) FROM reservas WHERE jugador_id = $1 AND estado = 'pendiente_pago' AND expira_en > $2` (usa el índice `reservas_pendientes_jugador`)
- [ ] T068 [US4] En `backend/src/reservas/aplicacion/crear-reserva.service.ts`, añadir dos pasos. El flujo completo queda como en la sección "Flujo de `POST /reservas`" de plan.md:
  - `validarFranja` después de `aFranjaUtc` y **antes** de abrir la transacción.
  - Dentro de la transacción, después de `materializarExpiradas`: `contarPendientesVigentes` y `validarLimitePendientes`, antes de `insertar`.
  - Si la transacción falla con `40P01` (interbloqueo), se reintenta completa una sola vez. Si vuelve a fallar → 409 `FRANJA_NO_DISPONIBLE`.
  - Comprobar que pasan T063 y T064.
- [ ] T069 [US4] En `frontend/src/app/canchas/[canchaId]/page.tsx` y `SelectorFranja.tsx`: con un 422, mostrar `error.mensaje` en `ResultadoReserva`. El selector de duración solo ofrece múltiplos de 30 desde 60 minutos (el backend sigue siendo la autoridad). Comprobar que pasa T065

**Checkpoint**: las 4 historias funcionan y todos los criterios de aceptación tienen su test pasando.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: observabilidad, rendimiento, documentación y verificación final de la constitución

- [ ] T070 [P] Añadir logs estructurados con `Logger` de NestJS en `backend/src/reservas/aplicacion/crear-reserva.service.ts` y en `confirmar-pago.service.ts`. Eventos: `reserva_creada`, `reserva_reintento`, `reserva_rechazada` (con `codigo`), `franja_no_disponible`, `reservas_expiradas_materializadas` (con la cantidad) y `pago_rechazado_expirada`. Campos permitidos: `reservaId`, `canchaId`, `codigo` y la duración en ms. **Nunca** se registra el token ni otro dato personal (Principio VI)
- [ ] T071 [P] Crear `backend/scripts/carga.ts`, que con `fetch` y `Promise.all` lanza 500 creaciones y 500 consultas de disponibilidad contra un backend local (con 50 en paralelo) e imprime los percentiles p50, p95 y p99. El objetivo es p95 < 300 ms (plan.md, Performance Goals). Documentar el resultado en `specs/001-crear-reserva/quickstart.md`
- [ ] T072 [P] Escribir `README.md` en la raíz: qué es el proyecto, los requisitos, la puesta en marcha (enlazando `specs/001-crear-reserva/quickstart.md`), la estructura del monorepo y el flujo "contrato primero" (editar `contracts/openapi.yaml` → `npm run contracts:generate`)
- [ ] T073 Añadir el script raíz `contracts:check` en `package.json`: regenera `packages/contracts/src/schema.ts` y falla si `git diff --exit-code` detecta cambios, para que los tipos nunca se aparten del contrato (Principio IV)
- [ ] T074 Ejecutar `npm run lint && npm run typecheck && npm run test:unit -w backend && npm run test:integration -w backend && npm run test:contract -w backend && npm test -w frontend && npm run test:e2e`, y corregir lo que falle
- [ ] T075 Seguir [quickstart.md](./quickstart.md) de punta a punta (puesta en marcha, los pasos manuales 1–8 y la comprobación del Principio I con `psql`) y corregir cualquier diferencia entre la guía y el comportamiento real
- [ ] T076 Revisar la sección "Constitution Check" de [plan.md](./plan.md) contra el código final (las 6 puertas y la tabla de tests por criterio) y anotar en `plan.md` cualquier desviación encontrada

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no depende de nada.
- **Foundational (Phase 2)**: depende del Setup y **bloquea** todas las historias.
- **US1 (Phase 3)**: depende de la Phase 2. Crea el servicio, el repositorio, los controladores y la
  página que las demás historias amplían.
- **US2 (Phase 4)**: depende de la US1, porque amplía `crear-reserva.service.ts`, el repositorio y el
  controlador.
- **US3 (Phase 5)**: depende de la US1. Es independiente de la US2, salvo que las dos tocan
  `crear-reserva.service.ts` (hay que coordinar si se hacen en paralelo).
- **US4 (Phase 6)**: depende de la US1. El test de integración RN3-8 (T063) además necesita la
  materialización de la US3 (T059).
- **Polish (Phase 7)**: depende de todas las historias.

### User Story Dependencies

```text
Setup ─► Foundational ─► US1 (MVP) ─┬─► US2
                                     ├─► US3 ─┐
                                     └────────┴─► US4 ─► Polish
```

### Within Each User Story

- Primero los tests, que deben fallar. Después el dominio, luego el repositorio, el servicio, el
  controlador y por último el frontend.
- Las tareas que modifican el mismo archivo (`crear-reserva.service.ts`, `reservas.repository.ts`,
  `reservas.controller.ts`, `page.tsx`, `reservas.contract.spec.ts`, `e2e/reservas.spec.ts`) se hacen
  en orden, aunque sean de historias distintas.

### Parallel Opportunities

- **Setup**: T002, T003, T006, T007, T008 y T009 en paralelo, después de T001.
- **Foundational**: los tests T010 y T011 en paralelo. Después, T014, T016, T018, T019 y T020 en
  paralelo. T015 depende de T019; T017 depende de T016; T021 depende de T013, T015 y T019.
- **US1**: los 9 tests (T023–T031) en paralelo. Después, T032 y T033 en paralelo, y T037, T038 y T040
  en paralelo cuando T035 esté listo. T042 y T043 también en paralelo.
- **US2 / US3 / US4**: dentro de cada historia, todos sus tests en paralelo. Si hay más de un
  desarrollador, las tareas de dominio de la US3 (T057) y de la US4 (T066) pueden avanzar a la vez
  que la US2.

---

## Parallel Example: User Story 1

```bash
# Escribir todos los tests de la US1 a la vez (deben fallar):
Task: "Tests unitarios de valor en backend/test/unit/reservas/valor.spec.ts"
Task: "Tests unitarios de reserva en backend/test/unit/reservas/reserva.spec.ts"
Task: "Tests unitarios de disponibilidad en backend/test/unit/reservas/disponibilidad.spec.ts"
Task: "Integración de creación en backend/test/integration/crear-reserva.spec.ts"
Task: "Integración de disponibilidad en backend/test/integration/disponibilidad.spec.ts"
Task: "Contrato de reservas en backend/test/contract/reservas.contract.spec.ts"
Task: "Contrato de disponibilidad en backend/test/contract/disponibilidad.contract.spec.ts"
Task: "E2E US1 en e2e/reservas.spec.ts"
Task: "Formato en frontend/test/formato.spec.ts"

# Después, el dominio en paralelo:
Task: "valor.ts en backend/src/reservas/dominio/valor.ts"
Task: "reserva.ts en backend/src/reservas/dominio/reserva.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Tests de reglas en backend/test/unit/reservas/reglas.spec.ts"
Task: "Integración RN3 en backend/test/integration/reglas.spec.ts"
Task: "Contrato 422 en backend/test/contract/reservas.contract.spec.ts"
Task: "E2E AC4 en e2e/reservas.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup.
2. Phase 2: Foundational. Esta fase incluye la restricción de exclusión, así que el Principio I se
   cumple desde el primer día.
3. Phase 3: US1.
4. **Parar y validar**: los pasos 1, 2 y 7 de quickstart.md, y los tests T023–T031 en verde.
5. Mostrar la demo.

### Incremental Delivery

1. Setup + Foundational → la base está lista y la base de datos ya impide solapamientos.
2. US1 → reservar y ver la disponibilidad (MVP).
3. US2 → mensajes claros con solicitudes simultáneas y reintentos sin error. Con la US1 y la US2 se
   completan las historias P1.
4. US3 → las franjas sin pago se liberan.
5. US4 → las reglas de negocio del horario, RN1, RN2 y RN3.
6. Polish → logs, rendimiento, documentación y la revisión de la constitución.

### Parallel Team Strategy

1. Todo el equipo hace Setup y Foundational.
2. Una persona hace la US1, mientras otra adelanta los tests de dominio de la US3 y la US4 (T053 y T062)
   y la implementación pura de esos dominios (T057 y T066).
3. Al cerrar la US1: una persona toma la US2 y otra la US3. Se coordinan en `crear-reserva.service.ts`.
4. La US4 se integra al final, porque su test RN3-8 necesita la US3.

---

## Notes

- [P] = otro archivo, sin depender de tareas pendientes.
- La etiqueta [USn] permite rastrear cada tarea hasta su historia de usuario en spec.md.
- Hay que comprobar que cada test falla antes de implementar (Principio III).
- Conviene hacer un commit por tarea o por grupo lógico de tareas.
- No hay que editar `packages/contracts/src/schema.ts` a mano: se cambia `contracts/openapi.yaml` y se
  regenera.
- El endpoint `POST /api/test/reloj` solo existe con `RELOJ_AJUSTABLE=1`. Nunca se activa en
  producción.
