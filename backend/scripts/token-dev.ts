import { JwtService } from '@nestjs/jwt';
import { cargarEnv, requerirEnv } from '../src/config';

// Uso: npm run token:dev -w backend -- <uuid-jugador>
cargarEnv();
const jugadorId = process.argv[2];
if (!jugadorId) {
  console.error('Uso: npm run token:dev -w backend -- <uuid-jugador>');
  process.exit(1);
}
const jwt = new JwtService({ secret: requerirEnv('AUTH_JWT_SECRET') });
console.log(jwt.sign({ sub: jugadorId }, { algorithm: 'HS256', expiresIn: '24h' }));
