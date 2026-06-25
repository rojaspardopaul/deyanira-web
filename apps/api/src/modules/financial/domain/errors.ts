// Errores de dominio del módulo financiero. Extienden ErrorDominio → el handler
// HTTP los traduce a su status en un único punto (traducirError).

import { ErrorDominio } from '../../../shared/domain/ErrorDominio';

export class MovimientoNoEncontradoError extends ErrorDominio {
  readonly codigo = 'movimiento_no_encontrado';
  readonly status = 404;
}

export class MovimientoAnuladoError extends ErrorDominio {
  readonly codigo = 'movimiento_anulado';
  readonly status = 409;
}

export class MontoInvalidoError extends ErrorDominio {
  readonly codigo = 'monto_invalido';
  readonly status = 400;
}

export class DatosMovimientoInvalidosError extends ErrorDominio {
  readonly codigo = 'datos_invalidos';
  readonly status = 400;
}

export class CuentaNoEncontradaError extends ErrorDominio {
  readonly codigo = 'cuenta_no_encontrada';
  readonly status = 404;
}

export class IANoDisponibleError extends ErrorDominio {
  readonly codigo = 'ia_no_disponible';
  readonly status = 503;
}

export class IAErrorError extends ErrorDominio {
  readonly codigo = 'ia_error';
  readonly status = 502;
}
