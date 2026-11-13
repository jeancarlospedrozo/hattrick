import { instanteLocal, seSolapan, type Intervalo } from './franja';
import { ANTELACION_MAXIMA_MS } from './reglas';
import { esVigente, type Reserva } from './reserva';

export const DURACION_BLOQUE_MS = 30 * 60 * 1000;

export interface BloqueDisponibilidad extends Intervalo {
  estado: 'libre' | 'ocupada';
  /**
   * Libre, con inicio posterior a `ahora` y a 14 × 24 h como máximo (FR-012). Es una ayuda para la
   * interfaz: la creación de la reserva vuelve a validar todas las reglas.
   */
  reservable: boolean;
}

export interface DatosDisponibilidad {
  fecha: string;
  zona: string;
  apertura: string; // HH:mm
  cierre: string; // HH:mm
  reservas: Reserva[];
  ahora: Date;
}

/**
 * Bloques de 30 minutos entre la apertura y el cierre de la sede. Un bloque está ocupado si se
 * solapa con una reserva vigente (FR-003, FR-018); los bloques pasados o a más de 14 días no son
 * reservables. El resultado no incluye datos del jugador.
 */
export function calcularBloques(datos: DatosDisponibilidad): BloqueDisponibilidad[] {
  const desde = instanteLocal(datos.fecha, datos.apertura, datos.zona).getTime();
  const hasta = instanteLocal(datos.fecha, datos.cierre, datos.zona).getTime();
  const vigentes = datos.reservas.filter((r) => esVigente(r, datos.ahora));
  const ahora = datos.ahora.getTime();

  const bloques: BloqueDisponibilidad[] = [];
  for (let t = desde; t + DURACION_BLOQUE_MS <= hasta; t += DURACION_BLOQUE_MS) {
    const bloque = { inicio: new Date(t), fin: new Date(t + DURACION_BLOQUE_MS) };
    const ocupada = vigentes.some((r) => seSolapan(bloque, r));
    const antelacion = t - ahora;
    const reservable = !ocupada && antelacion > 0 && antelacion <= ANTELACION_MAXIMA_MS;
    bloques.push({ ...bloque, estado: ocupada ? 'ocupada' : 'libre', reservable });
  }
  return bloques;
}
