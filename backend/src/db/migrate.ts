import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { cargarEnv } from '../config';
import { cerrarPool, obtenerPool } from './pool';

const DIRECTORIO = join(__dirname, 'migrations');

/** Aplica, en orden alfabético y cada una en su transacción, las migraciones .sql pendientes. */
export async function aplicarMigraciones(pool: Pool = obtenerPool()): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())`,
  );
  const { rows } = await pool.query<{ nombre: string }>('SELECT nombre FROM schema_migrations');
  const aplicadas = new Set(rows.map((r) => r.nombre));
  const pendientes = readdirSync(DIRECTORIO)
    .filter((f) => f.endsWith('.sql') && !aplicadas.has(f))
    .sort();

  for (const nombre of pendientes) {
    const sql = readFileSync(join(DIRECTORIO, nombre), 'utf8');
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(sql);
      await cliente.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [nombre]);
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw new Error(`Falló la migración ${nombre}: ${(error as Error).message}`);
    } finally {
      cliente.release();
    }
  }
  return pendientes;
}

if (require.main === module) {
  cargarEnv();
  aplicarMigraciones()
    .then((aplicadas) => {
      console.log(
        aplicadas.length ? `Migraciones aplicadas: ${aplicadas.join(', ')}` : 'Sin migraciones pendientes',
      );
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => cerrarPool());
}
