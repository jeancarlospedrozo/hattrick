import { obtenerPool } from '../../src/db/pool';
import { AHORA_BASE, crearAppDeTest, SABADO, type AppDeTest } from '../helpers/app';
import { esperarConformeAlContrato } from '../helpers/contrato';
import { cerrarPool, limpiar, prepararBaseDeTest, sembrarCatalogo, type CatalogoDeTest } from '../helpers/db';
import { bearer, nuevoJugador } from '../helpers/tokens';

describe('contrato: /reservas', () => {
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

  const cuerpo = (cambios: Record<string, unknown> = {}) => ({
    canchaId: cat.c1,
    fecha: SABADO,
    horaInicio: '19:00',
    duracionMinutos: 60,
    ...cambios,
  });
  const contarReservas = async () =>
    Number((await obtenerPool().query<{ n: string }>('SELECT count(*) AS n FROM reservas')).rows[0]?.n);

  describe('US1', () => {
    it('201 con la reserva pendiente, su expiración en la hora de la sede y su valor', async () => {
      const res = await t.http
        .post('/api/reservas')
        .set('Authorization', bearer(nuevoJugador()))
        .send(cuerpo());
      expect(res.status).toBe(201);
      esperarConformeAlContrato(res, 'crearReserva');
      expect(res.body).toMatchObject({
        canchaId: cat.c1,
        inicio: '2026-11-14T19:00:00.000-05:00',
        fin: '2026-11-14T20:00:00.000-05:00',
        zonaHoraria: 'America/Bogota',
        estado: 'pendiente_pago',
        valorCop: 80000,
        creadaEn: '2026-11-10T12:00:00.000-05:00',
        expiraEn: '2026-11-10T12:10:00.000-05:00',
      });
    });

    it.each([
      ['sin token', undefined],
      ['con token inválido', 'Bearer no-es-un-jwt'],
    ])('401 %s y no crea ninguna reserva (FR-001)', async (_caso, cabecera) => {
      const req = t.http.post('/api/reservas');
      if (cabecera) req.set('Authorization', cabecera);
      const res = await req.send(cuerpo());
      expect(res.status).toBe(401);
      esperarConformeAlContrato(res, 'crearReserva');
      expect(res.body).toEqual({ codigo: 'NO_AUTENTICADO', mensaje: 'Debes iniciar sesión para reservar' });
      expect(await contarReservas()).toBe(0);
    });

    it.each([
      ['sin token', undefined],
      ['con token inválido', 'Bearer no-es-un-jwt'],
    ])('GET /reservas/{id} %s → 401 con un mensaje propio de la consulta', async (_caso, cabecera) => {
      const req = t.http.get('/api/reservas/00000000-0000-4000-8000-000000000001');
      if (cabecera) req.set('Authorization', cabecera);
      const res = await req;
      expect(res.status).toBe(401);
      esperarConformeAlContrato(res, 'obtenerReserva');
      expect(res.body).toEqual({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Debes iniciar sesión para ver la reserva',
      });
    });

    it('404 si la cancha no existe', async () => {
      const res = await t.http
        .post('/api/reservas')
        .set('Authorization', bearer(nuevoJugador()))
        .send(cuerpo({ canchaId: '00000000-0000-4000-8000-000000000000' }));
      expect(res.status).toBe(404);
      esperarConformeAlContrato(res, 'crearReserva');
      expect(res.body.codigo).toBe('CANCHA_NO_ENCONTRADA');
    });

    it.each([
      ['horaInicio mal formada', { horaInicio: '7pm' }],
      ['un campo extra', { extra: true }],
      ['canchaId que no es uuid', { canchaId: 'c1' }],
      ['duracionMinutos no entero', { duracionMinutos: '60' }],
    ])('400 con %s', async (_caso, cambios) => {
      const res = await t.http
        .post('/api/reservas')
        .set('Authorization', bearer(nuevoJugador()))
        .send(cuerpo(cambios));
      expect(res.status).toBe(400);
      esperarConformeAlContrato(res, 'crearReserva');
      expect(res.body.codigo).toBe('SOLICITUD_INVALIDA');
    });

    it('GET /reservas/{id}: 200 para el dueño y 404 para otro jugador', async () => {
      const jugador = nuevoJugador();
      const creada = await t.http.post('/api/reservas').set('Authorization', bearer(jugador)).send(cuerpo());

      const propia = await t.http
        .get(`/api/reservas/${creada.body.id}`)
        .set('Authorization', bearer(jugador));
      expect(propia.status).toBe(200);
      esperarConformeAlContrato(propia, 'obtenerReserva');
      expect(propia.body).toEqual(creada.body);

      const ajena = await t.http
        .get(`/api/reservas/${creada.body.id}`)
        .set('Authorization', bearer(nuevoJugador()));
      expect(ajena.status).toBe(404);
      esperarConformeAlContrato(ajena, 'obtenerReserva');
    });
  });

  describe('US2', () => {
    it('un segundo POST idéntico del mismo jugador responde 200 con la misma reserva (FR-016)', async () => {
      const jugador = nuevoJugador();
      const primero = await t.http.post('/api/reservas').set('Authorization', bearer(jugador)).send(cuerpo());
      const segundo = await t.http.post('/api/reservas').set('Authorization', bearer(jugador)).send(cuerpo());
      expect(primero.status).toBe(201);
      expect(segundo.status).toBe(200);
      esperarConformeAlContrato(segundo, 'crearReserva');
      expect(segundo.body.id).toBe(primero.body.id);
    });

    it('otro jugador sobre la misma franja recibe 409 con el mensaje exacto (FR-006)', async () => {
      await t.http.post('/api/reservas').set('Authorization', bearer(nuevoJugador())).send(cuerpo());
      const res = await t.http
        .post('/api/reservas')
        .set('Authorization', bearer(nuevoJugador()))
        .send(cuerpo());
      expect(res.status).toBe(409);
      esperarConformeAlContrato(res, 'crearReserva');
      expect(res.body).toEqual({
        codigo: 'FRANJA_NO_DISPONIBLE',
        mensaje: 'Esta franja ya no está disponible',
      });
    });
  });

  describe('US4', () => {
    it.each([
      ['DURACION_INVALIDA', { duracionMinutos: 75 }],
      ['INICIO_NO_ALINEADO', { horaInicio: '19:15' }],
      ['FUERA_DE_HORARIO', { horaInicio: '22:30' }],
      ['FRANJA_PASADA', { fecha: '2026-11-09' }],
      ['ANTELACION_EXCEDIDA', { fecha: '2026-11-30' }],
    ])('422 %s, conforme al contrato y sin crear reservas (FR-014, SC-005)', async (codigo, cambios) => {
      const res = await t.http
        .post('/api/reservas')
        .set('Authorization', bearer(nuevoJugador()))
        .send(cuerpo(cambios));
      expect(res.status).toBe(422);
      esperarConformeAlContrato(res, 'crearReserva');
      expect(res.body.codigo).toBe(codigo);
      expect(typeof res.body.mensaje).toBe('string');
      expect(await contarReservas()).toBe(0);
    });

    it('422 LIMITE_PENDIENTES con una tercera reserva pendiente, sin crearla', async () => {
      const jugador = nuevoJugador();
      for (const horaInicio of ['17:00', '18:00']) {
        const ok = await t.http
          .post('/api/reservas')
          .set('Authorization', bearer(jugador))
          .send(cuerpo({ horaInicio }));
        expect(ok.status).toBe(201);
      }
      const res = await t.http
        .post('/api/reservas')
        .set('Authorization', bearer(jugador))
        .send(cuerpo({ horaInicio: '19:00' }));
      expect(res.status).toBe(422);
      esperarConformeAlContrato(res, 'crearReserva');
      expect(res.body).toEqual({
        codigo: 'LIMITE_PENDIENTES',
        mensaje: 'Ya tienes 2 reservas pendientes de pago',
      });
      expect(await contarReservas()).toBe(2);
    });
  });

  describe('US3', () => {
    afterEach(() => t.reloj.fijar(AHORA_BASE));

    it('GET /reservas/{id} tras 10 minutos responde 200 con estado "expirada"', async () => {
      const jugador = nuevoJugador();
      const creada = await t.http.post('/api/reservas').set('Authorization', bearer(jugador)).send(cuerpo());
      t.reloj.avanzar(10 * 60_000);
      const res = await t.http.get(`/api/reservas/${creada.body.id}`).set('Authorization', bearer(jugador));
      expect(res.status).toBe(200);
      esperarConformeAlContrato(res, 'obtenerReserva');
      expect(res.body.estado).toBe('expirada');
    });
  });
});
