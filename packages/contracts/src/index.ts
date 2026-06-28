// @deyanira/contracts — esquemas Zod compartidos (fuente única FE↔BE) de los
// dominios migrados. El backend valida con estos esquemas y el frontend infiere
// los tipos (z.infer) desde el mismo lugar, eliminando el drift.

export * from './regex';
export * from './appointments';
export * from './orders';
export * from './payments';
export * from './reclamaciones';
