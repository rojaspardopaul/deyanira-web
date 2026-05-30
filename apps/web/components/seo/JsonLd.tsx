// Componente server-side para inyectar JSON-LD sin riesgo de XSS.
// Usa dangerouslySetInnerHTML con `JSON.stringify` que escapa correctamente
// los caracteres especiales — pero nunca aceptes HTML del usuario aquí.

type JsonLdProps = { data: Record<string, unknown> | Record<string, unknown>[] };

export function JsonLd({ data }: JsonLdProps) {
  // Escape </script> para evitar fuga del bloque <script>
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
