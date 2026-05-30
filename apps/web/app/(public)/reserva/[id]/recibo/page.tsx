'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ReciboPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  function printReceipt() {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4" style={{ background: '#1a1a1a' }}>
      <div className="max-w-3xl mx-auto">
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
          <div className="rounded-2xl overflow-hidden shadow-2xl bg-white">
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title="Recibo"
              className="w-full"
              style={{ height: '1000px', border: 0 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
