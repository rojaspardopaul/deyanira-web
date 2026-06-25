// Impone las fronteras de la arquitectura modular (DDD/Clean) como check automático.
// Las reglas aplican al código NUEVO (src/modules, src/shared); el legacy (routes/,
// lib/) queda fuera de las reglas de capas hasta que se migre.
//
// Ejecutar: npm --workspace apps/api run arch

module.exports = {
  forbidden: [
    {
      name: 'sin-circulares',
      comment: 'No se permiten dependencias circulares.',
      severity: 'error',
      from: { path: '^src/(modules|shared)/' },
      to: { circular: true },
    },
    {
      name: 'dominio-sin-infra-ni-presentacion',
      comment: 'El dominio no conoce infrastructure ni presentation (regla de dependencia hacia adentro).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: '^src/modules/[^/]+/(infrastructure|presentation)/' },
    },
    {
      name: 'dominio-sin-frameworks',
      comment: 'El dominio es puro: nada de Prisma, Express, Resend ni lib/ legacy.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: '(@prisma/client|express|resend)|^src/lib/' },
    },
    {
      name: 'aplicacion-sin-infra-ni-presentacion',
      comment: 'La aplicación orquesta dominio + puertos; no importa infrastructure ni presentation.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/(infrastructure|presentation)/' },
    },
    {
      name: 'aplicacion-sin-frameworks',
      comment: 'La aplicación no importa Prisma ni Express directamente (van por puertos).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '(@prisma/client|express)' },
    },
    {
      name: 'prisma-solo-en-infra',
      comment: 'Prisma solo se importa en infrastructure/ o shared/database/.',
      severity: 'error',
      from: { path: '^src/(modules|shared)/', pathNot: '(/infrastructure/|^src/shared/database/)' },
      to: { path: '@prisma/client' },
    },
    {
      name: 'modulos-solo-via-index',
      comment: 'Encapsulación fuerte: un módulo solo importa la API pública (index) de otro, no sus internals.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/(domain|application|infrastructure|presentation)/',
        pathNot: '^src/modules/$1/',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '\\.test\\.ts$' },
  },
};
