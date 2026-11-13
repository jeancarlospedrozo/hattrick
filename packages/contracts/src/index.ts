import type { components, paths } from './schema';

export type { components, paths, operations } from './schema';

type Schemas = components['schemas'];

export type CrearReservaRequest = Schemas['CrearReservaRequest'];
export type EstadoReserva = Schemas['EstadoReserva'];
export type Reserva = Schemas['Reserva'];
export type Disponibilidad = Schemas['Disponibilidad'];
export type Bloque = Schemas['Bloque'];
export type ErrorApi = Schemas['Error'];
export type ErrorRegla = Schemas['ErrorRegla'];
export type CodigoRegla = ErrorRegla['codigo'];

export type Paths = paths;
