import { CrearReservaService } from '../../src/reservas/aplicacion/crear-reserva.service';
import { crearAppDeTest, SABADO, type AppDeTest } from '../helpers/app';
import { cerrarPool, limpiar, prepararBaseDeTest, sembrarCatalogo, type CatalogoDeTest } from '../helpers/db';
import { nuevoJugador } from '../helpers/tokens';
import { obtenerPool } from '../../src/db/pool';

describe('crear reserva (US1)', () => {
  let t: AppDeTest;
  let cat: CatalogoDeTest;
  let servicio: CrearReservaService;

  beforeAll(async () => {
    await prepararBaseDeTest();
    cat = await sembrarCatalogo();
    t = await crearAppDeTest();
    servicio = t.get(CrearReservaService);
  });
  beforeEach(() => limpiar());
  afterAll(async () => {
    await t.app.close();
    await cerrarPool();
  });

  const solicitud = (canchaId: string, horaInicio = '19:00', duracionMinutos = 60) => ({
    canchaId,
    fecha: SABADO,
    horaInicio,
    duracionMinutos,
  });

  it('AC1: crea la reserva pendiente de pago con su valor y expiración', async () => {
    const jugador = nuevoJugador();
    const { reserva, creada } = await servicio.crear(jugador, solicitud(cat.c1));
    expect(creada).toBe(true);
    expect(reserva.estado).toBe('pendiente_pago');
    expect(reserva.valorCop).toBe(80000);
    expect(reserva.inicio.toISOString()).toBe('2026-11-15T00:00:00.000Z');
    expect(reserva.expiraEn.getTime() - reserva.creadaEn.getTime()).toBe(10 * 60 * 1000);

    const { rows } = await obtenerPool().query('SELECT estado, valor_cop, jugador_id FROM reservas');
    expect(rows).toEqual([{ estado: 'pendiente_pago', valor_cop: 80000, jugador_id: jugador }]);
  });

  it('US1-2: una reserva en C1 no ocupa C2 en el mismo horario', async () => {
    await servicio.crear(nuevoJugador(), solicitud(cat.c1));
    await expect(servicio.crear(nuevoJugador(), solicitud(cat.c2))).resolves.toMatchObject({ creada: true });
  });

  it('US1-3: acepta una franja contigua (20:00–21:00) en la misma cancha', async () => {
    await servicio.crear(nuevoJugador(), solicitud(cat.c1, '19:00'));
    await expect(servicio.crear(nuevoJugador(), solicitud(cat.c1, '20:00'))).resolves.toMatchObject({
      creada: true,
    });
  });

  it('US1-6 / FR-017: el único dato personal guardado es jugador_id', async () => {
    const { rows } = await obtenerPool().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'reservas' ORDER BY column_name`,
    );
    expect(rows.map((r) => r.column_name)).toEqual(
      [
        'cancha_id',
        'confirmada_en',
        'creada_en',
        'estado',
        'expira_en',
        'fin',
        'id',
        'inicio',
        'jugador_id',
        'valor_cop',
      ].sort(),
    );
  });

  it('FR-019: un cambio posterior de tarifa no altera el valor de una reserva creada', async () => {
    const { reserva } = await servicio.crear(nuevoJugador(), solicitud(cat.c1));
    await obtenerPool().query('UPDATE canchas SET tarifa_por_hora_cop = 100000 WHERE id = $1', [cat.c1]);
    const { rows } = await obtenerPool().query('SELECT valor_cop FROM reservas WHERE id = $1', [reserva.id]);
    expect(rows[0]).toEqual({ valor_cop: 80000 });
  });
});
