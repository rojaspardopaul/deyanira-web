// Puerto de almacenamiento de comprobantes (Cloudinary). Devuelve la URL pública.

export interface AlmacenComprobantes {
  /** Sube una imagen (data URL) y devuelve su URL pública. */
  subir(imagenDataUrl: string): Promise<string>;
}
