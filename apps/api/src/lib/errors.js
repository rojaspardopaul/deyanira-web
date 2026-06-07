// Errores tipados con código HTTP. Usar en lugar de Error nativo para
// mantener contrato consistente y evitar fugas en 5xx.
//
// NOTA (Fase 0): implementación canónica en este .js para resolución nativa
// (legacy + tests). El código nuevo en TS la consume tipada vía shared/http/HttpError.ts.

class HttpError extends Error {
  constructor(status, code, message, meta) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = status < 500;
    this.meta = meta;
  }
}

const BadRequest    = (msg, code = 'bad_request')          => new HttpError(400, code, msg);
const Unauthorized  = (msg = 'No autorizado')              => new HttpError(401, 'unauthorized', msg);
const Forbidden     = (msg = 'Sin permisos')               => new HttpError(403, 'forbidden', msg);
const NotFound      = (msg = 'No encontrado')              => new HttpError(404, 'not_found', msg);
const Conflict      = (msg, code = 'conflict')             => new HttpError(409, code, msg);
const TooMany       = (msg = 'Demasiadas solicitudes')     => new HttpError(429, 'rate_limited', msg);
const PaymentReq    = (msg, code = 'payment_required')     => new HttpError(402, code, msg);

module.exports = {
  HttpError,
  BadRequest, Unauthorized, Forbidden, NotFound,
  Conflict, TooMany, PaymentReq,
};
