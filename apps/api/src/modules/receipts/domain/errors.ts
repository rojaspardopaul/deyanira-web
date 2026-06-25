// Errores de dominio del módulo de recibos. Extienden ErrorDominio → el handler
// HTTP los traduce a su status en un único punto.

import { ErrorDominio } from '../../../shared/domain/ErrorDominio';

export class ReciboNoEncontradoError extends ErrorDominio {
  readonly codigo = 'recibo_no_encontrado';
  readonly status = 404;
}

export class ReciboAnuladoError extends ErrorDominio {
  readonly codigo = 'recibo_anulado';
  readonly status = 409;
}

export class MontoInvalidoError extends ErrorDominio {
  readonly codigo = 'monto_invalido';
  readonly status = 400;
}

export class PagoExcedeSaldoError extends ErrorDominio {
  readonly codigo = 'pago_excede_saldo';
  readonly status = 400;
}

export class ReciboSinCorreoError extends ErrorDominio {
  readonly codigo = 'recibo_sin_correo';
  readonly status = 400;
}

export class SolicitudReciboInvalidaError extends ErrorDominio {
  readonly codigo = 'solicitud_invalida';
  readonly status = 400;
}
