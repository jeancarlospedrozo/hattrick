import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SolicitudAutenticada } from './jwt.guard';
import { NoAutenticado } from './no-autenticado';

/** Id del jugador autenticado (claim `sub`). Requiere `JwtGuard`. */
export const JugadorId = createParamDecorator((_dato: unknown, contexto: ExecutionContext): string => {
  const id = contexto.switchToHttp().getRequest<SolicitudAutenticada>().jugadorId;
  if (!id) {
    throw new NoAutenticado();
  }
  return id;
});
