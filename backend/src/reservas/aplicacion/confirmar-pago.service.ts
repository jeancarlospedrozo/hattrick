import { Inject, Injectable, Logger } from '@nestjs/common';
import { RELOJ, type Reloj } from '../../compartido/reloj';
import { enTransaccion } from '../../db/pool';
import { ReservaExpirada, ReservaNoEncontrada } from '../dominio/errores';
import { confirmarPago, type Reserva } from '../dominio/reserva';
import { ReservasRepository } from '../infraestructura/reservas.repository';

type ResultadoPago = { resultado: 'confirmada'; reserva: Reserva } | { resultado: 'expirada' };

/**
 * Confirmación de pago (FR-008). La usará en proceso el futuro módulo de pagos; no tiene endpoint HTTP.
 */
@Injectable()
export class ConfirmarPagoService {
  private readonly logger = new Logger('Reservas');

  constructor(
    @Inject(ReservasRepository) private readonly reservas: ReservasRepository,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  async confirmar(reservaId: string): Promise<Reserva> {
    const ahora = this.reloj.ahora();
    // La transacción devuelve un resultado en lugar de lanzar el error, para que el cambio a
    // "expirada" se confirme (COMMIT). El error se lanza fuera de la transacción.
    const pago = await enTransaccion<ResultadoPago>(async (cliente) => {
      const reserva = await this.reservas.obtenerParaActualizar(cliente, reservaId);
      if (!reserva) {
        throw new ReservaNoEncontrada();
      }
      try {
        const confirmada = confirmarPago(reserva, ahora);
        await this.reservas.guardarEstado(cliente, reserva.id, confirmada.estado, confirmada.confirmadaEn);
        return { resultado: 'confirmada', reserva: confirmada };
      } catch (error) {
        if (!(error instanceof ReservaExpirada)) throw error;
        await this.reservas.guardarEstado(cliente, reserva.id, 'expirada', null);
        return { resultado: 'expirada' };
      }
    });

    if (pago.resultado === 'expirada') {
      this.logger.log({ evento: 'pago_rechazado_expirada', reservaId });
      throw new ReservaExpirada();
    }
    this.logger.log({ evento: 'pago_confirmado', reservaId });
    return pago.reserva;
  }
}
