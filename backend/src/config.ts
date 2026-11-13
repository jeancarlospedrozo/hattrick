import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carga el `.env` de la raíz del repositorio (si existe) con la API nativa de Node,
 * sin añadir la dependencia `dotenv` (Principio V).
 */
export function cargarEnv(): void {
  const candidatos = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')];
  for (const ruta of candidatos) {
    if (existsSync(ruta)) {
      process.loadEnvFile(ruta);
      return;
    }
  }
}

export function requerirEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }
  return valor;
}
