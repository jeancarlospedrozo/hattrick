// Principio IV: falla si src/schema.ts no coincide con lo que genera contracts/openapi.yaml.
// Regenera en un directorio temporal y compara byte a byte, sin depender de que el archivo esté en git.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contrato = resolve(raiz, '../../contracts/openapi.yaml');
const actual = join(raiz, 'src/schema.ts');
const dir = mkdtempSync(join(tmpdir(), 'contracts-check-'));
const generado = join(dir, 'schema.ts');

// Resuelve el paquete donde lo deje npm (en el workspace o elevado a la raíz del monorepo).
const cli = join(
  dirname(createRequire(import.meta.url).resolve('openapi-typescript/package.json')),
  'bin/cli.js',
);
execFileSync(process.execPath, [cli, contrato, '-o', generado], { stdio: ['ignore', 'ignore', 'inherit'] });

let iguales = false;
try {
  iguales = readFileSync(actual).equals(readFileSync(generado));
} catch {
  iguales = false;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (!iguales) {
  console.error(
    'packages/contracts/src/schema.ts no coincide con contracts/openapi.yaml. Ejecuta: npm run contracts:generate',
  );
  process.exit(1);
}
console.log('Los tipos de packages/contracts están al día con contracts/openapi.yaml.');
