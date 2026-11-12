import { AHORA_BASE, crearAppDeTest, SABADO, type AppDeTest } from '../helpers/app';
import { esperarConformeAlContrato } from '../helpers/contrato';
import { cerrarPool, limpiar, prepararBaseDeTest, sembrarCatalogo, type CatalogoDeTest } from '../helpers/db';
import { bearer, nuevoJugador } from '../helpers/tokens';

describe('contrato: /canchas/{canchaId}/disponibilidad', () => {
  let t: AppDeTest;
  let cat: CatalogoDeTest;

  beforeAll(async () => {
    await prepararBaseDeTest();
    cat = await sembrarCatalogo();
    t = await crearAppDeTest();
  });
  beforeEach(async () => {
    t.reloj.fijar(AHORA_BASE);
    await limpiar();
  });
  afterAll(async () => {
    await t.app.close();
    await cerrarPool();
  });

  it('200 sin token, conforme al contrato y sin datos del jugador (FR-018)', async () => {
    const jugador = nuevoJugador();
    await t.http
      .post('/api/reservas')
      .set('Authorization', bearer(jugador))
      .send({ canchaId: cat.c1, fecha: SABADO, horaInicio: '19:00', duracionMinutos: 60 });

    const res = await t.http.get(`/api/canchas/${cat.c1}/disponibilidad?fecha=${SABADO}`);
    expect(res.status).toBe(200);
    esperarConformeAlContrato(res, 'consultarDisponibilidad');
    expect(JSON.stringify(res.body)).not.toContain(jugador);
    const bloques = res.body.bloques as { estado: string; reservable: boolean }[];
    expect(bloques.filter((b) => b.estado === 'ocupada')).toHaveLength(2);
    // Con el reloj de test el sábado está dentro de los 14 días: solo lo libre es reservable.
    expect(bloques.every((b) => b.reservable === (b.estado === 'libre'))).toBe(true);
  });

  it('los bloques que ya empezaron se marcan como no reservables (FR-012)', async () => {
    t.reloj.fijar(new Date('2026-11-14T15:00:00Z')); // sábado 10:00 en Bogotá
    const res = await t.http.get(`/api/canchas/${cat.c1}/disponibilidad?fecha=${SABADO}`);
    expect(res.status).toBe(200);
    esperarConformeAlContrato(res, 'consultarDisponibilidad');
    const porHora = new Map(
      (res.body.bloques as { inicio: string; reservable: boolean }[]).map((b) => [b.inicio.slice(11, 16), b]),
    );
    expect(porHora.get('10:00')?.reservable).toBe(false);
    expect(porHora.get('10:30')?.reservable).toBe(true);
  });

  it.each(['2026-13-01', 'mañana', ''])('400 con fecha inválida "%s"', async (fecha) => {
    const res = await t.http.get(`/api/canchas/${cat.c1}/disponibilidad?fecha=${encodeURIComponent(fecha)}`);
    expect(res.status).toBe(400);
    esperarConformeAlContrato(res, 'consultarDisponibilidad');
  });

  it('404 si la cancha no existe', async () => {
    const res = await t.http.get(
      `/api/canchas/00000000-0000-4000-8000-000000000000/disponibilidad?fecha=${SABADO}`,
    );
    expect(res.status).toBe(404);
    esperarConformeAlContrato(res, 'consultarDisponibilidad');
  });
});
