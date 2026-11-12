import { Inject, Injectable } from '@nestjs/common';
import { CatalogoRepository } from '../../catalogo/catalogo.repository';
import { RELOJ, type Reloj } from '../../compartido/reloj';
import { ReservaNoEncontrada } from '../dominio/errores';
import { conEstadoEfectivo, type Reserva } from '../dominio/reserva';
import { ReservasRepository } from '../infraestructura/reservas.repository';

@Injectable()
export class ObtenerReservaService {
  constructor(
    @Inject(ReservasRepository) private readonly reservas: ReservasRepository,
    @Inject(CatalogoRepository) private readonly catalogo: CatalogoRepository,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /** La reserva del jugador con su estado efectivo; 404 si no existe o es de otro jugador. */
  async obtener(jugadorId: string, id: string): Promise<{ reserva: Reserva; zonaHoraria: string }> {
    const reserva = await this.reservas.obtenerPorId(id);
    if (!reserva || reserva.jugadorId !== jugadorId) {
      throw new ReservaNoEncontrada();
    }
    const canchaConSede = await this.catalogo.obtenerCanchaConSede(reserva.canchaId);
    return {
      reserva: conEstadoEfectivo(reserva, this.reloj.ahora()),
      zonaHoraria: canchaConSede?.sede.zonaHoraria ?? 'America/Bogota',
    };
  }
}
