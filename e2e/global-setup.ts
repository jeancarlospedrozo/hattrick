import { ENV_E2E } from './env';
import { ejecutarEnBackend } from './helpers';

/** Migra y siembra la base de test y vacía la tabla de reservas antes de los tests e2e. */
export default function globalSetup(): void {
  const env = { DATABASE_URL: ENV_E2E.DATABASE_URL_TEST };
  ejecutarEnBackend(['src/db/migrate.ts'], env);
  ejecutarEnBackend(['src/db/seed.ts'], env);
  ejecutarEnBackend(['scripts/truncar-test.ts'], env);
}
