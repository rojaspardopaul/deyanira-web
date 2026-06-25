// Errores de dominio del módulo de pedidos. El error handler HTTP los traduce a su
// status vía shared/http/traducirError.

import { ErrorDominio } from '../../../shared/domain/ErrorDominio';

export class ProductoNoDisponibleError extends ErrorDominio {
  readonly codigo = 'producto_no_disponible';
  readonly status = 400;
}

export class StockInsuficienteError extends ErrorDominio {
  readonly codigo = 'stock_insuficiente';
  readonly status = 409;
}

export class CuponInvalidoError extends ErrorDominio {
  readonly codigo = 'cupon_invalido';
  readonly status = 400;
}

export class CuponSinUsosError extends ErrorDominio {
  readonly codigo = 'cupon_sin_usos';
  readonly status = 409;
}

export class DemasiadosPedidosPendientesError extends ErrorDominio {
  readonly codigo = 'demasiados_pedidos_pendientes';
  readonly status = 409;
}

export class PedidoNoEncontradoError extends ErrorDominio {
  readonly codigo = 'pedido_no_encontrado';
  readonly status = 404;
}
