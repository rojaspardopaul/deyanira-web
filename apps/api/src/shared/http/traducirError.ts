// Traduce un ErrorDominio a HttpError en UN único punto (recomendación 10/10).
// Los casos de uso lanzan errores semánticos del negocio; la presentación los pasa
// por aquí antes de next(), y el error handler global responde con su status/code.
// Cualquier otro error se propaga tal cual.

import { HttpError } from './HttpError';
import { esErrorDominio } from '../domain/ErrorDominio';

export function traducirError(err: unknown): unknown {
  if (esErrorDominio(err)) {
    return new HttpError(err.status, err.codigo, err.message);
  }
  return err;
}
