import type { INestApplication } from '@nestjs/common';
import { ErroresFilter } from './reservas/http/errores.filter';

/** Configuración común a `main.ts` y a la app de los tests. */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ErroresFilter());
}
