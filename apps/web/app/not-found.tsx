import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-8xl font-black text-primary-100 leading-none mb-2">404</p>
      <h2 className="font-display text-3xl font-bold text-gray-900 mb-3">Página no encontrada</h2>
      <p className="text-gray-500 mb-8 max-w-md leading-relaxed">
        La página que buscas no existe o fue movida. Usa el menú para continuar navegando.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-500 transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
