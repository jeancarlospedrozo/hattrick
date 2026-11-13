import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CatalogoRepository } from '../../catalogo/catalogo.repository';
import { RELOJ, type Reloj } from '../../compartido/reloj';
import { enTransaccion } from '../../db/pool';
import { CanchaNoEncontrada, FranjaNoDisponible, RechazoRegla } from '../dominio/errores';
import { aFranjaUtc } from '../dominio/franja';
import { validarFranja, validarLimitePendientes } from '../dominio/reglas';
import { crearReservaNueva, type Reserva } from '../dominio/reserva';
import { calcularValor } from '../dominio/valor';
import { ReservasRepository } from '../infraestructura/reservas.repository';

export interface SolicitudCrearReserva {
  canchaId: string;
  fecha: string;
  horaInicio: string;
  duracionMinutos: number;
}

export interface ResultadoCrearReserva {
  reserva: Reserva;
  /** false cuando es un reintento y se devuelve la reserva existente (FR-016). */
  creada: boolean;
  zonaHoraria: string;
}

const esInterbloqueo = (error: unknown): boolean => (error as { code?: string })?.code === '40P01';

/**
 * Dos inserciones simultáneas contra la restricción de exclusión pueden interbloquearse (40P01).
 * La transacción se reintenta completa una sola vez; si vuelve a fallar, la franja se informa como
 * no disponible (plan.md, "Flujo de POST /reservas").
 */
async function conReintentoPorInterbloqueo<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!esInterbloqueo(error)) throw error;
  }
  try {
    return await fn();
  } catch (error) {
    if (esInterbloqueo(error)) throw new FranjaNoDisponible();
    throw error;
  }
}

/** Flujo de `POST /reservas` (plan.md, "Flujo de POST /reservas"). */
@Injectable()
export class CrearReservaService {
  private readonly logger = new Logger('Reservas');

  constructor(
    @Inject(CatalogoRepository) private readonly catalogo: CatalogoRepository,
    @Inject(ReservasRepository) private readonly reservas: ReservasRepository,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /**
   * Registra cada resultado sin datos personales (Principio VI): solo ids de reserva y cancha,
   * el código de rechazo y la duración en ms.
   */
  async crear(jugadorId: string, solicitud: SolicitudCrearReserva): Promise<ResultadoCrearReserva> {
    const t0 = Date.now();
    try {
      const r = await this.crearSinRegistro(jugadorId, solicitud);
      this.logger.log({
        evento: r.creada ? 'reserva_creada' : 'reserva_reintento',
        reservaId: r.reserva.id,
        canchaId: r.reserva.canchaId,
        duracionMs: Date.now() - t0,
      });
      return r;
    } catch (error) {
      if (error instanceof FranjaNoDisponible) {
        this.logger.log({
          evento: 'franja_no_disponible',
          canchaId: solicitud.canchaId,
          duracionMs: Date.now() - t0,
        });
      } else if (error instanceof RechazoRegla) {
        this.logger.log({
          evento: 'reserva_rechazada',
          codigo: error.codigo,
          canchaId: solicitud.canchaId,
          duracionMs: Date.now() - t0,
        });
      }
      throw error;
    }
  }

  private async crearSinRegistro(
    jugadorId: string,
    solicitud: SolicitudCrearReserva,
  ): Promise<ResultadoCrearReserva> {
    // Una sola lectura del reloj por solicitud: las reglas y el INSERT usan el mismo "ahora".
    const ahora = this.reloj.ahora();

    const canchaConSede = await this.catalogo.obtenerCanchaConSede(solicitud.canchaId);
    if (!canchaConSede) {
      throw new CanchaNoEncontrada();
    }
    const { cancha, sede } = canchaConSede;
    const franja = aFranjaUtc(solicitud, sede.zonaHoraria);
    validarFranja({
      ...franja,
      duracionMinutos: solicitud.duracionMinutos,
      apertura: sede.apertura,
      cierre: sede.cierre,
      ahora,
    });

    const resultado = await conReintentoPorInterbloqueo(() =>
      enTransaccion(async (cliente) => {
        await this.reservas.bloquearJugador(cliente, jugadorId);
        const existente = await this.reservas.buscarReintento(cliente, {
          jugadorId,
          canchaId: cancha.id,
          inicio: franja.inicio,
          fin: franja.fin,
          ahora,
        });
        if (existente) {
          return { reserva: existente, creada: false };
        }
        const expiradas = await this.reservas.materializarExpiradas(cliente, {
          canchaId: cancha.id,
          jugadorId,
          ahora,
        });
        if (expiradas > 0) {
          this.logger.log({
            evento: 'reservas_expiradas_materializadas',
            canchaId: cancha.id,
            cantidad: expiradas,
          });
        }
        validarLimitePendientes(await this.reservas.contarPendientesVigentes(cliente, jugadorId, ahora));
        const nueva = crearReservaNueva({
          id: randomUUID(),
          canchaId: cancha.id,
          jugadorId,
          inicio: franja.inicio,
          fin: franja.fin,
          valorCop: calcularValor(cancha.tarifaPorHoraCop, solicitud.duracionMinutos),
          ahora,
        });
        // Si se solapa con una reserva vigente, insertar() lanza FranjaNoDisponible (23P01).
        return { reserva: await this.reservas.insertar(cliente, nueva), creada: true };
      }),
    );

    return { ...resultado, zonaHoraria: sede.zonaHoraria };
  }
}
