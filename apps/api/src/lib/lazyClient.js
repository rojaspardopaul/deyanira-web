// Factory para clientes de servicios externos con inicialización perezosa.
// Centraliza el patrón repetido "crear una sola vez al primer uso" (Resend, etc.).
// El factory puede devolver `null` (servicio deshabilitado) y se cachea igual,
// evitando reintentos y logs repetidos.
//
// Uso:
//   const getResend = createLazyClient(() =>
//     env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
//   );
//   const client = getResend(); // mismo singleton en llamadas sucesivas

function createLazyClient(factory) {
  let initialized = false;
  let instance = null;
  return function get() {
    if (initialized) return instance;
    instance = factory();
    initialized = true;
    return instance;
  };
}

module.exports = { createLazyClient };
