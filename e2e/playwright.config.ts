import { defineConfig, devices } from '@playwright/test';
import { ENV_E2E } from './env';

/**
 * Los tests e2e levantan el backend y el frontend contra la base de test,
 * con el RelojAjustable activo (RELOJ_AJUSTABLE=1) para controlar el tiempo.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  globalSetup: './global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w backend',
      cwd: '..',
      // Una fecha inválida responde 400, que Playwright acepta como "servidor listo".
      url: 'http://localhost:3001/api/canchas/00000000-0000-0000-0000-000000000000/disponibilidad?fecha=invalida',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...ENV_E2E,
        DATABASE_URL: ENV_E2E.DATABASE_URL_TEST,
        RELOJ_AJUSTABLE: '1',
        PORT: '3001',
      },
    },
    {
      command: 'npm run dev -w frontend',
      cwd: '..',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 180_000,
      env: { NEXT_PUBLIC_API_URL: 'http://localhost:3001/api' },
    },
  ],
});
