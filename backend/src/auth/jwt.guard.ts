import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { CLAVE_MENSAJE_NO_AUTENTICADO, NoAutenticado } from './no-autenticado';

export interface SolicitudAutenticada {
  headers: Record<string, string | string[] | undefined>;
  jugadorId?: string;
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica `Authorization: Bearer <jwt>` (HS256, AUTH_JWT_SECRET). El claim `sub` es el id del
 * jugador (research R7). Sin token válido → 401 NO_AUTENTICADO (FR-001, Principio VI), con el
 * mensaje que fije `@MensajeNoAutenticado` en el endpoint.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(contexto: ExecutionContext): boolean {
    const solicitud = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    const mensaje = this.reflector.getAllAndOverride<string | undefined>(CLAVE_MENSAJE_NO_AUTENTICADO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    const cabecera = solicitud.headers.authorization;
    if (typeof cabecera !== 'string' || !cabecera.startsWith('Bearer ')) {
      throw new NoAutenticado(mensaje);
    }
    let sub: unknown;
    try {
      sub = this.jwt.verify<{ sub?: unknown }>(cabecera.slice('Bearer '.length), {
        algorithms: ['HS256'],
      }).sub;
    } catch {
      throw new NoAutenticado(mensaje);
    }
    if (typeof sub !== 'string' || !RE_UUID.test(sub)) {
      throw new NoAutenticado(mensaje);
    }
    solicitud.jugadorId = sub.toLowerCase();
    return true;
  }
}
