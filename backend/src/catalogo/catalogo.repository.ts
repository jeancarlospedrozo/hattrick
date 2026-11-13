import { Injectable } from '@nestjs/common';
import { obtenerPool } from '../db/pool';

export interface CanchaConSede {
  cancha: { id: string; nombre: string; tarifaPorHoraCop: number };
  sede: { id: string; zonaHoraria: string; apertura: string; cierre: string };
}

interface Fila {
  id: string;
  nombre: string;
  tarifa_por_hora_cop: number;
  sede_id: string;
  zona_horaria: string;
  apertura: string;
  cierre: string;
}

/** Lectura de sedes y canchas (esta feature no las administra; research R11). */
@Injectable()
export class CatalogoRepository {
  async obtenerCanchaConSede(canchaId: string): Promise<CanchaConSede | null> {
    const { rows } = await obtenerPool().query<Fila>(
      `SELECT c.id, c.nombre, c.tarifa_por_hora_cop, s.id AS sede_id, s.zona_horaria,
              to_char(s.apertura, 'HH24:MI') AS apertura, to_char(s.cierre, 'HH24:MI') AS cierre
         FROM canchas c JOIN sedes s ON s.id = c.sede_id
        WHERE c.id = $1`,
      [canchaId],
    );
    const fila = rows[0];
    if (!fila) {
      return null;
    }
    return {
      cancha: { id: fila.id, nombre: fila.nombre, tarifaPorHoraCop: fila.tarifa_por_hora_cop },
      sede: {
        id: fila.sede_id,
        zonaHoraria: fila.zona_horaria,
        apertura: fila.apertura,
        cierre: fila.cierre,
      },
    };
  }
}
