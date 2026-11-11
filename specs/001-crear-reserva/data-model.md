# Data Model: Crear reserva

**Feature**: `001-crear-reserva` | **Fecha**: 2026-11-11 | **Research**: [research.md](./research.md)

Todas las columnas de fecha y hora son `timestamptz` y se guardan en UTC (Principio II). Los intervalos
son semiabiertos `[inicio, fin)`.

## Sede *(tabla mínima; la ampliará la feature de sedes)*

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `nombre` | `text` | no vacío |
| `zona_horaria` | `text` | zona IANA válida; por defecto `America/Bogota` (FR-015) |
| `apertura` | `time` | hora local de la sede; igual todos los días |
| `cierre` | `time` | hora local; `cierre > apertura` (no hay horarios que crucen la medianoche) |

## Cancha *(tabla mínima; la ampliará la feature de canchas)*

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `sede_id` | `uuid` FK → `sedes.id` | obligatoria |
| `nombre` | `text` | no vacío; único dentro de la sede |
| `tarifa_por_hora_cop` | `integer` | `> 0`; pesos colombianos; igual en todos los horarios (FR-019) |

## Reserva

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` PK | generado en el servidor |
| `cancha_id` | `uuid` FK → `canchas.id` | obligatoria |
| `jugador_id` | `uuid` | `sub` del JWT; el único dato personal (FR-017). No tiene FK, porque la tabla de jugadores es de la feature de autenticación |
| `inicio` | `timestamptz` | ver las reglas de la franja |
| `fin` | `timestamptz` | `fin > inicio` |
| `estado` | `text` | `pendiente_pago` \| `confirmada` \| `expirada` (con `CHECK`) |
| `valor_cop` | `integer` | `round(tarifa × minutos / 60)`, fijado al crear la reserva (FR-019) |
| `creada_en` | `timestamptz` | lo pone el `Reloj` de la aplicación |
| `expira_en` | `timestamptz` | `creada_en + 10 min` (plazo fijo, FR-007) |
| `confirmada_en` | `timestamptz` null | se llena al confirmar el pago |

### Restricciones e índices

- `EXCLUDE USING gist (cancha_id WITH =, tstzrange(inicio, fin, '[)') WITH &&) WHERE (estado IN ('pendiente_pago','confirmada'))`:
  la garantía de que no haya solapamientos (Principio I, FR-004). Necesita `CREATE EXTENSION btree_gist`.
- `CHECK (fin > inicio)`, `CHECK (expira_en > creada_en)`, `CHECK (valor_cop >= 0)`.
- Índice `(jugador_id) WHERE estado = 'pendiente_pago'` para contar rápido las pendientes (RN3).

## Reglas de la franja (dominio, sin base de datos)

Se calculan en la hora local de la sede y se convierten a UTC antes de guardar. Cada regla tiene su
código de rechazo (FR-014):

| Regla | Condición de aceptación | Código de rechazo |
| --- | --- | --- |
| FR-010 (RN1) | `duracion >= 60` y `duracion % 30 == 0` (minutos) | `DURACION_INVALIDA` |
| FR-011 | el minuto local de inicio es `00` o `30` (segundos = 0) | `INICIO_NO_ALINEADO` |
| FR-009 | `inicio_local >= apertura` y `fin_local <= cierre`, el mismo día | `FUERA_DE_HORARIO` |
| FR-012 (RN2) | `inicio > ahora` | `FRANJA_PASADA` |
| FR-012 (RN2) | `inicio <= ahora + 14 × 24 h` (exactamente 14 días se acepta) | `ANTELACION_EXCEDIDA` |
| FR-013 (RN3) | pendientes vigentes del jugador `< 2` | `LIMITE_PENDIENTES` |
| FR-004/006 | no se solapa con una reserva vigente de la cancha | `FRANJA_NO_DISPONIBLE` |

Las reglas se evalúan en el orden de la tabla y se devuelve el primer rechazo. `FRANJA_NO_DISPONIBLE`
siempre la decide la base de datos.

## Estados y transiciones

```text
                 pago con ahora < expira_en
 (crear) ──► pendiente_pago ─────────────────────► confirmada
                 │
                 │ ahora >= expira_en
                 ▼
              expirada   (final; un pago posterior se rechaza: RESERVA_EXPIRADA, FR-008)
```

- **Estado efectivo** (función pura `estadoEfectivo(reserva, ahora)`): si el estado guardado es
  `pendiente_pago` y `ahora >= expira_en`, el estado efectivo es `expirada`. En cualquier otro caso es
  el estado guardado. Todas las lecturas usan el estado efectivo.
- **Materialización**: el estado efectivo `expirada` se guarda en la base de datos (`UPDATE`) cuando
  se crea una reserva en esa cancha o del mismo jugador, o cuando se intenta pagar (ver research R2).
- **Vigente**: una reserva es vigente (ocupa su franja) si su estado efectivo es `pendiente_pago` o
  `confirmada`.
- Las reservas expiradas se conservan como historial (no se borran).

## Disponibilidad (proyección de lectura, no se guarda)

Para una cancha y una `fecha` local se devuelve:

- El horario de la sede y su zona horaria.
- Una lista de bloques de 30 minutos entre la apertura y el cierre, cada uno con su `inicio`, su `fin`
  y su estado (`libre` u `ocupada`). Un bloque está ocupado si se solapa con una reserva vigente de la
  cancha.
- No se incluye ningún dato del jugador (FR-018).
