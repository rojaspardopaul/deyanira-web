// Renderiza un subset de Markdown sin dependencias:
//   • Encabezados ## y ###
//   • Negrita **texto**
//   • Listas con guion (- item)
//   • Blockquotes (> texto)
//   • Párrafos separados por línea en blanco

import { Fragment } from 'react';

function renderInline(text: string, key: number) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Fragment key={key}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  );
}

export function SimpleMarkdown({ children, className = '' }: { children: string; className?: string }) {
  if (!children) return null;
  const lines = children.split(/\r?\n/);
  const blocks: Array<{ type: string; text: string[]; level?: number }> = [];
  let current: { type: string; text: string[]; level?: number } | null = null;

  function push() {
    if (current) {
      blocks.push(current);
      current = null;
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      push();
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      push();
      blocks.push({ type: 'heading', text: [h[2]], level: h[1].length });
      continue;
    }
    if (line.startsWith('> ')) {
      if (!current || current.type !== 'quote') {
        push();
        current = { type: 'quote', text: [] };
      }
      current.text.push(line.slice(2));
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!current || current.type !== 'list') {
        push();
        current = { type: 'list', text: [] };
      }
      current.text.push(line.replace(/^\s*[-*]\s+/, ''));
      continue;
    }
    if (!current || current.type !== 'p') {
      push();
      current = { type: 'p', text: [] };
    }
    current.text.push(line);
  }
  push();

  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          if (b.level === 2) {
            return (
              <h2 key={i} className="font-display font-bold text-2xl md:text-3xl mt-6 mb-3">
                {renderInline(b.text[0], 0)}
              </h2>
            );
          }
          return (
            <h3 key={i} className="font-poppins font-bold text-lg md:text-xl mt-5 mb-2">
              {renderInline(b.text[0], 0)}
            </h3>
          );
        }
        if (b.type === 'list') {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5 my-3">
              {b.text.map((t, j) => (
                <li key={j} className="leading-relaxed">{renderInline(t, j)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === 'quote') {
          return (
            <blockquote
              key={i}
              className="border-l-4 pl-4 py-2 my-4 italic"
              style={{ borderColor: 'rgba(232,192,64,0.5)', background: 'rgba(232,192,64,0.06)' }}
            >
              {b.text.map((t, j) => (
                <p key={j} className="leading-relaxed">{renderInline(t, j)}</p>
              ))}
            </blockquote>
          );
        }
        return (
          <p key={i} className="leading-relaxed my-3">
            {b.text.map((t, j) => (
              <Fragment key={j}>
                {renderInline(t, j)}
                {j < b.text.length - 1 ? ' ' : ''}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
