import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { cargarEnv, requerirEnv } from '../src/config';
import { SEED } from '../src/db/seed';

/**
 * Prueba de carga simple contra un backend local (plan.md, Performance Goals: p95 < 300 ms).
 * Uso: npm run carga -w backend [-- <url-api>]
 *
 * Lanza 500 creaciones de reservas (jugadores, días y horas distintos, con muchos choques de franja)
 * y 500 consultas de disponibilidad, de 50 en 50 en paralelo.
 */
cargarEnv();
const API = process.argv[2] ?? `http://localhost:${process.env.PORT ?? 3001}/api`;
const TOTAL = 500;
const PARALELO = 50;
const jwt = new JwtService({ secret: requerirEnv('AUTH_JWT_SECRET') });

function fechaLocal(diasDesdeHoy: number): string {
  const d = new Date(Date.now() + diasDesdeHoy * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
}

async function medir(fn: () => Promise<Response>): Promise<{ ms: number; status: number }> {
  const t0 = performance.now();
  const res = await fn();
  await res.arrayBuffer();
  return { ms: performance.now() - t0, status: res.status };
}

async function enLotes<T>(n: number, fn: (i: number) => Promise<T>): Promise<T[]> {
  const resultados: T[] = [];
  for (let i = 0; i < n; i += PARALELO) {
    const lote = Array.from({ length: Math.min(PARALELO, n - i) }, (_, j) => fn(i + j));
    resultados.push(...(await Promise.all(lote)));
  }
  return resultados;
}

function percentil(valores: number[], p: number): number {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)] ?? 0;
}

function resumen(nombre: string, medidas: { ms: number; status: number }[]): void {
  const ms = medidas.map((m) => m.ms);
  const estados = medidas.reduce<Record<number, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `${nombre}: n=${medidas.length} p50=${percentil(ms, 50).toFixed(1)}ms ` +
      `p95=${percentil(ms, 95).toFixed(1)}ms p99=${percentil(ms, 99).toFixed(1)}ms estados=${JSON.stringify(estados)}`,
  );
}

async function principal(): Promise<void> {
  const horas = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
  const creaciones = await enLotes(TOTAL, (i) =>
    medir(() =>
      fetch(`${API}/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt.sign({ sub: randomUUID() }, { algorithm: 'HS256', expiresIn: '1h' })}`,
        },
        body: JSON.stringify({
          canchaId: i % 2 === 0 ? SEED.c1 : SEED.c2,
          fecha: fechaLocal(1 + (i % 10)),
          horaInicio: horas[i % horas.length],
          duracionMinutos: 60,
        }),
      }),
    ),
  );
  const consultas = await enLotes(TOTAL, (i) =>
    medir(() =>
      fetch(
        `${API}/canchas/${i % 2 === 0 ? SEED.c1 : SEED.c2}/disponibilidad?fecha=${fechaLocal(1 + (i % 10))}`,
      ),
    ),
  );
  resumen('POST /reservas', creaciones);
  resumen('GET /disponibilidad', consultas);
  const p95 = Math.max(
    percentil(
      creaciones.map((m) => m.ms),
      95,
    ),
    percentil(
      consultas.map((m) => m.ms),
      95,
    ),
  );
  console.log(p95 < 300 ? `OK: p95 ${p95.toFixed(1)}ms < 300ms` : `FALLA: p95 ${p95.toFixed(1)}ms >= 300ms`);
  if (p95 >= 300) process.exitCode = 1;
}

void principal();
