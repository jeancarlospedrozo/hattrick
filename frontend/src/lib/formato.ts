/**
 * Formato de presentación. Las horas se muestran SIEMPRE en la zona de la sede que viene en la
 * respuesta, nunca en la del navegador (Principio II, FR-015).
 */
export function horaLocal(iso: string, zonaHoraria: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: zonaHoraria,
  }).format(new Date(iso));
}

const FORMATO_PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function pesos(valorCop: number): string {
  return FORMATO_PESOS.format(valorCop);
}

/** Fecha de hoy (YYYY-MM-DD) en la zona indicada. */
export function hoyEn(zonaHoraria: string, ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: zonaHoraria,
  }).format(ahora);
}
