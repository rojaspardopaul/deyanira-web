'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Printer, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ReciboPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Tamaño natural del recibo (A4) + factor de escala para que entre sin scroll horizontal.
  const [box, setBox] = useState({ w: 794, h: 1123, scale: 1 });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/booking-payments/${encodeURIComponent(id)}/receipt`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'No se pudo cargar el recibo');
        }
        return res.text();
      })
      .then((text) => { if (active) setHtml(text); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id]);

  // Mide el alto real del recibo y lo escala al ancho disponible: sin scroll interno
  // (alto = contenido) ni scroll horizontal (escala ≤ 1 cuando la pantalla es angosta).
  const fit = useCallback(() => {
    const iframe = iframeRef.current;
    const area = areaRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !area || !doc) return;
    const page = doc.querySelector('.page') as HTMLElement | null;
    const w = page?.offsetWidth || doc.body.scrollWidth || 794;
    const h = page?.offsetHeight || doc.body.scrollHeight || 1123;
    // area.clientWidth es estable (no depende de la escala) → sin bucle de medición.
    const scale = Math.min(1, area.clientWidth / w);
    setBox({ w, h, scale });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  function printReceipt() {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4" style={{ background: '#1a1a1a' }}>
      <div className="mx-auto" style={{ maxWidth: 860 }}>
        <div className="flex items-center justify-between mb-4">
          <Link href="/mi-cuenta" className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <ArrowLeft className="w-4 h-4" /> Mi cuenta
          </Link>
          {html && (
            <button onClick={printReceipt} className="btn-gold text-sm">
              <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
            </button>
          )}
        </div>

        {html && (
          <div className="flex items-center gap-2.5 mb-4 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.35)' }}>
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#22c55e' }} />
            <p className="text-sm font-medium" style={{ color: '#bbf7d0' }}>
              ¡Pago confirmado! Tu reserva quedó asegurada. También te enviamos este recibo por correo.
            </p>
          </div>
        )}

        {error && (
          <div className="text-center py-24 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-white font-semibold mb-2">{error}</p>
            <Link href="/reservar" className="text-sm" style={{ color: '#E8C040' }}>Volver</Link>
          </div>
        )}

        {!html && !error && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#E8C040' }} />
          </div>
        )}

        {html && (
          <div ref={areaRef}>
            {/* Tamaño = recibo ya escalado → sin scroll interno, sin hueco, centrado. */}
            <div
              className="rounded-2xl overflow-hidden shadow-2xl bg-white mx-auto"
              style={{ width: box.w * box.scale, height: box.h * box.scale }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={html}
                title="Recibo"
                onLoad={fit}
                scrolling="no"
                style={{
                  width: box.w,
                  height: box.h,
                  border: 0,
                  transform: `scale(${box.scale})`,
                  transformOrigin: 'top left',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
