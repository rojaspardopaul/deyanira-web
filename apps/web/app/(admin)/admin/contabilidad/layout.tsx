'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, Wallet, ScanLine } from 'lucide-react';

const TABS = [
  { href: '/admin/contabilidad', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/contabilidad/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/admin/contabilidad/conciliacion', label: 'Conciliación', icon: ScanLine },
  { href: '/admin/contabilidad/cuentas', label: 'Cuentas', icon: Wallet },
  // IA Contable oculta: Gemini no tiene capa gratuita en Perú (free tier = 0).
  // La página /admin/contabilidad/ia sigue existiendo por si se habilita con otro proveedor.
];

export default function ContabilidadLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-24">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Centro Financiero</h1>
            <p className="text-gray-500 text-sm mt-1">Ingresos, egresos y rentabilidad del salón</p>
          </div>
        </div>

        {/* Sub-navegación */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
          {TABS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
}
