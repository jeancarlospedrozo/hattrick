import { DateTime } from 'luxon';
import { SolicitudInvalida } from './errores';

/**
 * Conversión entre la hora local de la sede y los instantes UTC (Principio II, FR-015).
 * Es el único archivo del dominio que usa luxon (research R5).
 */

export interface SolicitudFranja {
  fecha: string; // YYYY-MM-DD, día local de la sede
  horaInicio: string; // HH:mm, hora local de la sede
  duracionMinutos: number;
}

export interface MomentoLocal {
  fecha: string; // YYYY-MM-DD local
  minutos: number; // minutos desde la medianoche local de `fecha`
  segundos?: number;
}

export interface Intervalo {
  inicio: Date;
  fin: Date;
}

export interface FranjaUtc extends Intervalo {
  inicioLocal: MomentoLocal;
  finLocal: MomentoLocal;
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validarFecha(fecha: string): void {
  if (!RE_FECHA.test(fecha) || !DateTime.fromISO(fecha).isValid) {
    throw new SolicitudInvalida('fecha debe tener el formato YYYY-MM-DD');
  }
}

function validarHora(hora: string): void {
  if (!RE_HORA.test(hora)) {
    throw new SolicitudInvalida('horaInicio debe tener el formato HH:mm');
  }
}

function enZona(fecha: string, hora: string, zona: string): DateTime {
  const dt = DateTime.fromISO(`${fecha}T${hora}`, { zone: zona });
  if (!dt.isValid) {
    throw new SolicitudInvalida('La fecha u hora no son válidas en la zona horaria de la sede');
  }
  return dt;
}

function aMomentoLocal(dt: DateTime): MomentoLocal {
  return { fecha: dt.toISODate() ?? '', minutos: dt.hour * 60 + dt.minute };
}

/** Instante UTC que corresponde a `fecha` + `hora` (HH:mm) locales de la zona indicada. */
export function instanteLocal(fecha: string, hora: string, zona: string): Date {
  validarFecha(fecha);
  return enZona(fecha, hora, zona).toJSDate();
}

/** Convierte una solicitud expresada en hora local de la sede a un intervalo UTC `[inicio, fin)`. */
export function aFranjaUtc(solicitud: SolicitudFranja, zona: string): FranjaUtc {
  validarFecha(solicitud.fecha);
  validarHora(solicitud.horaInicio);
  if (!Number.isInteger(solicitud.duracionMinutos) || solicitud.duracionMinutos < 1) {
    throw new SolicitudInvalida('duracionMinutos debe ser un entero positivo');
  }
  const inicio = enZona(solicitud.fecha, solicitud.horaInicio, zona);
  const fin = inicio.plus({ minutes: solicitud.duracionMinutos });
  return {
    inicio: inicio.toJSDate(),
    fin: fin.toJSDate(),
    inicioLocal: aMomentoLocal(inicio),
    finLocal: aMomentoLocal(fin),
  };
}

/** Momento local (fecha, minutos y segundos) de un instante en la zona indicada. */
export function momentoLocalDe(d: Date, zona: string): MomentoLocal {
  const dt = DateTime.fromJSDate(d, { zone: zona });
  return { ...aMomentoLocal(dt), segundos: dt.second + dt.millisecond / 1000 };
}

/** ISO 8601 con el desfase de la sede, p. ej. `2026-11-14T19:00:00.000-05:00`. */
export function formatearEnSede(d: Date, zona: string): string {
  const iso = DateTime.fromJSDate(d, { zone: zona }).toISO();
  if (!iso) {
    throw new Error(`No se pudo formatear la fecha en la zona ${zona}`);
  }
  return iso;
}

/** Fecha local (YYYY-MM-DD) de un instante en la zona indicada. */
export function fechaLocal(d: Date, zona: string): string {
  return DateTime.fromJSDate(d, { zone: zona }).toISODate() ?? '';
}

/** `HH:mm` a minutos desde la medianoche. */
export function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Semiabiertos `[inicio, fin)`: dos intervalos contiguos no se solapan (FR-005). */
export function seSolapan(a: Intervalo, b: Intervalo): boolean {
  return a.inicio.getTime() < b.fin.getTime() && b.inicio.getTime() < a.fin.getTime();
}
