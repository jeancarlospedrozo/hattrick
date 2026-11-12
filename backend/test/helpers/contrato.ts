import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

/**
 * Valida respuestas reales contra contracts/openapi.yaml (Principio IV, research R8).
 */
interface Operacion {
  operationId?: string;
  responses?: Record<string, { $ref?: string; content?: Record<string, { schema?: unknown }> }>;
}

interface Spec {
  paths: Record<string, Record<string, Operacion>>;
  components: { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> } & Record<
    string,
    unknown
  >;
}

const spec = parse(readFileSync(resolve(__dirname, '../../../contracts/openapi.yaml'), 'utf8')) as Spec;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'openapi.json', components: spec.components });

function esquemaDeRespuesta(operationId: string, estado: number): unknown {
  for (const metodos of Object.values(spec.paths)) {
    for (const op of Object.values(metodos)) {
      if (op.operationId !== operationId) continue;
      let respuesta = op.responses?.[String(estado)];
      if (!respuesta) {
        throw new Error(`El contrato no define ${estado} para ${operationId}`);
      }
      if (respuesta.$ref) {
        const nombre = respuesta.$ref.split('/').pop() ?? '';
        respuesta = spec.components.responses?.[nombre] ?? {};
      }
      return respuesta.content?.['application/json']?.schema;
    }
  }
  throw new Error(`Operación ${operationId} no encontrada en el contrato`);
}

const cache = new Map<string, ReturnType<typeof ajv.compile>>();

export function esperarConformeAlContrato(res: { status: number; body: unknown }, operationId: string): void {
  const clave = `${operationId}:${res.status}`;
  let validar = cache.get(clave);
  if (!validar) {
    const esquema = esquemaDeRespuesta(operationId, res.status);
    const conRefs = JSON.parse(JSON.stringify(esquema).replaceAll('"#/', '"openapi.json#/'));
    validar = ajv.compile(conRefs as object);
    cache.set(clave, validar);
  }
  if (!validar(res.body)) {
    throw new Error(
      `La respuesta ${res.status} de ${operationId} no cumple el contrato: ${ajv.errorsText(validar.errors)}\n` +
        JSON.stringify(res.body, null, 2),
    );
  }
}
