// Comando del caso de uso CrearPedido (POST /api/orders).

export interface ItemPedido {
  productId: string;
  qty: number;
}

export interface EnvioPedido {
  name: string;
  phone: string;
  email: string | null;
  address: string;
  district: string;
}

export interface UsuarioPedido {
  id: string;
}

export interface CuerpoCrearPedido {
  items: ItemPedido[];
  shipName: string;
  shipPhone: string;
  shipEmail?: string | null;
  shipAddress: string;
  shipDistrict: string;
  paymentMethod?: string | null;
  couponCode?: string | null;
}

export class CrearPedidoComando {
  private constructor(
    readonly items: ItemPedido[],
    readonly ship: EnvioPedido,
    readonly paymentMethod: string | null,
    readonly couponCode: string | null,
    readonly usuario: UsuarioPedido | null,
  ) {}

  static desdeHttp(body: CuerpoCrearPedido, usuario: UsuarioPedido | null): CrearPedidoComando {
    return new CrearPedidoComando(
      body.items,
      {
        name: body.shipName,
        phone: body.shipPhone,
        email: body.shipEmail ?? null,
        address: body.shipAddress,
        district: body.shipDistrict,
      },
      body.paymentMethod ?? null,
      body.couponCode ?? null,
      usuario,
    );
  }
}
