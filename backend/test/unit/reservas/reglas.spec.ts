import { RechazoRegla } from '../../../src/reservas/dominio/errores';
import { aFranjaUtc } from '../../../src/reservas/dominio/franja';
import { validarFranja, validarLimitePendientes } from '../../../src/reservas/dominio/reglas';

const ZONA = 'America/Bogota';
// Martes 2026-11-10, 12:00 en Bogotá.
const AHORA = new Date('2026-11-10T17:00:00.000Z');
const SEDE = { apertura: '06:00', cierre: '23:00' };

function validar(fecha: string, horaInicio: string, duracionMinutos: number): void {
  const franja = aFranjaUtc({ fecha, horaInicio, duracionMinutos }, ZONA);
  validarFranja({ ...franja, duracionMinutos, ...SEDE, ahora: AHORA });
}

function rechazo(fn: () => void): RechazoRegla {
  try {
    fn();
  } catch (error) {
    if (error instanceof RechazoRegla) return error;
    throw error;
  }
  throw new Error('Se esperaba un RechazoRegla');
}

describe('reglas de la franja (US4)', () => {
  describe('AC4 / FR-009: horario de la sede', () => {
    it('rechaza 22:30–23:30 indicando el horario', () => {
      const r = rechazo(() => validar('2026-11-14', '22:30', 60));
      expect(r.codigo).toBe('FUERA_DE_HORARIO');
      expect(r.mensaje).toBe('La sede abre de 06:00 a 23:00');
    });
    it('acepta 22:00–23:00', () => {
      expect(() => validar('2026-11-14', '22:00', 60)).not.toThrow();
    });
    it('rechaza 05:30–06:30', () => {
      expect(rechazo(() => validar('2026-11-14', '05:30', 60)).codigo).toBe('FUERA_DE_HORARIO');
    });
  });

  describe('RN1 / FR-010: duración', () => {
    it.each([30, 75])('rechaza %i minutos', (minutos) => {
      const r = rechazo(() => validar('2026-11-14', '19:00', minutos));
      expect(r.codigo).toBe('DURACION_INVALIDA');
      expect(r.mensaje).toBe('La duración debe ser de al menos 60 minutos y múltiplo de 30');
    });
    it.each([60, 90, 120])('acepta %i minutos', (minutos) => {
      expect(() => validar('2026-11-14', '19:00', minutos)).not.toThrow();
    });
  });

  it('FR-011: rechaza un inicio no alineado (19:15)', () => {
    const r = rechazo(() => validar('2026-11-14', '19:15', 60));
    expect(r.codigo).toBe('INICIO_NO_ALINEADO');
    expect(r.mensaje).toBe('La franja debe empezar en una hora en punto o una media hora');
  });

  describe('RN2 / FR-012: antelación', () => {
    it('rechaza un inicio a más de 14 días', () => {
      const r = rechazo(() => validar('2026-11-24', '12:30', 60));
      expect(r.codigo).toBe('ANTELACION_EXCEDIDA');
      expect(r.mensaje).toBe('Solo puedes reservar con hasta 14 días de antelación');
    });
    it('acepta un inicio exactamente a 14 × 24 h', () => {
      expect(() => validar('2026-11-24', '12:00', 60)).not.toThrow();
    });
    it.each(['12:00', '11:30'])('rechaza un inicio igual o anterior a ahora (%s)', (hora) => {
      const r = rechazo(() => validar('2026-11-10', hora, 60));
      expect(r.codigo).toBe('FRANJA_PASADA');
      expect(r.mensaje).toBe('No puedes reservar una franja que ya empezó');
    });
  });

  it('evalúa en orden: duración → alineación → horario → pasada → antelación', () => {
    // Incumple todo: duración 45, inicio 05:15, fecha pasada.
    expect(rechazo(() => validar('2026-11-01', '05:15', 45)).codigo).toBe('DURACION_INVALIDA');
    expect(rechazo(() => validar('2026-11-01', '05:15', 60)).codigo).toBe('INICIO_NO_ALINEADO');
    expect(rechazo(() => validar('2026-11-01', '05:30', 60)).codigo).toBe('FUERA_DE_HORARIO');
    expect(rechazo(() => validar('2026-11-01', '19:00', 60)).codigo).toBe('FRANJA_PASADA');
    expect(rechazo(() => validar('2026-12-30', '19:00', 60)).codigo).toBe('ANTELACION_EXCEDIDA');
  });

  describe('RN3 / FR-013: límite de pendientes', () => {
    it('rechaza con 2 pendientes', () => {
      const r = rechazo(() => validarLimitePendientes(2));
      expect(r.codigo).toBe('LIMITE_PENDIENTES');
      expect(r.mensaje).toBe('Ya tienes 2 reservas pendientes de pago');
    });
    it.each([0, 1])('acepta con %i pendientes', (n) => {
      expect(() => validarLimitePendientes(n)).not.toThrow();
    });
  });
});
