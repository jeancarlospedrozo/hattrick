import { createHmac, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { APIRequestContext, Page } from '@playwright/test';
import { ENV_E2E } from './env';

export const API = 'http://localhost:3001/api';

/** Ids fijos del seed (backend/src/db/seed.ts). */
export const C1 = '7b1e7c62-3f4e-4c8e-9a51-2c1d0f6a9b10';
export const SABADO = '2026-11-14';
export const AHORA_BASE = '2026-11-10T12:00:00-05:00';

const base64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** JWT HS256 con `node:crypto`, sin dependencias nuevas. */
export function tokenPara(jugadorId: string): string {
  const cabecera = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const ahora = Math.floor(Date.now() / 1000);
  const carga = base64url(JSON.stringify({ sub: jugadorId, iat: ahora, exp: ahora + 3600 }));
  const firma = createHmac('sha256', ENV_E2E.AUTH_JWT_SECRET).update(`${cabecera}.${carga}`).digest('base64url');
  return `${cabecera}.${carga}.${firma}`;
}

export const nuevoJugador = (): string => randomUUID();

export async function fijarReloj(request: APIRequestContext, iso: string): Promise<void> {
  const res = await request.post(`${API}/test/reloj`, {
    headers: { Authorization: `Bearer ${tokenPara(nuevoJugador())}` },
    data: { fijar: iso },
  });
  if (!res.ok()) throw new Error(`No se pudo fijar el reloj: ${res.status()}`);
}

export async function avanzarReloj(request: APIRequestContext, ms: number): Promise<void> {
  const res = await request.post(`${API}/test/reloj`, {
    headers: { Authorization: `Bearer ${tokenPara(nuevoJugador())}` },
    data: { avanzarMs: ms },
  });
  if (!res.ok()) throw new Error(`No se pudo avanzar el reloj: ${res.status()}`);
}

export async function reservarPorApi(
  request: APIRequestContext,
  jugadorId: string,
  horaInicio: string,
  duracionMinutos = 60,
) {
  return request.post(`${API}/reservas`, {
    headers: { Authorization: `Bearer ${tokenPara(jugadorId)}` },
    data: { canchaId: C1, fecha: SABADO, horaInicio, duracionMinutos },
  });
}

/** Deja el token del jugador en localStorage antes de cargar la página. */
export async function iniciarSesion(page: Page, jugadorId: string): Promise<void> {
  await page.addInitScript((token) => window.localStorage.setItem('token', token), tokenPara(jugadorId));
}

/** Ejecuta un script del backend (tsx) con el entorno indicado. */
export function ejecutarEnBackend(args: string[], env: Record<string, string>): void {
  const r = spawnSync('npx', ['tsx', ...args], {
    cwd: resolve(__dirname, '..', 'backend'),
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error(`Falló: tsx ${args.join(' ')}`);
}

export function vaciarReservas(): void {
  ejecutarEnBackend(['scripts/truncar-test.ts'], { DATABASE_URL: ENV_E2E.DATABASE_URL_TEST });
}
