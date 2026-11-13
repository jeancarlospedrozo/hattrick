import { calcularBloques } from '../../../src/reservas/dominio/disponibilidad';
import { crearReservaNueva, type Reserva } from '../../../src/reservas/dominio/reserva';

const ZONA = 'America/Bogota';
const AHORA = new Date('2026-11-10T17:00:00.000Z');

function reserva(inicioUtc: string, finUtc: string, cambios: Partial<Reserva> = {}): Reserva {
  return {
    ...crearReservaNueva({
      id: '00000000-0000-4000-8000-000000000001',
      canchaId: '00000000-0000-4000-8000-0000000000c1',
      jugadorId: '00000000-0000-4000-8000-0000000000aa',
      inicio: new Date(inicioUtc),
      fin: new Date(finUtc),
      valorCop: 80000,
      ahora: AHORA,
    }),
    ...cambios,
  };
}

const base = { fecha: '2026-11-14', zona: ZONA, apertura: '06:00', cierre: '23:00', ahora: AHORA };

describe('disponibilidad (FR-018, FR-003)', () => {
  it('genera 34 bloques de 30 minutos entre 06:00 y 23:00 en la hora de la sede', () => {
    const bloques = calcularBloques({ ...base, reservas: [] });
    expect(bloques).toHaveLength(34);
    expect(bloques[0]).toEqual({
      inicio: new Date('2026-11-14T11:00:00.000Z'),
      fin: new Date('2026-11-14T11:30:00.000Z'),
      estado: 'libre',
      reservable: true,
    });
    expect(bloques.at(-1)?.fin).toEqual(new Date('2026-11-15T04:00:00.000Z'));
    expect(bloques.every((b) => b.estado === 'libre')).toBe(true);
  });

  const ocupados = (rs: Reserva[]) =>
    calcularBloques({ ...base, reservas: rs })
      .filter((b) => b.estado === 'ocupada')
      .map((b) => b.inicio.toISOString());

  it('una reserva de 19:00 a 20:00 ocupa solo los bloques 19:00 y 19:30', () => {
    expect(ocupados([reserva('2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z')])).toEqual([
      '2026-11-15T00:00:00.000Z',
      '2026-11-15T00:30:00.000Z',
    ]);
  });

  it('una reserva de 19:00 a 20:30 ocupa 3 bloques', () => {
    expect(ocupados([reserva('2026-11-15T00:00:00Z', '2026-11-15T01:30:00Z')])).toHaveLength(3);
  });

  it('las reservas expiradas no ocupan', () => {
    expect(
      ocupados([reserva('2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z', { estado: 'expirada' })]),
    ).toEqual([]);
  });

  it('el resultado no expone datos del jugador (FR-017)', () => {
    const bloques = calcularBloques({
      ...base,
      reservas: [reserva('2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z')],
    });
    expect(JSON.stringify(bloques)).not.toContain('jugador');
    expect(JSON.stringify(bloques)).not.toContain('0000000000aa');
  });

  describe('bloques no reservables (FR-012, pendiente U2)', () => {
    const reservables = (ahora: Date, fecha = '2026-11-14') =>
      calcularBloques({ ...base, fecha, ahora, reservas: [] }).map((b): [string, boolean] => [
        b.inicio.toISOString(),
        b.reservable,
      ]);

    it('un bloque que ya empezó o empieza ahora no es reservable, aunque esté libre', () => {
      // 2026-11-14 10:00 en Bogotá = 15:00Z
      const bloques = calcularBloques({ ...base, ahora: new Date('2026-11-14T15:00:00Z'), reservas: [] });
      const porInicio = new Map(bloques.map((b) => [b.inicio.toISOString(), b]));
      expect(porInicio.get('2026-11-14T14:30:00.000Z')).toMatchObject({ estado: 'libre', reservable: false });
      expect(porInicio.get('2026-11-14T15:00:00.000Z')).toMatchObject({ estado: 'libre', reservable: false });
      expect(porInicio.get('2026-11-14T15:30:00.000Z')).toMatchObject({ estado: 'libre', reservable: true });
    });

    it('un bloque a más de 14 × 24 h no es reservable; exactamente a 14 días sí', () => {
      const ahora = new Date('2026-11-14T15:00:00Z');
      const filas = new Map(reservables(ahora, '2026-11-28'));
      expect(filas.get('2026-11-28T15:00:00.000Z')).toBe(true);
      expect(filas.get('2026-11-28T15:30:00.000Z')).toBe(false);
      expect(filas.get('2026-11-28T14:30:00.000Z')).toBe(true);
    });

    it('un bloque ocupado nunca es reservable', () => {
      const bloques = calcularBloques({
        ...base,
        reservas: [reserva('2026-11-15T00:00:00Z', '2026-11-15T01:00:00Z')],
      });
      expect(bloques.filter((b) => b.estado === 'ocupada').every((b) => !b.reservable)).toBe(true);
      expect(bloques.filter((b) => b.estado === 'libre').every((b) => b.reservable)).toBe(true);
    });
  });
});
