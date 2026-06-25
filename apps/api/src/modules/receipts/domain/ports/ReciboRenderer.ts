// Puerto: produce el HTML del recibo (con datos del salón). La implementación
// vive en infrastructure/ y carga los ajustes del salón.

import type { ReciboPersistido } from './ReciboRepositorio';

export interface ReciboRenderer {
  html(recibo: ReciboPersistido): Promise<string>;
}
