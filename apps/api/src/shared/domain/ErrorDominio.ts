// Base marcadora de errores de negocio.
//
// NO es un framework: es una clase mínima para que (1) los casos de uso lancen
// errores semánticos del dominio y (2) el error handler HTTP los mapee a HttpError
// en UN solo punto (status/code), eliminando los `err.status = 409` dispersos.
//
// Cada módulo define sus errores extendiendo esta clase, p. ej.:
//   export class CitaNoDisponibleError extends ErrorDominio {
//     readonly codigo = 'cita_no_disponible';
//     readonly status = 409;
//   }

export abstract class ErrorDominio extends Error {
  /** Código estable, legible por máquina (snake_case). */
  abstract readonly codigo: string;
  /** Status HTTP semántico que el handler usará al traducir el error. */
  abstract readonly status: number;

  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** Type guard para el error handler HTTP. */
export function esErrorDominio(err: unknown): err is ErrorDominio {
  return err instanceof ErrorDominio;
}
