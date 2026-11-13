import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';

export function tokenPara(jugadorId: string): string {
  const jwt = new JwtService({ secret: process.env.AUTH_JWT_SECRET });
  return jwt.sign({ sub: jugadorId }, { algorithm: 'HS256', expiresIn: '1h' });
}

export const nuevoJugador = (): string => randomUUID();

export const bearer = (jugadorId: string): string => `Bearer ${tokenPara(jugadorId)}`;
