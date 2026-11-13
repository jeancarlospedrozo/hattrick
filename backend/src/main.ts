import './carga-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);
  app.enableCors({ origin: 'http://localhost:3000' });
  const puerto = Number(process.env.PORT ?? 3001);
  await app.listen(puerto);
}

void bootstrap();
