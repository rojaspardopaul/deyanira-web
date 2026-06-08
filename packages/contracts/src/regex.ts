// Regex compartidos (idénticos a apps/api/src/lib/validate.js) para que los
// esquemas de contrato validen igual en backend y frontend.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164 light (Perú): 7-15 dígitos, opcional '+'
export const PHONE_RE = /^\+?\d{7,15}$/;
