import { Pool, type PoolClient } from 'pg';
import { requerirEnv } from '../config';

let pool: Pool | undefined;

/** Pool único del proceso, creado desde DATABASE_URL. */
export function obtenerPool(): Pool {
  pool ??= new Pool({ connectionString: requerirEnv('DATABASE_URL'), max: 20 });
  return pool;
}

export async function cerrarPool(): Promise<void> {
  if (pool) {
    const actual = pool;
    pool = undefined;
    await actual.end();
  }
}

export type Cliente = PoolClient;

/**
 * Ejecuta `fn` dentro de una transacción: COMMIT si termina bien y ROLLBACK si lanza un error.
 * El cliente siempre se libera.
 */
export async function enTransaccion<T>(fn: (cliente: Cliente) => Promise<T>): Promise<T> {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    cliente.release();
  }
}
