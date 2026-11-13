/**
 * Errores del dominio. Cada uno tiene un `codigo` estable (contrato OpenAPI) y un `mensaje`
 * en español para mostrar al jugador (FR-014). Los mensajes se centralizan aquí.
 */
export abstract class ErrorDominio extends Error {
  abstract readonly codigo: string;

  constructor(public readonly mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class SolicitudInvalida extends ErrorDominio {
  readonly codigo = 'SOLICITUD_INVALIDA';
}

export class CanchaNoEncontrada extends ErrorDominio {
  readonly codigo = 'CANCHA_NO_ENCONTRADA';
  constructor() {
    super('Cancha no encontrada');
  }
}

export class ReservaNoEncontrada extends ErrorDominio {
  readonly codigo = 'RESERVA_NO_ENCONTRADA';
  constructor() {
    super('Reserva no encontrada');
  }
}

export const MENSAJE_FRANJA_NO_DISPONIBLE = 'Esta franja ya no está disponible';

export class FranjaNoDisponible extends ErrorDominio {
  readonly codigo = 'FRANJA_NO_DISPONIBLE';
  constructor() {
    super(MENSAJE_FRANJA_NO_DISPONIBLE);
  }
}

export class ReservaExpirada extends ErrorDominio {
  readonly codigo = 'RESERVA_EXPIRADA';
  constructor() {
    super('La reserva expiró y ya no puede pagarse');
  }
}

export type CodigoRegla =
  | 'DURACION_INVALIDA'
  | 'INICIO_NO_ALINEADO'
  | 'FUERA_DE_HORARIO'
  | 'FRANJA_PASADA'
  | 'ANTELACION_EXCEDIDA'
  | 'LIMITE_PENDIENTES';

export class RechazoRegla extends ErrorDominio {
  constructor(
    public readonly codigo: CodigoRegla,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export const MENSAJES_REGLA = {
  DURACION_INVALIDA: 'La duración debe ser de al menos 60 minutos y múltiplo de 30',
  INICIO_NO_ALINEADO: 'La franja debe empezar en una hora en punto o una media hora',
  fueraDeHorario: (apertura: string, cierre: string) => `La sede abre de ${apertura} a ${cierre}`,
  FRANJA_PASADA: 'No puedes reservar una franja que ya empezó',
  ANTELACION_EXCEDIDA: 'Solo puedes reservar con hasta 14 días de antelación',
  LIMITE_PENDIENTES: 'Ya tienes 2 reservas pendientes de pago',
} as const;
