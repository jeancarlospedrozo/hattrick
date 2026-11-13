import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { requerirEnv } from '../config';
import { JwtGuard } from './jwt.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: requerirEnv('AUTH_JWT_SECRET'),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [JwtGuard],
  exports: [JwtGuard, JwtModule],
})
export class AuthModule {}
