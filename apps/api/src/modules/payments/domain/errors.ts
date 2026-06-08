// Errores de dominio del módulo de pagos. El error handler HTTP los traduce a su
// status vía shared/http/traducirError.

import { ErrorDominio } from '../../../shared/domain/ErrorDominio';

export class PedidoNoEncontradoError extends ErrorDominio {
  readonly codigo = 'pedido_no_encontrado';
  readonly status = 404;
}

export class PedidoYaPagadoError extends ErrorDominio {
  readonly codigo = 'pedido_ya_pagado';
  readonly status = 409;
}

export class PedidoCanceladoError extends ErrorDominio {
  readonly codigo = 'pedido_cancelado';
  readonly status = 400;
}

export class EmailNoCoincideError extends ErrorDominio {
  readonly codigo = 'email_no_coincide';
  readonly status = 400;
}

export class MontoMinimoError extends ErrorDominio {
  readonly codigo = 'monto_minimo';
  readonly status = 400;
}

export class PagoRechazadoError extends ErrorDominio {
  readonly codigo = 'pago_rechazado';
  readonly status = 402;
}
