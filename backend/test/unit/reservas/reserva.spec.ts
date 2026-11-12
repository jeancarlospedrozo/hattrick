import { ReservaExpirada } from '../../../src/reservas/dominio/errores';
import {
  confirmarPago,
  crearReservaNueva,
  esVigente,
  estadoEfectivo,
  PLAZO_PAGO_MS,
  type Reserva,
} from '../../../src/reservas/dominio/reserva';

const AHORA = new Date('2026-11-10T17:00:00.000Z');

export function reservaDePrueba(cambios: Partial<Reserva> = {}): Reserva {
  return {
    ...crearReservaNueva({
      id: '00000000-0000-4000-8000-000000000001',
      canchaId: '00000000-0000-4000-8000-0000000000c1',
      jugadorId: '00000000-0000-4000-8000-0000000000aa',
      inicio: new Date('2026-11-15T00:00:00.000Z'),
      fin: new Date('2026-11-15T01:00:00.000Z'),
      valorCop: 80000,
      ahora: AHORA,
    }),
    ...cambios,
  };
}

describe('reserva (FR-002, FR-007)', () => {
  it('se crea pendiente de pago y expira a los 10 minutos', () => {
    const r = reservaDePrueba();
    expect(r.estado).toBe('pendiente_pago');
    expect(r.creadaEn).toEqual(AHORA);
    expect(PLAZO_PAGO_MS).toBe(10 * 60 * 1000);
    expect(r.expiraEn).toEqual(new Date(AHORA.getTime() + 10 * 60 * 1000));
    expect(r.confirmadaEn).toBeNull();
  });

  it('mantiene el estado guardado mientras no venza el plazo', () => {
    const r = reservaDePrueba();
    expect(estadoEfectivo(r, AHORA)).toBe('pendiente_pago');
    expect(estadoEfectivo(r, new Date(AHORA.getTime() + 9 * 60 * 1000))).toBe('pendiente_pago');
  });

  it('es vigente si está pendiente o confirmada, y no si está expirada', () => {
    expect(esVigente(reservaDePrueba(), AHORA)).toBe(true);
    expect(esVigente(reservaDePrueba({ estado: 'confirmada', confirmadaEn: AHORA }), AHORA)).toBe(true);
    expect(esVigente(reservaDePrueba({ estado: 'expirada' }), AHORA)).toBe(false);
  });
});

describe('expiración y pago (US3, FR-007, FR-008)', () => {
  it('a expiraEn - 1 ms sigue pendiente; a expiraEn exacto ya está expirada ("pago en el límite")', () => {
    const r = reservaDePrueba();
    expect(estadoEfectivo(r, new Date(r.expiraEn.getTime() - 1))).toBe('pendiente_pago');
    expect(estadoEfectivo(r, r.expiraEn)).toBe('expirada');
  });

  it('confirmarPago antes del plazo confirma la reserva', () => {
    const r = reservaDePrueba();
    const pago = new Date(r.expiraEn.getTime() - 1000);
    expect(confirmarPago(r, pago)).toEqual({ ...r, estado: 'confirmada', confirmadaEn: pago });
  });

  it('confirmarPago a los 10:00 exactos o después lanza ReservaExpirada (US3-2)', () => {
    const r = reservaDePrueba();
    expect(() => confirmarPago(r, r.expiraEn)).toThrow(ReservaExpirada);
    expect(() => confirmarPago(r, new Date(r.expiraEn.getTime() + 60_000))).toThrow(ReservaExpirada);
  });

  it('confirmarPago de una reserva ya confirmada no cambia nada', () => {
    const confirmada = reservaDePrueba({ estado: 'confirmada', confirmadaEn: AHORA });
    expect(confirmarPago(confirmada, new Date(AHORA.getTime() + 60_000))).toEqual(confirmada);
  });

  it('una reserva confirmada nunca expira', () => {
    const confirmada = reservaDePrueba({ estado: 'confirmada', confirmadaEn: AHORA });
    expect(estadoEfectivo(confirmada, new Date(AHORA.getTime() + 24 * 3600_000))).toBe('confirmada');
  });
});
