import { Module } from '@nestjs/common';
import { ConfirmarPagoService } from './aplicacion/confirmar-pago.service';
import { ConsultarDisponibilidadService } from './aplicacion/consultar-disponibilidad.service';
import { CrearReservaService } from './aplicacion/crear-reserva.service';
import { ObtenerReservaService } from './aplicacion/obtener-reserva.service';
import { DisponibilidadController } from './http/disponibilidad.controller';
import { ReservasController } from './http/reservas.controller';
import { ReservasRepository } from './infraestructura/reservas.repository';

@Module({
  controllers: [ReservasController, DisponibilidadController],
  providers: [
    ReservasRepository,
    CrearReservaService,
    ObtenerReservaService,
    ConsultarDisponibilidadService,
    ConfirmarPagoService,
  ],
  // ConfirmarPagoService se exporta para el futuro módulo de pagos (llamada en proceso, sin HTTP).
  exports: [CrearReservaService, ConfirmarPagoService],
})
export class ReservasModule {}
