import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { NoAutenticado } from '../../auth/no-autenticado';
import {
  CanchaNoEncontrada,
  ErrorDominio,
  FranjaNoDisponible,
  RechazoRegla,
  ReservaExpirada,
  ReservaNoEncontrada,
  SolicitudInvalida,
} from '../dominio/errores';

interface RespuestaHttp {
  status(codigo: number): RespuestaHttp;
  json(cuerpo: unknown): void;
}

function estadoDe(error: ErrorDominio): number {
  if (error instanceof SolicitudInvalida) return 400;
  if (error instanceof NoAutenticado) return 401;
  if (error instanceof CanchaNoEncontrada || error instanceof ReservaNoEncontrada) return 404;
  if (error instanceof FranjaNoDisponible || error instanceof ReservaExpirada) return 409;
  if (error instanceof RechazoRegla) return 422;
  return 500;
}

/** Traduce los errores a `{ codigo, mensaje }` con el estado HTTP del contrato. */
@Catch()
export class ErroresFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErroresFilter');

  catch(error: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<RespuestaHttp>();

    if (error instanceof ErrorDominio) {
      respuesta.status(estadoDe(error)).json({ codigo: error.codigo, mensaje: error.mensaje });
      return;
    }

    // JSON mal formado (body-parser).
    const conTipo = error as { type?: unknown; status?: unknown };
    if (conTipo?.type === 'entity.parse.failed' || conTipo?.status === 400) {
      respuesta.status(400).json({ codigo: 'SOLICITUD_INVALIDA', mensaje: 'El cuerpo no es un JSON válido' });
      return;
    }

    if (error instanceof HttpException) {
      const estado = error.getStatus();
      if (
        estado === 400 &&
        error.cause &&
        (error.cause as { type?: unknown }).type === 'entity.parse.failed'
      ) {
        respuesta
          .status(400)
          .json({ codigo: 'SOLICITUD_INVALIDA', mensaje: 'El cuerpo no es un JSON válido' });
        return;
      }
      respuesta.status(estado).json({
        codigo: estado === 404 ? 'RUTA_NO_ENCONTRADA' : estado === 400 ? 'SOLICITUD_INVALIDA' : 'ERROR_HTTP',
        mensaje: error.message,
      });
      return;
    }

    this.logger.error('Error inesperado', (error as Error)?.stack ?? String(error));
    respuesta.status(500).json({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado' });
  }
}
