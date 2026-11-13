import { ConsultarDisponibilidadService } from '../../src/reservas/aplicacion/consultar-disponibilidad.service';
import { CrearReservaService } from '../../src/reservas/aplicacion/crear-reserva.service';
import { crearAppDeTest, SABADO, type AppDeTest } from '../helpers/app';
import { cerrarPool, limpiar, prepararBaseDeTest, sembrarCatalogo, type CatalogoDeTest } from '../helpers/db';
import { nuevoJugador } from '../helpers/tokens';

describe('disponibilidad (US1-7, FR-003, FR-018)', () => {
  let t: AppDeTest;
  let cat: CatalogoDeTest;

  beforeAll(async () => {
    await prepararBaseDeTest();
    cat = await sembrarCatalogo();
    t = await crearAppDeTest();
  });
  beforeEach(() => limpiar());
  afterAll(async () => {
    await t.app.close();
    await cerrarPool();
  });

  it('marca como ocupados solo los bloques de la reserva, y C2 sigue libre', async () => {
    await t
      .get<CrearReservaService>(CrearReservaService)
      .crear(nuevoJugador(), { canchaId: cat.c1, fecha: SABADO, horaInicio: '19:00', duracionMinutos: 60 });

    const disp = t.get<ConsultarDisponibilidadService>(ConsultarDisponibilidadService);
    const c1 = await disp.consultar(cat.c1, SABADO);
    expect(c1.zonaHoraria).toBe('America/Bogota');
    expect(c1.apertura).toBe('06:00');
    expect(c1.cierre).toBe('23:00');
    expect(c1.tarifaPorHoraCop).toBe(80000);
    expect(c1.bloques).toHaveLength(34);
    expect(c1.bloques.filter((b) => b.estado === 'ocupada').map((b) => b.inicio)).toEqual([
      '2026-11-14T19:00:00.000-05:00',
      '2026-11-14T19:30:00.000-05:00',
    ]);

    const c2 = await disp.consultar(cat.c2, SABADO);
    expect(c2.bloques.every((b) => b.estado === 'libre')).toBe(true);
  });
});
