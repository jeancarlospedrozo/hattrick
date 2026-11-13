import { cargarEnv } from '../src/config';
import { cerrarPool, obtenerPool } from '../src/db/pool';
import { SEED } from '../src/db/seed';

// Vacía la tabla de reservas y restablece las tarifas del seed.
// Solo se permite contra una base cuyo nombre termine en "_test".
cargarEnv();
const url = process.env.DATABASE_URL ?? '';
if (!/_test(\?.*)?$/.test(url)) {
  console.error('truncar-test solo puede ejecutarse contra una base *_test');
  process.exit(1);
}

async function restablecer(): Promise<void> {
  const pool = obtenerPool();
  await pool.query('TRUNCATE reservas');
  await pool.query('UPDATE canchas SET tarifa_por_hora_cop = 80000 WHERE id = ANY($1)', [[SEED.c1, SEED.c2]]);
}

restablecer()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => cerrarPool());
