import { Body, Controller, Get, Inject, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Reserva as ReservaDto } from '@reservas/contracts';
import { JwtGuard } from '../../auth/jwt.guard';
import { JugadorId } from '../../auth/jugador.decorator';
import { MENSAJES_NO_AUTENTICADO, MensajeNoAutenticado } from '../../auth/no-autenticado';
import { CrearReservaService } from '../aplicacion/crear-reserva.service';
import { ObtenerReservaService } from '../aplicacion/obtener-reserva.service';
import { aReservaDto, leerCrearReservaRequest, validarUuid } from './mapeo';

@Controller('reservas')
@UseGuards(JwtGuard)
export class ReservasController {
  constructor(
    @Inject(CrearReservaService) private readonly crearReserva: CrearReservaService,
    @Inject(ObtenerReservaService) private readonly obtenerReserva: ObtenerReservaService,
  ) {}

  /** 201 si crea la reserva; 200 si es un reintento y devuelve la existente (FR-016). */
  @Post()
  @MensajeNoAutenticado(MENSAJES_NO_AUTENTICADO.reservar)
  async crear(
    @JugadorId() jugadorId: string,
    @Body() cuerpo: unknown,
    @Res({ passthrough: true }) respuesta: { status(codigo: number): unknown },
  ): Promise<ReservaDto> {
    const solicitud = leerCrearReservaRequest(cuerpo);
    const { reserva, creada, zonaHoraria } = await this.crearReserva.crear(jugadorId, solicitud);
    respuesta.status(creada ? 201 : 200);
    return aReservaDto(reserva, zonaHoraria);
  }

  @Get(':reservaId')
  @MensajeNoAutenticado(MENSAJES_NO_AUTENTICADO.verReserva)
  async obtener(@JugadorId() jugadorId: string, @Param('reservaId') reservaId: string): Promise<ReservaDto> {
    const { reserva, zonaHoraria } = await this.obtenerReserva.obtener(
      jugadorId,
      validarUuid(reservaId, 'reservaId'),
    );
    return aReservaDto(reserva, zonaHoraria);
  }
}
