import { SimpleMarkdown } from '@/components/ui/SimpleMarkdown';

// Vista de una página legal: extrae el "# Título" (H1) del markdown como
// encabezado de la página y renderiza el resto con SimpleMarkdown (que soporta
// ##/###, listas, negrita, blockquote). Si el markdown no trae H1, usa el título
// de respaldo.
export function LegalContent({ markdown, fallbackTitle }: { markdown: string; fallbackTitle: string }) {
  let title = fallbackTitle;
  let body = markdown || '';
  const m = body.match(/^\s*#\s+(.+?)\s*\r?\n([\s\S]*)$/);
  if (m) {
    title = m[1];
    body = m[2];
  }
  return (
    <div className="min-h-screen pt-24 pb-20 px-4" style={{ background: '#FCFAF7' }}>
      <article className="max-w-3xl mx-auto text-gray-700">
        <h1 className="font-display font-bold text-3xl md:text-4xl text-gray-900 mb-6">{title}</h1>
        <SimpleMarkdown className="text-[15px] md:text-base text-gray-600">{body}</SimpleMarkdown>
      </article>
    </div>
  );
}
