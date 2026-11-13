/**
 * Valor a pagar (FR-019): tarifa por hora × duración en horas, en pesos enteros.
 * Las mitades se redondean hacia arriba (research R10).
 */
export function calcularValor(tarifaPorHoraCop: number, duracionMinutos: number): number {
  return Math.round((tarifaPorHoraCop * duracionMinutos) / 60);
}
