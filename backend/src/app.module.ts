import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { RelojModule } from './compartido/reloj.module';
import { ReservasModule } from './reservas/reservas.module';

@Module({
  imports: [AuthModule, CatalogoModule, RelojModule.registrar(), ReservasModule],
})
export class AppModule {}
