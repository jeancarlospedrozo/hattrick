import { obtenerPool } from '../../src/db/pool';
import { CrearReservaService } from '../../src/reservas/aplicacion/crear-reserva.service';
import { ConsultarDisponibilidadService } from '../../src/reservas/aplicacion/consultar-disponibilidad.service';
import { FranjaNoDisponible } from '../../src/reservas/dominio/errores';
import { crearAppDeTest, SABADO, type AppDeTest } from '../helpers/app';
import { cerrarPool, limpiar, prepararBaseDeTest, sembrarCatalogo, type CatalogoDeTest } from '../helpers/db';
import { nuevoJugador } from '../helpers/tokens';

describe('reservas simultáneas (US2, FR-004, FR-006, SC-002)', () => {
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

  const pedir = (horaInicio: string, duracionMinutos = 60, jugador = nuevoJugador()) =>
    servicio.crear(jugador, { canchaId: cat.c1, fecha: SABADO, horaInicio, duracionMinutos });

  const contarVigentes = async () =>
    Number(
      (
        await obtenerPool().query<{ n: string }>(
          `SELECT count(*) AS n FROM reservas WHERE estado IN ('pendiente_pago', 'confirmada')`,
        )
      ).rows[0]?.n,
    );

  it('AC2: de 10 solicitudes simultáneas para la misma franja, exactamente 1 obtiene la reserva (20 rondas)', async () => {
    for (let ronda = 0; ronda < 20; ronda++) {
      await limpiar();
      const resultados = await Promise.allSettled(Array.from({ length: 10 }, () => pedir('19:00')));
      const exitos = resultados.filter((r) => r.status === 'fulfilled');
      const rechazos = resultados.filter((r) => r.status === 'rejected');
      expect(exitos).toHaveLength(1);
      expect(rechazos).toHaveLength(9);
      for (const r of rechazos) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(FranjaNoDisponible);
        expect((r as PromiseRejectedResult).reason.mensaje).toBe('Esta franja ya no está disponible');
      }
      expect(await contarVigentes()).toBe(1);
    }
  }, 60_000);

  it('US2-2: un solapamiento parcial (19:00–20:30 contra 20:00–21:00) se rechaza', async () => {
    await pedir('19:00', 90);
    await expect(pedir('20:00', 60)).rejects.toBeInstanceOf(FranjaNoDisponible);
  });

  it('disponibilidad desactualizada: la franja se ocupa entre la consulta y el envío', async () => {
    const disp = t.get<ConsultarDisponibilidadService>(ConsultarDisponibilidadService);
    const antes = await disp.consultar(cat.c1, SABADO);
    expect(antes.bloques.find((b) => b.inicio.includes('T19:00'))?.estado).toBe('libre');
    await pedir('19:00');
    await expect(pedir('19:00')).rejects.toBeInstanceOf(FranjaNoDisponible);
  });
});
