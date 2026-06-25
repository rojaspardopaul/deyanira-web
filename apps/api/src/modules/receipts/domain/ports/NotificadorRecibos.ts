// Puerto de notificaciones de recibos. La implementación (email + PDF adjunto)
// vive en infrastructure/.

import type { ReciboPersistido } from './ReciboRepositorio';

export interface Contacto {
  readonly email: string;
  readonly nombre: string;
}

export interface NotificadorRecibos {
  /** Envía el recibo al cliente con el PDF adjunto. */
  enviarRecibo(recibo: ReciboPersistido, pdf: Buffer, contacto: Contacto): Promise<void>;
}
