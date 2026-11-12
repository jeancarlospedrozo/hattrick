import type { Pool } from 'pg';
import { cargarEnv } from '../config';
import { cerrarPool, obtenerPool } from './pool';

/** Ids fijos para que el seed sea idempotente y los tests y la guía puedan referenciarlos. */
export const SEED = {
  sedeNorte: '11111111-1111-4111-8111-111111111111',
  c1: '7b1e7c62-3f4e-4c8e-9a51-2c1d0f6a9b10',
  c2: '7b1e7c62-3f4e-4c8e-9a51-2c1d0f6a9b20',
} as const;

export async function sembrar(pool: Pool = obtenerPool()): Promise<typeof SEED> {
  await pool.query(
    `INSERT INTO sedes (id, nombre, zona_horaria, apertura, cierre)
     VALUES ($1, 'Sede Norte', 'America/Bogota', '06:00', '23:00')
     ON CONFLICT (id) DO NOTHING`,
    [SEED.sedeNorte],
  );
  await pool.query(
    `INSERT INTO canchas (id, sede_id, nombre, tarifa_por_hora_cop)
     VALUES ($1, $3, 'C1', 80000), ($2, $3, 'C2', 80000)
     ON CONFLICT (id) DO NOTHING`,
    [SEED.c1, SEED.c2, SEED.sedeNorte],
  );
  return SEED;
}

if (require.main === module) {
  cargarEnv();
  sembrar()
    .then((ids) => {
      console.log('Seed aplicado:');
      console.log(`  Sede Norte (06:00–23:00, America/Bogota): ${ids.sedeNorte}`);
      console.log(`  Cancha C1 (80.000 COP/h): ${ids.c1}`);
      console.log(`  Cancha C2 (80.000 COP/h): ${ids.c2}`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => cerrarPool());
}
