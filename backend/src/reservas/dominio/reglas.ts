import { MENSAJES_REGLA, RechazoRegla } from './errores';
import { minutosDeHora, type MomentoLocal } from './franja';

export const DURACION_MINIMA_MIN = 60;
export const PASO_DURACION_MIN = 30;
export const ANTELACION_MAXIMA_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_PENDIENTES = 2;

export interface DatosValidacionFranja {
  duracionMinutos: number;
  inicioLocal: MomentoLocal;
  finLocal: MomentoLocal;
  inicio: Date;
  apertura: string; // HH:mm, hora local de la sede
  cierre: string; // HH:mm
  ahora: Date;
}

/**
 * Reglas de la franja, evaluadas en el orden de data-model.md; se lanza el primer rechazo (FR-014):
 * duración (RN1) → alineación (FR-011) → horario (FR-009) → pasada y antelación (RN2).
 */
export function validarFranja(d: DatosValidacionFranja): void {
  if (d.duracionMinutos < DURACION_MINIMA_MIN || d.duracionMinutos % PASO_DURACION_MIN !== 0) {
    throw new RechazoRegla('DURACION_INVALIDA', MENSAJES_REGLA.DURACION_INVALIDA);
  }

  if (d.inicioLocal.minutos % 30 !== 0 || (d.inicioLocal.segundos ?? 0) !== 0) {
    throw new RechazoRegla('INICIO_NO_ALINEADO', MENSAJES_REGLA.INICIO_NO_ALINEADO);
  }

  const dentroDelHorario =
    d.finLocal.fecha === d.inicioLocal.fecha &&
    d.inicioLocal.minutos >= minutosDeHora(d.apertura) &&
    d.finLocal.minutos <= minutosDeHora(d.cierre);
  if (!dentroDelHorario) {
    throw new RechazoRegla('FUERA_DE_HORARIO', MENSAJES_REGLA.fueraDeHorario(d.apertura, d.cierre));
  }

  if (d.inicio.getTime() <= d.ahora.getTime()) {
    throw new RechazoRegla('FRANJA_PASADA', MENSAJES_REGLA.FRANJA_PASADA);
  }

  // 14 periodos de 24 horas desde la solicitud; exactamente 14 días se acepta.
  if (d.inicio.getTime() - d.ahora.getTime() > ANTELACION_MAXIMA_MS) {
    throw new RechazoRegla('ANTELACION_EXCEDIDA', MENSAJES_REGLA.ANTELACION_EXCEDIDA);
  }
}

/** RN3: un jugador no puede tener más de 2 reservas pendientes de pago vigentes. */
export function validarLimitePendientes(pendientesVigentes: number): void {
  if (pendientesVigentes >= MAX_PENDIENTES) {
    throw new RechazoRegla('LIMITE_PENDIENTES', MENSAJES_REGLA.LIMITE_PENDIENTES);
  }
}
