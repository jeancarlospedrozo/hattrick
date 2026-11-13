/**
 * Tres proyectos de Jest (research R9):
 * - unit: dominio puro, sin HTTP ni base de datos (Principio III).
 * - integration y contract: PostgreSQL real (DATABASE_URL_TEST); se ejecutan con --runInBand.
 *
 * Se usa jest.config.js (y no .ts) para no depender de ts-node.
 */
const base = {
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/helpers/env.ts'],
};

module.exports = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/test/unit/**/*.spec.ts'] },
    { ...base, displayName: 'integration', testMatch: ['<rootDir>/test/integration/**/*.spec.ts'] },
    { ...base, displayName: 'contract', testMatch: ['<rootDir>/test/contract/**/*.spec.ts'] },
  ],
};
