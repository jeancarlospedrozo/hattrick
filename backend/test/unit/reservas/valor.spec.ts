import { calcularValor } from '../../../src/reservas/dominio/valor';

describe('valor de la reserva (FR-019)', () => {
  it.each([
    [80000, 60, 80000],
    [80000, 90, 120000],
    [80000, 120, 160000],
    [75, 90, 113], // 112,5 se redondea hacia arriba
  ])('tarifa %i COP/h × %i min = %i COP', (tarifa, minutos, esperado) => {
    expect(calcularValor(tarifa, minutos)).toBe(esperado);
  });
});
