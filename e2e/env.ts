import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(__dirname, '..');
const archivoEnv = resolve(raiz, '.env');
if (existsSync(archivoEnv)) {
  process.loadEnvFile(archivoEnv);
}

export const ENV_E2E = {
  DATABASE_URL_TEST:
    process.env.DATABASE_URL_TEST ?? 'postgres://reservas:reservas@localhost:5432/reservas_test',
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET ?? 'secreto-de-test',
};
