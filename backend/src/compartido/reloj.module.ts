import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Module,
  Post,
  UseGuards,
  type DynamicModule,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { SolicitudInvalida } from '../reservas/dominio/errores';
import { RELOJ, RelojAjustable, RelojSistema, type Reloj } from './reloj';

/**
 * Solo existe con RELOJ_AJUSTABLE=1 (tests e2e). Exige JWT, como cualquier endpoint de escritura
 * (Principio VI). Nunca se activa en producción.
 */
@Controller('test/reloj')
@UseGuards(JwtGuard)
class RelojTestController {
  constructor(@Inject(RELOJ) private readonly reloj: Reloj) {}

  @Post()
  @HttpCode(200)
  ajustar(@Body() cuerpo: { fijar?: unknown; avanzarMs?: unknown }): { ahora: string } {
    if (!(this.reloj instanceof RelojAjustable)) {
      throw new SolicitudInvalida('El reloj no es ajustable');
    }
    if (typeof cuerpo?.fijar === 'string') {
      const d = new Date(cuerpo.fijar);
      if (Number.isNaN(d.getTime())) {
        throw new SolicitudInvalida('fijar debe ser una fecha ISO 8601');
      }
      this.reloj.fijar(d);
    }
    if (typeof cuerpo?.avanzarMs === 'number') {
      this.reloj.avanzar(cuerpo.avanzarMs);
    }
    return { ahora: this.reloj.ahora().toISOString() };
  }
}

@Module({})
export class RelojModule {
  static registrar(): DynamicModule {
    const ajustable = process.env.RELOJ_AJUSTABLE === '1';
    return {
      module: RelojModule,
      global: true,
      providers: [{ provide: RELOJ, useValue: ajustable ? new RelojAjustable() : new RelojSistema() }],
      controllers: ajustable ? [RelojTestController] : [],
      exports: [RELOJ],
    };
  }
}
