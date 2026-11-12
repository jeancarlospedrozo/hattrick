import { SolicitudInvalida } from '../../../src/reservas/dominio/errores';
import { aFranjaUtc, formatearEnSede, instanteLocal, seSolapan } from '../../../src/reservas/dominio/franja';

const BOGOTA = 'America/Bogota';

describe('franja (FR-015, Principio II)', () => {
  it('convierte la hora local de la sede a un intervalo UTC', () => {
    const f = aFranjaUtc({ fecha: '2026-11-14', horaInicio: '19:00', duracionMinutos: 60 }, BOGOTA);
    expect(f.inicio.toISOString()).toBe('2026-11-15T00:00:00.000Z');
    expect(f.fin.toISOString()).toBe('2026-11-15T01:00:00.000Z');
    expect(f.inicioLocal).toEqual({ fecha: '2026-11-14', minutos: 19 * 60 });
    expect(f.finLocal).toEqual({ fecha: '2026-11-14', minutos: 20 * 60 });
  });

  it('formatea un instante en la zona de la sede con su desfase', () => {
    expect(formatearEnSede(new Date('2026-11-15T00:00:00Z'), BOGOTA)).toBe('2026-11-14T19:00:00.000-05:00');
  });

  it('calcula un instante a partir de una fecha y una hora locales', () => {
    expect(instanteLocal('2026-11-14', '06:00', BOGOTA).toISOString()).toBe('2026-11-14T11:00:00.000Z');
  });

  it.each([
    [{ fecha: '2026-13-01', horaInicio: '19:00', duracionMinutos: 60 }],
    [{ fecha: '14/11/2026', horaInicio: '19:00', duracionMinutos: 60 }],
    [{ fecha: '2026-11-14', horaInicio: '7pm', duracionMinutos: 60 }],
    [{ fecha: '2026-11-14', horaInicio: '24:00', duracionMinutos: 60 }],
    [{ fecha: '2026-11-14', horaInicio: '19:00', duracionMinutos: 0 }],
    [{ fecha: '2026-11-14', horaInicio: '19:00', duracionMinutos: 60.5 }],
  ])('rechaza una solicitud mal formada: %o', (solicitud) => {
    expect(() => aFranjaUtc(solicitud, BOGOTA)).toThrow(SolicitudInvalida);
  });

  it('trata las franjas como intervalos semiabiertos [inicio, fin) (FR-005)', () => {
    const a = aFranjaUtc({ fecha: '2026-11-14', horaInicio: '19:00', duracionMinutos: 60 }, BOGOTA);
    const b = aFranjaUtc({ fecha: '2026-11-14', horaInicio: '20:00', duracionMinutos: 60 }, BOGOTA);
    const c = aFranjaUtc({ fecha: '2026-11-14', horaInicio: '19:30', duracionMinutos: 60 }, BOGOTA);
    expect(seSolapan(a, b)).toBe(false);
    expect(seSolapan(b, a)).toBe(false);
    expect(seSolapan(a, c)).toBe(true);
    expect(seSolapan(c, b)).toBe(true);
  });
});
