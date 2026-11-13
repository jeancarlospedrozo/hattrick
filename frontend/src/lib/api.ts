import type { CrearReservaRequest, Disponibilidad, ErrorApi, Reserva } from '@reservas/contracts';

/** Cliente HTTP tipado con los tipos generados del contrato (Principio IV). */
export type Resultado<T> =
  { ok: true; status: number; data: T } | { ok: false; status: number; error: ErrorApi };

const URL_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

function leerToken(): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

async function pedir<T>(ruta: string, init: RequestInit = {}): Promise<Resultado<T>> {
  const token = leerToken();
  const cabeceras: Record<string, string> = { Accept: 'application/json' };
  if (init.body) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_BASE}${ruta}`, { ...init, headers: { ...cabeceras, ...init.headers } });
  } catch {
    return {
      ok: false,
      status: 0,
      error: { codigo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor' },
    };
  }
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (respuesta.ok) {
    return { ok: true, status: respuesta.status, data: cuerpo as T };
  }
  const error = (cuerpo as ErrorApi | null) ?? {
    codigo: 'ERROR_HTTP',
    mensaje: 'Ocurrió un error inesperado',
  };
  return { ok: false, status: respuesta.status, error };
}

export const api = {
  consultarDisponibilidad: (canchaId: string, fecha: string) =>
    pedir<Disponibilidad>(
      `/canchas/${encodeURIComponent(canchaId)}/disponibilidad?fecha=${encodeURIComponent(fecha)}`,
    ),
  crearReserva: (solicitud: CrearReservaRequest) =>
    pedir<Reserva>('/reservas', { method: 'POST', body: JSON.stringify(solicitud) }),
  obtenerReserva: (id: string) => pedir<Reserva>(`/reservas/${encodeURIComponent(id)}`),
};
