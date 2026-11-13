import { Global, Module } from '@nestjs/common';
import { CatalogoRepository } from './catalogo.repository';

@Global()
@Module({
  providers: [CatalogoRepository],
  exports: [CatalogoRepository],
})
export class CatalogoModule {}
