import type { CrearReservaRequest, Reserva as ReservaDto } from '@reservas/contracts';
import { SolicitudInvalida } from '../dominio/errores';
import { formatearEnSede } from '../dominio/franja';
import type { Reserva } from '../dominio/reserva';

export const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLAVES: (keyof CrearReservaRequest)[] = ['canchaId', 'fecha', 'horaInicio', 'duracionMinutos'];

/** Valida la forma del cuerpo contra `CrearReservaRequest`; las reglas de negocio van aparte (422). */
export function leerCrearReservaRequest(cuerpo: unknown): CrearReservaRequest {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw new SolicitudInvalida('El cuerpo debe ser un objeto JSON');
  }
  const datos = cuerpo as Record<string, unknown>;
  const extras = Object.keys(datos).filter((k) => !CLAVES.includes(k as keyof CrearReservaRequest));
  if (extras.length > 0) {
    throw new SolicitudInvalida(`Campos no permitidos: ${extras.join(', ')}`);
  }
  const { canchaId, fecha, horaInicio, duracionMinutos } = datos;
  if (typeof canchaId !== 'string' || !RE_UUID.test(canchaId)) {
    throw new SolicitudInvalida('canchaId debe ser un uuid');
  }
  if (typeof fecha !== 'string' || !RE_FECHA.test(fecha)) {
    throw new SolicitudInvalida('fecha debe tener el formato YYYY-MM-DD');
  }
  if (typeof horaInicio !== 'string' || !RE_HORA.test(horaInicio)) {
    throw new SolicitudInvalida('horaInicio debe tener el formato HH:mm');
  }
  if (typeof duracionMinutos !== 'number' || !Number.isInteger(duracionMinutos) || duracionMinutos < 1) {
    throw new SolicitudInvalida('duracionMinutos debe ser un entero positivo');
  }
  return { canchaId: canchaId.toLowerCase(), fecha, horaInicio, duracionMinutos };
}

export function validarUuid(valor: string, nombre: string): string {
  if (!RE_UUID.test(valor)) {
    throw new SolicitudInvalida(`${nombre} debe ser un uuid`);
  }
  return valor.toLowerCase();
}

/** Reserva del dominio → respuesta del contrato, con fechas en la zona de la sede. Sin `jugadorId`. */
export function aReservaDto(reserva: Reserva, zonaHoraria: string): ReservaDto {
  return {
    id: reserva.id,
    canchaId: reserva.canchaId,
    inicio: formatearEnSede(reserva.inicio, zonaHoraria),
    fin: formatearEnSede(reserva.fin, zonaHoraria),
    zonaHoraria,
    estado: reserva.estado,
    valorCop: reserva.valorCop,
    creadaEn: formatearEnSede(reserva.creadaEn, zonaHoraria),
    expiraEn: formatearEnSede(reserva.expiraEn, zonaHoraria),
  };
}
