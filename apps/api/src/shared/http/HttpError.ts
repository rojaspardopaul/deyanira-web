// Superficie tipada de errores HTTP para el código nuevo (TS).
//
// La implementación canónica vive en lib/errors.js (JS) para resolución nativa
// (legacy + tests). Aquí re-exportamos con tipos para autocompletado y seguridad.

export interface HttpErrorLike extends Error {
  status: number;
  code?: string;
  expose: boolean;
  meta?: unknown;
}

type ConstructorHttpError = new (
  status: number,
  code: string | undefined,
  message: string,
  meta?: unknown,
) => HttpErrorLike;

interface ModuloErrores {
  HttpError: ConstructorHttpError;
  BadRequest: (msg: string, code?: string) => HttpErrorLike;
  Unauthorized: (msg?: string) => HttpErrorLike;
  Forbidden: (msg?: string) => HttpErrorLike;
  NotFound: (msg?: string) => HttpErrorLike;
  Conflict: (msg: string, code?: string) => HttpErrorLike;
  TooMany: (msg?: string) => HttpErrorLike;
  PaymentReq: (msg: string, code?: string) => HttpErrorLike;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const errores = require('../../lib/errors') as ModuloErrores;

export const HttpError = errores.HttpError;
export const BadRequest = errores.BadRequest;
export const Unauthorized = errores.Unauthorized;
export const Forbidden = errores.Forbidden;
export const NotFound = errores.NotFound;
export const Conflict = errores.Conflict;
export const TooMany = errores.TooMany;
export const PaymentReq = errores.PaymentReq;
