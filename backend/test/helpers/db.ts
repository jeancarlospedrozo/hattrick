import type { Pool } from 'pg';
import { aplicarMigraciones } from '../../src/db/migrate';
import { cerrarPool, obtenerPool } from '../../src/db/pool';
import { SEED, sembrar } from '../../src/db/seed';

export type CatalogoDeTest = typeof SEED;

/** Migra la base de test (DATABASE_URL apunta a DATABASE_URL_TEST, ver env.ts) y devuelve el pool. */
export async function prepararBaseDeTest(): Promise<Pool> {
  const pool = obtenerPool();
  await aplicarMigraciones(pool);
  return pool;
}

export async function limpiar(): Promise<void> {
  await obtenerPool().query('TRUNCATE reservas');
  // Restaura las tarifas del seed por si un test las cambió.
  await obtenerPool().query(`UPDATE canchas SET tarifa_por_hora_cop = 80000 WHERE id = ANY($1)`, [
    [SEED.c1, SEED.c2],
  ]);
}

export function sembrarCatalogo(): Promise<CatalogoDeTest> {
  return sembrar(obtenerPool());
}

export { cerrarPool };
