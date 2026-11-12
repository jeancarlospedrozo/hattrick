import { Inject, Injectable } from '@nestjs/common';
import type { Disponibilidad } from '@reservas/contracts';
import { CatalogoRepository } from '../../catalogo/catalogo.repository';
import { RELOJ, type Reloj } from '../../compartido/reloj';
import { calcularBloques } from '../dominio/disponibilidad';
import { CanchaNoEncontrada } from '../dominio/errores';
import { formatearEnSede, instanteLocal, validarFecha } from '../dominio/franja';
import { ReservasRepository } from '../infraestructura/reservas.repository';

@Injectable()
export class ConsultarDisponibilidadService {
  constructor(
    @Inject(CatalogoRepository) private readonly catalogo: CatalogoRepository,
    @Inject(ReservasRepository) private readonly reservas: ReservasRepository,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /** Bloques libres y ocupados de una cancha en un día local de su sede (FR-018). */
  async consultar(canchaId: string, fecha: string): Promise<Disponibilidad> {
    validarFecha(fecha);
    const canchaConSede = await this.catalogo.obtenerCanchaConSede(canchaId);
    if (!canchaConSede) {
      throw new CanchaNoEncontrada();
    }
    const { cancha, sede } = canchaConSede;
    const desde = instanteLocal(fecha, sede.apertura, sede.zonaHoraria);
    const hasta = instanteLocal(fecha, sede.cierre, sede.zonaHoraria);
    const reservas = await this.reservas.listarVigentesEnRango(cancha.id, desde, hasta);
    const bloques = calcularBloques({
      fecha,
      zona: sede.zonaHoraria,
      apertura: sede.apertura,
      cierre: sede.cierre,
      reservas,
      ahora: this.reloj.ahora(),
    });

    return {
      canchaId: cancha.id,
      fecha,
      zonaHoraria: sede.zonaHoraria,
      apertura: sede.apertura,
      cierre: sede.cierre,
      tarifaPorHoraCop: cancha.tarifaPorHoraCop,
      bloques: bloques.map((b) => ({
        inicio: formatearEnSede(b.inicio, sede.zonaHoraria),
        fin: formatearEnSede(b.fin, sede.zonaHoraria),
        estado: b.estado,
        reservable: b.reservable,
      })),
    };
  }
}
