// Errores de dominio del módulo de adelantos (booking-payments). Extienden
// ErrorDominio → el handler HTTP los traduce a su status en un único punto.

import { ErrorDominio } from '../../../shared/domain/ErrorDominio';

export class AdelantoNoEncontradoError extends ErrorDominio {
  readonly codigo = 'adelanto_no_encontrado';
  readonly status = 404;
}

export class AdelantoYaPagadoError extends ErrorDominio {
  readonly codigo = 'adelanto_ya_pagado';
  readonly status = 409;
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

export class ReciboNoDisponibleError extends ErrorDominio {
  readonly codigo = 'recibo_no_disponible';
  readonly status = 400;
}

export class SolicitudAdelantoInvalidaError extends ErrorDominio {
  readonly codigo = 'solicitud_invalida';
  readonly status = 400;
}
