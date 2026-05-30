'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl mb-5">⚠️</p>
      <h2 className="font-display text-3xl font-bold text-gray-900 mb-3">Algo salió mal</h2>
      <p className="text-gray-500 mb-8 max-w-md leading-relaxed">
        Ocurrió un error inesperado. Si el problema persiste, escríbenos por WhatsApp y te ayudamos.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={reset}
          className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-500 transition-colors"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/"
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
