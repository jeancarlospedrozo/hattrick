import { obtenerPool } from '../../src/db/pool';
import { ConfirmarPagoService } from '../../src/reservas/aplicacion/confirmar-pago.service';
import { ConsultarDisponibilidadService } from '../../src/reservas/aplicacion/consultar-disponibilidad.service';
import { CrearReservaService } from '../../src/reservas/aplicacion/crear-reserva.service';
import { ObtenerReservaService } from '../../src/reservas/aplicacion/obtener-reserva.service';
import { FranjaNoDisponible, ReservaExpirada } from '../../src/reservas/dominio/errores';
import { AHORA_BASE, crearAppDeTest, SABADO, type AppDeTest } from '../helpers/app';
import { cerrarPool, limpiar, prepararBaseDeTest, sembrarCatalogo, type CatalogoDeTest } from '../helpers/db';
import { nuevoJugador } from '../helpers/tokens';

const MIN = 60_000;

describe('expiración de reservas sin pago (US3, FR-007, FR-008, SC-004)', () => {
  let t: AppDeTest;
  let cat: CatalogoDeTest;
  let crear: CrearReservaService;
  let obtener: ObtenerReservaService;
  let disponibilidad: ConsultarDisponibilidadService;
  let pago: ConfirmarPagoService;

  beforeAll(async () => {
    await prepararBaseDeTest();
    cat = await sembrarCatalogo();
    t = await crearAppDeTest();
    crear = t.get(CrearReservaService);
    obtener = t.get(ObtenerReservaService);
    disponibilidad = t.get(ConsultarDisponibilidadService);
    pago = t.get(ConfirmarPagoService);
  });
  beforeEach(async () => {
    await limpiar();
    t.reloj.fijar(AHORA_BASE);
  });
  afterAll(async () => {
    await t.app.close();
    await cerrarPool();
  });

  const pedir = (jugador: string, horaInicio = '19:00', canchaId = cat.c1) =>
    crear.crear(jugador, { canchaId, fecha: SABADO, horaInicio, duracionMinutos: 60 });
  const estadoGuardado = async (id: string) =>
    (await obtenerPool().query<{ estado: string }>('SELECT estado FROM reservas WHERE id = $1', [id])).rows[0]
      ?.estado;
  const bloque19 = async () =>
    (await disponibilidad.consultar(cat.c1, SABADO)).bloques.find((b) => b.inicio.includes('T19:00'))?.estado;

  it('AC3: a los 10 minutos la reserva expira, la franja queda libre y otro jugador puede tomarla', async () => {
    const jugador = nuevoJugador();
    const { reserva } = await pedir(jugador);

    t.reloj.avanzar(10 * MIN);
    expect((await obtener.obtener(jugador, reserva.id)).reserva.estado).toBe('expirada');
    expect(await bloque19()).toBe('libre');

    await expect(pedir(nuevoJugador())).resolves.toMatchObject({ creada: true });
    // La reserva original quedó guardada como expirada (materializada).
    expect(await estadoGuardado(reserva.id)).toBe('expirada');
  });

  it('a los 9:59 la franja sigue ocupada', async () => {
    await pedir(nuevoJugador());
    t.reloj.avanzar(10 * MIN - 1000);
    expect(await bloque19()).toBe('ocupada');
    await expect(pedir(nuevoJugador())).rejects.toBeInstanceOf(FranjaNoDisponible);
  });

  it('US3-2: pagar tras 10 minutos se rechaza y la reserva queda guardada como expirada', async () => {
    const { reserva } = await pedir(nuevoJugador());
    t.reloj.avanzar(10 * MIN);
    await expect(pago.confirmar(reserva.id)).rejects.toBeInstanceOf(ReservaExpirada);
    expect(await estadoGuardado(reserva.id)).toBe('expirada');
  });

  it('pagar antes de 10 minutos confirma la reserva, y una confirmada nunca expira', async () => {
    const { reserva } = await pedir(nuevoJugador());
    t.reloj.avanzar(9 * MIN);
    const confirmada = await pago.confirmar(reserva.id);
    expect(confirmada.estado).toBe('confirmada');
    const { rows } = await obtenerPool().query('SELECT estado, confirmada_en FROM reservas WHERE id = $1', [
      reserva.id,
    ]);
    expect(rows[0]?.estado).toBe('confirmada');
    expect(rows[0]?.confirmada_en).toEqual(new Date(AHORA_BASE.getTime() + 9 * MIN));

    t.reloj.avanzar(60 * MIN);
    expect(await bloque19()).toBe('ocupada');
  });

  it('carrera pago vs. reserva nueva: el pago a los 9:59 gana y la reserva a los 10:00 se rechaza', async () => {
    const { reserva } = await pedir(nuevoJugador());
    t.reloj.avanzar(10 * MIN - 1000);
    await pago.confirmar(reserva.id);
    t.reloj.avanzar(1000);
    await expect(pedir(nuevoJugador())).rejects.toBeInstanceOf(FranjaNoDisponible);
  });

  it('interbloqueo: con 5 reservas vencidas sin marcar, 10 solicitudes simultáneas no dan error 500 y 1 gana', async () => {
    for (const hora of ['17:00', '18:00', '19:00', '20:00', '21:00']) {
      await pedir(nuevoJugador(), hora);
    }
    t.reloj.avanzar(10 * MIN);
    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => pedir(nuevoJugador(), '19:00')),
    );
    const exitos = resultados.filter((r) => r.status === 'fulfilled');
    const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(exitos).toHaveLength(1);
    for (const r of rechazos) {
      expect(r.reason).toBeInstanceOf(FranjaNoDisponible);
    }
  }, 30_000);
});
