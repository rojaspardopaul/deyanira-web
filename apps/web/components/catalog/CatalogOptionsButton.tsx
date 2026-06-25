'use client';

import { useState, type SyntheticEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Info } from 'lucide-react';

// Ícono compacto "Ver opciones del catálogo" (con tooltip) para mostrar AL LADO del
// nombre de un servicio que tiene catálogo asociado. Abre el CatalogPreviewModal.
//
// Se renderiza como <span role="button"> (no <button>/<a>) porque suele vivir DENTRO
// de un <button> (wizard) o un <Link> (tarjeta de /servicios): así evita anidar
// elementos interactivos. El modal se monta vía portal en document.body para no
// quedar atrapado dentro de esos contenedores.

const CatalogPreviewModal = dynamic(
  () => import('@/components/catalog/CatalogPreviewModal').then((m) => m.CatalogPreviewModal),
  { ssr: false },
);

export default function CatalogOptionsButton({
  slug,
  accent = '#C9A030',
  tone = 'light',
}: {
  slug: string;
  accent?: string;
  tone?: 'light' | 'dark';
}) {
  const [open, setOpen] = useState(false);

  const activate = (e: SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') activate(e);
  };

  const style = tone === 'dark'
    ? { background: 'rgba(232,192,64,0.18)', color: '#E8C040' }
    : { background: `${accent}22`, color: accent };

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={onKey}
        title="Ver opciones del catálogo"
        aria-label="Ver opciones del catálogo"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 cursor-pointer align-middle transition-transform hover:scale-110"
        style={style}
      >
        <Info className="w-3 h-3" />
      </span>
      {open && typeof document !== 'undefined' && createPortal(
        <CatalogPreviewModal slug={slug} accent={accent} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  );
}
