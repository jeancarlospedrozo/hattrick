import { obtenerPool } from '../../src/db/pool';
import { SEED } from '../../src/db/seed';
import { ConfirmarPagoService } from '../../src/reservas/aplicacion/confirmar-pago.service';
import { CrearReservaService } from '../../src/reservas/aplicacion/crear-reserva.service';
import { RechazoRegla } from '../../src/reservas/dominio/errores';
import { AHORA_BASE, crearAppDeTest, SABADO, type AppDeTest } from '../helpers/app';
import { cerrarPool, limpiar, prepararBaseDeTest, sembrarCatalogo, type CatalogoDeTest } from '../helpers/db';
import { nuevoJugador } from '../helpers/tokens';

const OTRA_SEDE = '22222222-2222-4222-8222-222222222222';
const CANCHA_OTRA_SEDE = '7b1e7c62-3f4e-4c8e-9a51-2c1d0f6a9b30';

describe('límite de 2 reservas pendientes (RN3, FR-013)', () => {
  let t: AppDeTest;
  let cat: CatalogoDeTest;
  let crear: CrearReservaService;

  beforeAll(async () => {
    await prepararBaseDeTest();
    cat = await sembrarCatalogo();
    await obtenerPool().query(
      `INSERT INTO sedes (id, nombre, apertura, cierre) VALUES ($1, 'Sede Sur', '06:00', '23:00') ON CONFLICT DO NOTHING`,
      [OTRA_SEDE],
    );
    await obtenerPool().query(
      `INSERT INTO canchas (id, sede_id, nombre, tarifa_por_hora_cop) VALUES ($1, $2, 'S1', 70000) ON CONFLICT DO NOTHING`,
      [CANCHA_OTRA_SEDE, OTRA_SEDE],
    );
    t = await crearAppDeTest();
    crear = t.get(CrearReservaService);
  });
  beforeEach(async () => {
    await limpiar();
    t.reloj.fijar(AHORA_BASE);
  });
  afterAll(async () => {
    await t.app.close();
    await cerrarPool();
  });

  const pedir = (jugador: string, horaInicio: string, canchaId: string = SEED.c1) =>
    crear.crear(jugador, { canchaId, fecha: SABADO, horaInicio, duracionMinutos: 60 });

  const esLimite = (error: unknown) => error instanceof RechazoRegla && error.codigo === 'LIMITE_PENDIENTES';

  it('con 2 pendientes en canchas y franjas distintas, una tercera se rechaza', async () => {
    const j = nuevoJugador();
    await pedir(j, '17:00', cat.c1);
    await pedir(j, '18:00', cat.c2);
    await expect(pedir(j, '19:00', cat.c1)).rejects.toMatchObject({ codigo: 'LIMITE_PENDIENTES' });
  });

  it('RN3-8: con 2 pendientes, cuando una expira puede crear otra', async () => {
    const j = nuevoJugador();
    await pedir(j, '17:00');
    t.reloj.avanzar(5 * 60_000);
    await pedir(j, '18:00');
    t.reloj.avanzar(5 * 60_000); // la primera cumple 10 minutos
    await expect(pedir(j, '19:00')).resolves.toMatchObject({ creada: true });
  });

  it('solicitudes simultáneas del mismo jugador: como máximo 2 éxitos', async () => {
    const j = nuevoJugador();
    const resultados = await Promise.allSettled([pedir(j, '17:00'), pedir(j, '18:00'), pedir(j, '19:00')]);
    const exitos = resultados.filter((r) => r.status === 'fulfilled');
    const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(exitos).toHaveLength(2);
    expect(rechazos).toHaveLength(1);
    expect(esLimite(rechazos[0]?.reason)).toBe(true);
  });

  it('las reservas confirmadas no cuentan para el límite', async () => {
    const j = nuevoJugador();
    const { reserva } = await pedir(j, '17:00');
    await t.get<ConfirmarPagoService>(ConfirmarPagoService).confirmar(reserva.id);
    await pedir(j, '18:00');
    await expect(pedir(j, '19:00')).resolves.toMatchObject({ creada: true });
  });

  it('el límite es global: 2 pendientes en sedes distintas llenan el cupo', async () => {
    const j = nuevoJugador();
    await pedir(j, '17:00', cat.c1);
    await pedir(j, '17:00', CANCHA_OTRA_SEDE);
    await expect(pedir(j, '19:00', cat.c2)).rejects.toMatchObject({ codigo: 'LIMITE_PENDIENTES' });
  });
});
