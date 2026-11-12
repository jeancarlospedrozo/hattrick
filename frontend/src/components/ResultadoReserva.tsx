'use client';

import type { Reserva } from '@reservas/contracts';
import { horaLocal, pesos } from '../lib/formato';

const ETIQUETA_ESTADO: Record<Reserva['estado'], string> = {
  pendiente_pago: 'Pendiente de pago',
  confirmada: 'Confirmada',
  expirada: 'La reserva expiró; la franja quedó libre',
};

interface Props {
  reserva: Reserva | null;
  error: string | null;
}

export function ResultadoReserva({ reserva, error }: Props) {
  if (error) {
    return (
      <p role="alert" data-testid="error-reserva" style={{ color: '#b91c1c', marginTop: 16 }}>
        {error}
      </p>
    );
  }
  if (!reserva) return null;

  const zona = reserva.zonaHoraria;
  return (
    <section
      data-testid="resultado-reserva"
      aria-live="polite"
      style={{ marginTop: 16, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8 }}
    >
      <strong>{ETIQUETA_ESTADO[reserva.estado]}</strong>
      <p style={{ margin: '4px 0' }}>
        Franja: {horaLocal(reserva.inicio, zona)} – {horaLocal(reserva.fin, zona)}
      </p>
      {reserva.estado === 'pendiente_pago' && (
        <p style={{ margin: '4px 0' }}>Expira a las {horaLocal(reserva.expiraEn, zona)}</p>
      )}
      <p style={{ margin: '4px 0' }}>Valor: {pesos(reserva.valorCop)}</p>
    </section>
  );
}
