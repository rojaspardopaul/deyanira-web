import { defineConfig } from 'vitest/config';

// Red de seguridad para el refactor: tests de caracterización (Fase 0) y
// tests unitarios de los casos de uso del piloto (Fase 1, con fakes de los puertos).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Forzar que el código fuente pase por el transform de Vite (resuelve .ts en
    // los require de los shims .js -> .ts). Sin esto, Node ejecuta los .js como
    // CJS nativo y no resuelve el .ts extensionless.
    server: { deps: { inline: [/[\\/]src[\\/]/] } },
  },
});
