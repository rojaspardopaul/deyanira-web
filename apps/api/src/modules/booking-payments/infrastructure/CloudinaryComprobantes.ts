// Adaptador de almacenamiento de comprobantes de adelanto. Reutiliza
// lib/cloudinary.uploadImage (carpeta deposit-proofs).

import type { AlmacenComprobantes } from '../domain/ports/AlmacenComprobantes';

/* eslint-disable @typescript-eslint/no-var-requires */
const { uploadImage } = require('../../../lib/cloudinary') as {
  uploadImage: (image: string, folder: string) => Promise<{ url: string }>;
};

export class CloudinaryComprobantes implements AlmacenComprobantes {
  async subir(imagenDataUrl: string): Promise<string> {
    const { url } = await uploadImage(imagenDataUrl, 'deposit-proofs');
    return url;
  }
}
