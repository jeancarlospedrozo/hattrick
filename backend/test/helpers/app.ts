import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module';
import { configurarApp } from '../../src/app.setup';
import { RELOJ, RelojAjustable } from '../../src/compartido/reloj';

export interface AppDeTest {
  app: INestApplication;
  reloj: RelojAjustable;
  http: ReturnType<typeof supertest>;
  get<T>(token: unknown): T;
}

/** Fecha de referencia de los tests: martes 2026-11-10 12:00 en Bogotá. El sábado de prueba es 2026-11-14. */
export const AHORA_BASE = new Date('2026-11-10T17:00:00.000Z');
export const SABADO = '2026-11-14';

export async function crearAppDeTest(): Promise<AppDeTest> {
  const reloj = new RelojAjustable(AHORA_BASE);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RELOJ)
    .useValue(reloj)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configurarApp(app);
  await app.init();
  return {
    app,
    reloj,
    http: supertest(app.getHttpServer()),
    get: <T>(token: unknown) => app.get(token as never) as T,
  };
}
