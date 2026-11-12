import { SetMetadata } from '@nestjs/common';
import { ErrorDominio } from '../reservas/dominio/errores';

/** Mensajes del 401 por endpoint (FR-001, Principio VI); se centralizan aquí. */
export const MENSAJES_NO_AUTENTICADO = {
  reservar: 'Debes iniciar sesión para reservar',
  verReserva: 'Debes iniciar sesión para ver la reserva',
} as const;

export class NoAutenticado extends ErrorDominio {
  readonly codigo = 'NO_AUTENTICADO';
  constructor(mensaje: string = MENSAJES_NO_AUTENTICADO.reservar) {
    super(mensaje);
  }
}

export const CLAVE_MENSAJE_NO_AUTENTICADO = 'mensajeNoAutenticado';

/** Fija el mensaje que `JwtGuard` devuelve en el 401 de un endpoint. */
export const MensajeNoAutenticado = (mensaje: string) => SetMetadata(CLAVE_MENSAJE_NO_AUTENTICADO, mensaje);
