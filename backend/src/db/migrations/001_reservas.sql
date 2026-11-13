-- Feature 001-crear-reserva. Ver specs/001-crear-reserva/data-model.md.
-- Todas las fechas en timestamptz (UTC) e intervalos semiabiertos [inicio, fin) (Principio II).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Tabla mínima: la ampliará la feature de sedes.
CREATE TABLE sedes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL CHECK (nombre <> ''),
  zona_horaria text NOT NULL DEFAULT 'America/Bogota',
  apertura     time NOT NULL,
  cierre       time NOT NULL,
  CHECK (cierre > apertura)
);

-- Tabla mínima: la ampliará la feature de canchas.
CREATE TABLE canchas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id             uuid NOT NULL REFERENCES sedes(id),
  nombre              text NOT NULL CHECK (nombre <> ''),
  tarifa_por_hora_cop integer NOT NULL CHECK (tarifa_por_hora_cop > 0),
  UNIQUE (sede_id, nombre)
);

CREATE TABLE reservas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id     uuid NOT NULL REFERENCES canchas(id),
  -- Único dato personal (FR-017). Sin FK: la tabla de jugadores es de la feature de autenticación.
  jugador_id    uuid NOT NULL,
  inicio        timestamptz NOT NULL,
  fin           timestamptz NOT NULL,
  estado        text NOT NULL CHECK (estado IN ('pendiente_pago', 'confirmada', 'expirada')),
  valor_cop     integer NOT NULL CHECK (valor_cop >= 0),
  creada_en     timestamptz NOT NULL,
  expira_en     timestamptz NOT NULL,
  confirmada_en timestamptz NULL,
  CHECK (fin > inicio),
  CHECK (expira_en > creada_en),
  -- Principio I (NO NEGOCIABLE): ninguna reserva vigente puede solaparse con otra en la misma cancha.
  CONSTRAINT reservas_sin_solapamiento EXCLUDE USING gist (
    cancha_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  ) WHERE (estado IN ('pendiente_pago', 'confirmada'))
);

-- Conteo rápido de pendientes por jugador (RN3).
CREATE INDEX reservas_pendientes_jugador ON reservas (jugador_id) WHERE estado = 'pendiente_pago';
