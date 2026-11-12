import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'packages/contracts/src/schema.ts',
      '**/*.js',
      '**/*.mjs',
      'frontend/next-env.d.ts',
    ],
  },
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    // El dominio no conoce NestJS ni la base de datos (Principio III).
    files: ['backend/src/reservas/dominio/**/*.ts'],
    ignores: ['backend/src/reservas/dominio/franja.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nestjs/*'], message: 'El dominio no puede depender de NestJS.' },
            { group: ['pg'], message: 'El dominio no puede depender de la base de datos.' },
            { group: ['luxon'], message: 'Solo franja.ts usa luxon dentro del dominio.' },
          ],
        },
      ],
    },
  },
  {
    files: ['backend/src/reservas/dominio/franja.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nestjs/*'], message: 'El dominio no puede depender de NestJS.' },
            { group: ['pg'], message: 'El dominio no puede depender de la base de datos.' },
          ],
        },
      ],
    },
  },
);
