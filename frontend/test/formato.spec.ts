import { horaLocal, hoyEn, pesos } from '../src/lib/formato';

const normalizar = (s: string) => s.replace(/\s/g, ' ');

describe('formato (Principio II, FR-015, FR-019)', () => {
  it('el proceso corre en otra zona horaria que la sede', () => {
    // El script de test fija TZ=Asia/Tokyo.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Asia/Tokyo');
  });

  it('muestra la hora en la zona de la sede', () => {
    expect(horaLocal('2026-11-14T19:00:00.000-05:00', 'America/Bogota')).toBe('19:00');
    expect(horaLocal('2026-11-15T00:00:00Z', 'America/Bogota')).toBe('19:00');
  });

  it('formatea pesos colombianos sin decimales', () => {
    expect(normalizar(pesos(80000))).toBe('$ 80.000');
  });

  it('calcula la fecha de hoy en la zona de la sede', () => {
    expect(hoyEn('America/Bogota', new Date('2026-11-15T03:00:00Z'))).toBe('2026-11-14');
  });
});
