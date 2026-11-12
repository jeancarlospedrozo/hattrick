import { Injectable } from '@nestjs/common';
import { obtenerPool, type Cliente } from '../../db/pool';
import { FranjaNoDisponible } from '../dominio/errores';
import type { EstadoReserva, Reserva } from '../dominio/reserva';

interface FilaReserva {
  id: string;
  cancha_id: string;
  jugador_id: string;
  inicio: Date;
  fin: Date;
  estado: EstadoReserva;
  valor_cop: number;
  creada_en: Date;
  expira_en: Date;
  confirmada_en: Date | null;
}

const COLUMNAS =
  'id, cancha_id, jugador_id, inicio, fin, estado, valor_cop, creada_en, expira_en, confirmada_en';

function aReserva(fila: FilaReserva): Reserva {
  return {
    id: fila.id,
    canchaId: fila.cancha_id,
    jugadorId: fila.jugador_id,
    inicio: fila.inicio,
    fin: fila.fin,
    estado: fila.estado,
    valorCop: fila.valor_cop,
    creadaEn: fila.creada_en,
    expiraEn: fila.expira_en,
    confirmadaEn: fila.confirmada_en,
  };
}

/** Acceso a la tabla `reservas` con SQL parametrizado (research R6). */
@Injectable()
export class ReservasRepository {
  /** Si la franja se solapa con una reserva vigente, la restricción de exclusión responde 23P01 (FR-004). */
  async insertar(cliente: Cliente, r: Reserva): Promise<Reserva> {
    try {
      const { rows } = await cliente.query<FilaReserva>(
        `INSERT INTO reservas (${COLUMNAS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${COLUMNAS}`,
        [
          r.id,
          r.canchaId,
          r.jugadorId,
          r.inicio,
          r.fin,
          r.estado,
          r.valorCop,
          r.creadaEn,
          r.expiraEn,
          r.confirmadaEn,
        ],
      );
      return aReserva(rows[0] as FilaReserva);
    } catch (error) {
      const e = error as { code?: string; constraint?: string };
      if (e.code === '23P01' && e.constraint === 'reservas_sin_solapamiento') {
        throw new FranjaNoDisponible();
      }
      throw error;
    }
  }

  /** Reserva vigente idéntica del mismo jugador (doble envío o reintento, FR-016). */
  async buscarReintento(
    cliente: Cliente,
    datos: { jugadorId: string; canchaId: string; inicio: Date; fin: Date; ahora: Date },
  ): Promise<Reserva | null> {
    const { rows } = await cliente.query<FilaReserva>(
      `SELECT ${COLUMNAS} FROM reservas
        WHERE jugador_id = $1 AND cancha_id = $2 AND inicio = $3 AND fin = $4
          AND (estado = 'confirmada' OR (estado = 'pendiente_pago' AND expira_en > $5))
        LIMIT 1`,
      [datos.jugadorId, datos.canchaId, datos.inicio, datos.fin, datos.ahora],
    );
    return rows[0] ? aReserva(rows[0]) : null;
  }

  async obtenerPorId(id: string): Promise<Reserva | null> {
    const { rows } = await obtenerPool().query<FilaReserva>(
      `SELECT ${COLUMNAS} FROM reservas WHERE id = $1`,
      [id],
    );
    return rows[0] ? aReserva(rows[0]) : null;
  }

  /** Reservas con estado guardado vigente que se solapan con `[desde, hasta)` (usa el índice GiST). */
  async listarVigentesEnRango(canchaId: string, desde: Date, hasta: Date): Promise<Reserva[]> {
    const { rows } = await obtenerPool().query<FilaReserva>(
      `SELECT ${COLUMNAS} FROM reservas
        WHERE cancha_id = $1
          AND estado IN ('pendiente_pago', 'confirmada')
          AND tstzrange(inicio, fin, '[)') && tstzrange($2, $3, '[)')
        ORDER BY inicio`,
      [canchaId, desde, hasta],
    );
    return rows.map(aReserva);
  }

  /**
   * Marca como expiradas las pendientes vencidas de la cancha y del jugador (research R2), para que
   * dejen de bloquear la restricción de exclusión y de contar para RN3. Bloquea las filas siempre en
   * orden de `id` para que el interbloqueo entre solicitudes simultáneas sea raro.
   */
  async materializarExpiradas(
    cliente: Cliente,
    datos: { canchaId: string; jugadorId: string; ahora: Date },
  ): Promise<number> {
    const { rowCount } = await cliente.query(
      `WITH vencidas AS (
         SELECT id FROM reservas
          WHERE estado = 'pendiente_pago' AND expira_en <= $3
            AND (cancha_id = $1 OR jugador_id = $2)
          ORDER BY id
          FOR UPDATE
       )
       UPDATE reservas r SET estado = 'expirada' FROM vencidas v WHERE r.id = v.id`,
      [datos.canchaId, datos.jugadorId, datos.ahora],
    );
    return rowCount ?? 0;
  }

  async obtenerParaActualizar(cliente: Cliente, id: string): Promise<Reserva | null> {
    const { rows } = await cliente.query<FilaReserva>(
      `SELECT ${COLUMNAS} FROM reservas WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return rows[0] ? aReserva(rows[0]) : null;
  }

  async guardarEstado(
    cliente: Cliente,
    id: string,
    estado: EstadoReserva,
    confirmadaEn: Date | null,
  ): Promise<void> {
    await cliente.query('UPDATE reservas SET estado = $2, confirmada_en = $3 WHERE id = $1', [
      id,
      estado,
      confirmadaEn,
    ]);
  }

  /** Pendientes vigentes del jugador (RN3); usa el índice `reservas_pendientes_jugador`. */
  async contarPendientesVigentes(cliente: Cliente, jugadorId: string, ahora: Date): Promise<number> {
    const { rows } = await cliente.query<{ n: string }>(
      `SELECT count(*) AS n FROM reservas
        WHERE jugador_id = $1 AND estado = 'pendiente_pago' AND expira_en > $2`,
      [jugadorId, ahora],
    );
    return Number(rows[0]?.n ?? 0);
  }

  /** Bloqueo consultivo por jugador: pone en fila sus solicitudes (research R3). */
  async bloquearJugador(cliente: Cliente, jugadorId: string): Promise<void> {
    await cliente.query(`SELECT pg_advisory_xact_lock(hashtextextended('jugador:' || $1, 0))`, [jugadorId]);
  }
}
