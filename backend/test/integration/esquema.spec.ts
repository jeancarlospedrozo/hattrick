import type { Pool } from 'pg';
import { cerrarPool, prepararBaseDeTest, limpiar, sembrarCatalogo, type CatalogoDeTest } from '../helpers/db';

/**
 * Principio I: la base de datos, y no solo la aplicación, impide dos reservas vigentes solapadas
 * en la misma cancha. Estos tests insertan con SQL directo, sin pasar por la aplicación.
 */
describe('esquema de reservas (Principio I)', () => {
  let pool: Pool;
  let cat: CatalogoDeTest;

  beforeAll(async () => {
    pool = await prepararBaseDeTest();
    cat = await sembrarCatalogo();
  });
  beforeEach(() => limpiar());
  afterAll(() => cerrarPool());

  const insertar = (canchaId: string, inicio: string, fin: string, estado: string) =>
    pool.query(
      `INSERT INTO reservas (cancha_id, jugador_id, inicio, fin, estado, valor_cop, creada_en, expira_en)
       VALUES ($1, gen_random_uuid(), $2, $3, $4, 80000, now(), now() + interval '10 minutes')`,
      [canchaId, inicio, fin, estado],
    );

  it('rechaza con 23P01 una reserva solapada en la misma cancha (pendiente vs confirmada)', async () => {
    await insertar(cat.c1, '2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z', 'pendiente_pago');
    await expect(
      insertar(cat.c1, '2026-11-15T00:30:00Z', '2026-11-15T01:30:00Z', 'confirmada'),
    ).rejects.toMatchObject({ code: '23P01', constraint: 'reservas_sin_solapamiento' });
  });

  it('permite una reserva expirada solapada', async () => {
    await insertar(cat.c1, '2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z', 'confirmada');
    await expect(
      insertar(cat.c1, '2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z', 'expirada'),
    ).resolves.toBeDefined();
  });

  it('acepta franjas contiguas [19:00,20:00) y [20:00,21:00)', async () => {
    await insertar(cat.c1, '2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z', 'pendiente_pago');
    await expect(
      insertar(cat.c1, '2026-11-15T01:00:00Z', '2026-11-15T02:00:00Z', 'pendiente_pago'),
    ).resolves.toBeDefined();
  });

  it('acepta la misma franja en otra cancha', async () => {
    await insertar(cat.c1, '2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z', 'pendiente_pago');
    await expect(
      insertar(cat.c2, '2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z', 'pendiente_pago'),
    ).resolves.toBeDefined();
  });

  it('rechaza fin = inicio', async () => {
    await expect(
      insertar(cat.c1, '2026-11-15T00:00:00Z', '2026-11-15T00:00:00Z', 'pendiente_pago'),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
