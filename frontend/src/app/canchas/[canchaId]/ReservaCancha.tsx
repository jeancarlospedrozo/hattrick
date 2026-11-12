'use client';

import type { Disponibilidad, Reserva } from '@reservas/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ResultadoReserva } from '../../../components/ResultadoReserva';
import { SelectorFranja } from '../../../components/SelectorFranja';
import { api } from '../../../lib/api';
import { pesos } from '../../../lib/formato';

interface Props {
  canchaId: string;
  fecha: string;
}

export function ReservaCancha({ canchaId, fecha }: Props) {
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [duracion, setDuracion] = useState(60);
  const [enviando, setEnviando] = useState(false);
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await api.consultarDisponibilidad(canchaId, fecha);
    if (r.ok) {
      setDisponibilidad(r.data);
      setErrorCarga(null);
    } else {
      setErrorCarga(r.error.mensaje);
    }
  }, [canchaId, fecha]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const reservar = async () => {
    if (!disponibilidad || seleccion === null || enviando) return;
    const bloque = disponibilidad.bloques[seleccion];
    if (!bloque) return;
    setEnviando(true);
    setError(null);
    setReserva(null);
    // La hora de inicio se envía en la hora local de la sede (FR-015): se toma del ISO con desfase de la sede.
    const horaInicio = bloque.inicio.slice(11, 16);
    const r = await api.crearReserva({ canchaId, fecha, horaInicio, duracionMinutos: duracion });
    if (r.ok) {
      setReserva(r.data);
    } else {
      setError(r.error.mensaje);
    }
    setSeleccion(null);
    setEnviando(false);
    await cargar();
  };

  if (errorCarga) return <p role="alert">{errorCarga}</p>;
  if (!disponibilidad) return <p>Cargando disponibilidad…</p>;

  return (
    <main>
      <h1 style={{ fontSize: 22 }}>Reservar cancha</h1>
      <p>
        {fecha} · Horario de la sede: {disponibilidad.apertura} a {disponibilidad.cierre} (
        {disponibilidad.zonaHoraria}) · Tarifa: {pesos(disponibilidad.tarifaPorHoraCop)} por hora
      </p>
      <SelectorFranja
        disponibilidad={disponibilidad}
        seleccion={seleccion}
        duracion={duracion}
        enviando={enviando}
        onSeleccionar={(i) => {
          setSeleccion(i);
          setDuracion(60);
        }}
        onDuracion={setDuracion}
        onReservar={() => void reservar()}
      />
      <ResultadoReserva reserva={reserva} error={error} />
    </main>
  );
}
