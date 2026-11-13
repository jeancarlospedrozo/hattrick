/** Puerto de tiempo: el dominio nunca llama a `new Date()` directamente (research R9). */
export interface Reloj {
  ahora(): Date;
}

export const RELOJ = Symbol('RELOJ');

export class RelojSistema implements Reloj {
  ahora(): Date {
    return new Date();
  }
}

/** Reloj controlable para los tests (simula el paso de los 10 minutos de pago). */
export class RelojAjustable implements Reloj {
  private actual: number;

  constructor(inicial: Date = new Date()) {
    this.actual = inicial.getTime();
  }

  ahora(): Date {
    return new Date(this.actual);
  }

  fijar(d: Date): void {
    this.actual = d.getTime();
  }

  avanzar(ms: number): void {
    this.actual += ms;
  }
}
