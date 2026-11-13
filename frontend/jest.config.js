/**
 * Jest para la lógica de presentación pura del frontend (formato de hora y valor).
 * El script `test` corre con TZ=Asia/Tokyo para demostrar que las horas se muestran
 * en la zona de la sede y no en la del equipo (Principio II).
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: { module: 'Node16', moduleResolution: 'Node16', isolatedModules: true, strict: true } },
    ],
  },
};
