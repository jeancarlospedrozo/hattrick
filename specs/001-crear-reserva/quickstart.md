# Quickstart: validar "Crear reserva"

**Feature**: `001-crear-reserva` | Contrato: [contracts/openapi.yaml](./contracts/openapi.yaml) |
Modelo: [data-model.md](./data-model.md)

Esta guía explica cómo comprobar que la feature funciona de punta a punta. Los comandos usan los
scripts que se definen en las tareas de implementación.

## Prerrequisitos

- Node.js 22 LTS y npm 10 o superior
- Docker con Docker Compose (para PostgreSQL 16)
- Navegadores de Playwright: `npx playwright install chromium`

## Puesta en marcha

```bash
cp .env.example .env              # DATABASE_URL, AUTH_JWT_SECRET, PORT
npm install                        # instala los workspaces backend, frontend y packages/contracts
docker compose up -d db            # PostgreSQL 16 en localhost:5432
npm run contracts:generate         # genera los tipos de contracts/openapi.yaml en packages/contracts
npm run db:migrate -w backend      # crea btree_gist, sedes, canchas y reservas (con EXCLUDE)
npm run db:seed -w backend         # sede "Sede Norte" (06:00–23:00, America/Bogota), canchas C1 y C2 (80.000 COP/h)
npm run dev                        # backend en :3001/api y frontend en :3000
npm run token:dev -w backend -- <uuid-jugador>   # imprime un JWT de desarrollo
```

## Tests por capa

| Comando | Qué cubre | Necesita la base de datos |
| --- | --- | --- |
| `npm run test:unit -w backend` | Reglas de dominio: RN1–RN3, horario, alineación, antelación, estado efectivo, valor, pago expirado | No |
| `npm run test:integration -w backend` | Restricción de exclusión, concurrencia (AC2, RN3), reintentos, expiración materializada, valor fijo | Sí |
| `npm run test:contract -w backend` | Respuestas validadas contra `openapi.yaml`: códigos 200/201/401/404/409/422 | Sí |
| `npm run test:e2e` | Recorrido en el navegador: consultar, reservar, ver la expiración y el valor, mensajes de rechazo | Sí (y la app corriendo) |

Todos deben pasar antes de dar la feature por terminada.

## Comprobaciones manuales (con la API)

Antes de empezar, define `TOKEN_A` y `TOKEN_B` (tokens de dos jugadores), `C1` (el id de la cancha
del seed) y `SABADO`: un sábado dentro de los próximos 14 días.

1. **Reservar una franja libre (AC1, FR-002, FR-019)**

   ```bash
   curl -s -X POST localhost:3001/api/reservas -H "Authorization: Bearer $TOKEN_A" \
     -H 'Content-Type: application/json' \
     -d "{\"canchaId\":\"$C1\",\"fecha\":\"$SABADO\",\"horaInicio\":\"19:00\",\"duracionMinutos\":60}"
   ```

   Respuesta esperada: `201`, `estado: "pendiente_pago"`, `valorCop: 80000`, `expiraEn` 10 minutos
   después de `creadaEn`, con desfase `-05:00`.

2. **Ver la franja ocupada (FR-003, FR-018)**: `GET /api/canchas/$C1/disponibilidad?fecha=$SABADO`
   muestra los bloques 19:00 y 19:30 como `ocupada`, sin datos del jugador. La misma consulta sobre
   C2 los muestra como `libre`.
3. **Doble envío (FR-016)**: repetir el paso 1 con `TOKEN_A` → `200` con el mismo `id`.
4. **Franja ocupada (FR-006)**: el paso 1 con `TOKEN_B` → `409` con
   `"Esta franja ya no está disponible"`.
5. **Franjas contiguas (FR-005)**: con `TOKEN_B`, `horaInicio: "20:00"` → `201`.
6. **Reglas (FR-009 a FR-014)**: cada una de estas solicitudes debe responder `422` con el código
   indicado:
   - `22:30` con 60 minutos → `FUERA_DE_HORARIO`
   - 30 o 75 minutos → `DURACION_INVALIDA`
   - `19:15` → `INICIO_NO_ALINEADO`
   - un día dentro de 15 días → `ANTELACION_EXCEDIDA`
   - una tercera reserva pendiente del mismo jugador → `LIMITE_PENDIENTES`
7. **Sin autenticar (FR-001)**: el paso 1 sin la cabecera `Authorization` → `401`, y no se crea
   ninguna reserva.
8. **Expiración (AC3)**: la cubren los tests de integración y de extremo a extremo con el reloj
   ajustable (`RELOJ_AJUSTABLE=1` solo en el entorno de test). A mano: esperar 10 minutos,
   `GET /api/reservas/{id}` → `estado: "expirada"`, y la franja aparece `libre`.

## Comprobación del Principio I directamente en la base de datos

Inserta con `psql` dos reservas que se solapan, en la misma cancha y en estado `pendiente_pago` o
`confirmada`, sin pasar por la aplicación. El segundo `INSERT` debe fallar con
`conflicting key value violates exclusion constraint` (código `23P01`).
