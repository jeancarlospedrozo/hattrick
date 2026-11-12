# Reservas de canchas

Sistema para que los jugadores reserven una cancha en una franja libre sin llamar a la sede.
La primera feature implementada es [001-crear-reserva](specs/001-crear-reserva/spec.md): consultar
la disponibilidad de una cancha, reservar una franja (pendiente de pago durante 10 minutos), resolver
solicitudes simultáneas y aplicar las reglas de la sede.

Las reglas del proyecto están en la [constitución](.specify/memory/constitution.md): integridad de
reservas en la base de datos, fechas en UTC con intervalos `[inicio, fin)`, test-first, contrato
primero, simplicidad y protección de datos personales.

## Requisitos

- Node.js 22 LTS o superior y npm 10 o superior
- Docker con Docker Compose (PostgreSQL 16)

## Puesta en marcha

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run contracts:generate
npm run db:migrate -w backend
npm run db:seed -w backend
npm run dev            # backend en :3001/api y frontend en :3000
```

Abre `http://localhost:3000/canchas/7b1e7c62-3f4e-4c8e-9a51-2c1d0f6a9b10` (cancha C1 del seed). Para
reservar, guarda un token en el navegador: `npm run token:dev -w backend -- <uuid-jugador>` y en la
consola del navegador `localStorage.setItem('token', '<token>')`.

La guía completa de validación está en [specs/001-crear-reserva/quickstart.md](specs/001-crear-reserva/quickstart.md).

## Estructura

```text
contracts/openapi.yaml     # contrato vivo de la API (fuente de verdad)
packages/contracts/        # tipos generados desde el contrato (no se editan a mano)
backend/                   # NestJS: módulos auth, catalogo, reservas (dominio puro + aplicación + infraestructura + http)
frontend/                  # Next.js (App Router): /canchas/[canchaId]
e2e/                       # Playwright
docker-compose.yml         # PostgreSQL 16 (bases reservas y reservas_test)
specs/001-crear-reserva/   # spec, plan, research, modelo de datos, contrato de diseño y tareas
```

## Contrato primero

1. Edita `contracts/openapi.yaml`.
2. Regenera los tipos: `npm run contracts:generate`.
3. Ajusta backend y frontend hasta que compilen y pasen los tests de contrato.

`npm run contracts:check` falla si los tipos generados no coinciden con el contrato.

## Tests

| Comando | Qué cubre |
| --- | --- |
| `npm run test:unit -w backend` | Reglas de dominio, sin HTTP ni base de datos |
| `npm run test:integration -w backend` | PostgreSQL real: restricción de exclusión, concurrencia, expiración, límites |
| `npm run test:contract -w backend` | Respuestas validadas contra `contracts/openapi.yaml` |
| `npm test -w frontend` | Formato de hora y valor (corre con `TZ=Asia/Tokyo`) |
| `npm run test:e2e` | Navegador: reservar, concurrencia, expiración y reglas (levanta backend y frontend solo) |
| `npm run lint` / `npm run typecheck` | ESLint estricto y TypeScript |

Los tests de integración, contrato y e2e usan la base `reservas_test` y un reloj ajustable.
