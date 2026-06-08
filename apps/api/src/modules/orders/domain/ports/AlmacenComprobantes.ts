// Puerto de almacenamiento de comprobantes de pago. La implementación sube la
// imagen (data URL base64) a Cloudinary.

export interface AlmacenComprobantes {
  /** Sube el comprobante y devuelve la URL pública. */
  subir(imagenDataUrl: string): Promise<string>;
}
