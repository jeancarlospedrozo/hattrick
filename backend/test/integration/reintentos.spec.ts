import { obtenerPool } from '../../src/db/pool';
import { CrearReservaService } from '../../src/reservas/aplicacion/crear-reserva.service';
import { FranjaNoDisponible } from '../../src/reservas/dominio/errores';
import { crearAppDeTest, SABADO, type AppDeTest } from '../helpers/app';
import { cerrarPool, limpiar, prepararBaseDeTest, sembrarCatalogo, type CatalogoDeTest } from '../helpers/db';
import { nuevoJugador } from '../helpers/tokens';

describe('reintentos y doble envío (FR-016)', () => {
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

  const solicitud = (horaInicio = '19:00', duracionMinutos = 60) => ({
    canchaId: cat.c1,
    fecha: SABADO,
    horaInicio,
    duracionMinutos,
  });
  const contar = async () =>
    Number((await obtenerPool().query<{ n: string }>('SELECT count(*) AS n FROM reservas')).rows[0]?.n);

  it('secuencial: el segundo envío devuelve la misma reserva sin crear otra', async () => {
    const jugador = nuevoJugador();
    const primero = await servicio.crear(jugador, solicitud());
    const segundo = await servicio.crear(jugador, solicitud());
    expect(primero.creada).toBe(true);
    expect(segundo.creada).toBe(false);
    expect(segundo.reserva.id).toBe(primero.reserva.id);
    expect(await contar()).toBe(1);
  });

  it('simultáneo: dos envíos iguales del mismo jugador crean 1 fila y no lanzan error', async () => {
    const jugador = nuevoJugador();
    const [a, b] = await Promise.all([
      servicio.crear(jugador, solicitud()),
      servicio.crear(jugador, solicitud()),
    ]);
    expect(a.reserva.id).toBe(b.reserva.id);
    expect([a.creada, b.creada].sort()).toEqual([false, true]);
    expect(await contar()).toBe(1);
  });

  it('la misma cancha con otra franja que se solapa no es un reintento', async () => {
    const jugador = nuevoJugador();
    await servicio.crear(jugador, solicitud('19:00'));
    await expect(servicio.crear(jugador, solicitud('19:30'))).rejects.toBeInstanceOf(FranjaNoDisponible);
  });
});
