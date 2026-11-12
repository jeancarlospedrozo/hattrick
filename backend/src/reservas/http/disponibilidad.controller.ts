import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import type { Disponibilidad } from '@reservas/contracts';
import { ConsultarDisponibilidadService } from '../aplicacion/consultar-disponibilidad.service';
import { validarFecha } from '../dominio/franja';
import { validarUuid } from './mapeo';

/** Pública: no expone datos de jugadores (FR-018, research R7). */
@Controller('canchas/:canchaId/disponibilidad')
export class DisponibilidadController {
  constructor(
    @Inject(ConsultarDisponibilidadService) private readonly disponibilidad: ConsultarDisponibilidadService,
  ) {}

  @Get()
  consultar(@Param('canchaId') canchaId: string, @Query('fecha') fecha: unknown): Promise<Disponibilidad> {
    const fechaTexto = typeof fecha === 'string' ? fecha : '';
    validarFecha(fechaTexto);
    return this.disponibilidad.consultar(validarUuid(canchaId, 'canchaId'), fechaTexto);
  }
}
