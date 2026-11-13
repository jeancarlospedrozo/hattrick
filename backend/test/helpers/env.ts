import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Carga el .env de la raíz (si existe) y fija valores por defecto para los tests.
const archivoEnv = resolve(__dirname, '..', '..', '..', '.env');
if (existsSync(archivoEnv)) {
  process.loadEnvFile(archivoEnv);
}

process.env.DATABASE_URL_TEST ??= 'postgres://reservas:reservas@localhost:5432/reservas_test';
// Los tests nunca usan la base de desarrollo.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.AUTH_JWT_SECRET ??= 'secreto-de-test';
