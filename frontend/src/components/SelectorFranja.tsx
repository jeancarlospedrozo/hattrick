'use client';

import type { Disponibilidad } from '@reservas/contracts';
import { horaLocal } from '../lib/formato';

interface Props {
  disponibilidad: Disponibilidad;
  seleccion: number | null;
  duracion: number;
  enviando: boolean;
  onSeleccionar: (indice: number) => void;
  onDuracion: (minutos: number) => void;
  onReservar: () => void;
}

/**
 * Duraciones que ofrece el selector: múltiplos de 30 desde 60 (RN1) hasta el cierre de la sede.
 * Siempre se ofrece al menos 60 minutos, aunque la franja pase del cierre: el backend es la
 * autoridad y en ese caso rechaza indicando el horario de la sede (AC4, FR-009).
 */
export function duracionesPosibles(disponibilidad: Disponibilidad, seleccion: number | null): number[] {
  if (seleccion === null) return [];
  const hastaElCierre = (disponibilidad.bloques.length - seleccion) * 30;
  const max = Math.max(60, hastaElCierre);
  const opciones: number[] = [];
  for (let m = 60; m <= max; m += 30) opciones.push(m);
  return opciones;
}

export function SelectorFranja({
  disponibilidad,
  seleccion,
  duracion,
  enviando,
  onSeleccionar,
  onDuracion,
  onReservar,
}: Props) {
  const zona = disponibilidad.zonaHoraria;
  const duraciones = duracionesPosibles(disponibilidad, seleccion);

  return (
    <section aria-label="Elegir franja">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6 }}>
        {disponibilidad.bloques.map((bloque, i) => {
          const ocupada = bloque.estado === 'ocupada';
          // Los bloques pasados o a más de 14 días no se ofrecen (FR-012); el backend sigue validando.
          const deshabilitado = !bloque.reservable;
          const elegida = seleccion === i;
          return (
            <button
              key={bloque.inicio}
              type="button"
              disabled={deshabilitado}
              aria-disabled={deshabilitado}
              aria-pressed={elegida}
              onClick={() => onSeleccionar(i)}
              style={{
                padding: '8px 4px',
                borderRadius: 6,
                border: elegida ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                background: deshabilitado ? '#e2e8f0' : elegida ? '#dbeafe' : '#fff',
                color: deshabilitado ? '#64748b' : '#0f172a',
                cursor: deshabilitado ? 'not-allowed' : 'pointer',
              }}
            >
              {horaLocal(bloque.inicio, zona)}
              {ocupada ? ' · ocupada' : ''}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
        <label>
          Duración{' '}
          <select
            aria-label="Duración"
            value={duraciones.includes(duracion) ? duracion : ''}
            onChange={(e) => onDuracion(Number(e.target.value))}
            disabled={seleccion === null}
          >
            {duraciones.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onReservar}
          disabled={seleccion === null || enviando || !duraciones.includes(duracion)}
        >
          {enviando ? 'Reservando…' : 'Reservar'}
        </button>
      </div>
    </section>
  );
}
