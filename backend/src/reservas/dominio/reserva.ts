import { ReservaExpirada } from './errores';

export type EstadoReserva = 'pendiente_pago' | 'confirmada' | 'expirada';

export interface Reserva {
  id: string;
  canchaId: string;
  jugadorId: string;
  inicio: Date;
  fin: Date;
  estado: EstadoReserva;
  valorCop: number;
  creadaEn: Date;
  expiraEn: Date;
  confirmadaEn: Date | null;
}

/** Plazo de pago: fijo e igual para todas las sedes (FR-007, clarificación 5). */
export const PLAZO_PAGO_MS = 10 * 60 * 1000;

export interface DatosReservaNueva {
  id: string;
  canchaId: string;
  jugadorId: string;
  inicio: Date;
  fin: Date;
  valorCop: number;
  ahora: Date;
}

/** Toda reserva aceptada nace "pendiente de pago" y expira a los 10 minutos (FR-002, FR-007). */
export function crearReservaNueva(datos: DatosReservaNueva): Reserva {
  return {
    id: datos.id,
    canchaId: datos.canchaId,
    jugadorId: datos.jugadorId,
    inicio: datos.inicio,
    fin: datos.fin,
    estado: 'pendiente_pago',
    valorCop: datos.valorCop,
    creadaEn: datos.ahora,
    expiraEn: new Date(datos.ahora.getTime() + PLAZO_PAGO_MS),
    confirmadaEn: null,
  };
}

/**
 * Estado efectivo (research R2): una reserva pendiente cuyo plazo ya venció está expirada,
 * aunque el cambio todavía no se haya guardado. A los 10:00 exactos ya está expirada.
 */
export function estadoEfectivo(reserva: Reserva, ahora: Date): EstadoReserva {
  if (reserva.estado === 'pendiente_pago' && ahora.getTime() >= reserva.expiraEn.getTime()) {
    return 'expirada';
  }
  return reserva.estado;
}

/** Una reserva vigente ocupa su franja (FR-003). */
export function esVigente(reserva: Reserva, ahora: Date): boolean {
  return estadoEfectivo(reserva, ahora) !== 'expirada';
}

/** Copia de la reserva con su estado efectivo. */
export function conEstadoEfectivo(reserva: Reserva, ahora: Date): Reserva {
  return { ...reserva, estado: estadoEfectivo(reserva, ahora) };
}

/**
 * Pago de una reserva (FR-008): solo se acepta si `ahora < expiraEn`. A los 10:00 exactos o
 * después lanza ReservaExpirada. Una reserva ya confirmada no cambia.
 */
export function confirmarPago(reserva: Reserva, ahora: Date): Reserva {
  if (reserva.estado === 'confirmada') {
    return reserva;
  }
  if (estadoEfectivo(reserva, ahora) === 'expirada') {
    throw new ReservaExpirada();
  }
  return { ...reserva, estado: 'confirmada', confirmadaEn: ahora };
}
