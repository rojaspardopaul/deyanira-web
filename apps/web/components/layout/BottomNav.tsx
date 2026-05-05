'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Scissors, CalendarCheck, ShoppingBag, User } from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  featured?: boolean;
  exact?: boolean;
};

const ITEMS: NavItem[] = [
  { href: '/', label: 'Inicio', icon: Home, exact: true },
  { href: '/servicios', label: 'Servicios', icon: Scissors },
  { href: '/reservar', label: 'Reservar', icon: CalendarCheck, featured: true },
  { href: '/tienda', label: 'Tienda', icon: ShoppingBag },
  { href: '/mi-cuenta', label: 'Cuenta', icon: User },
];

const HIDDEN_ON = ['/admin', '/login', '/registro'];

export default function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 px-1">
        {ITEMS.map(({ href, label, icon: Icon, featured, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);

          if (featured) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 -mt-5"
                aria-label={label}
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center
                              shadow-lg transition-transform active:scale-90
                              ${isActive
                                ? 'bg-primary-700 shadow-primary-300'
                                : 'bg-primary-600 shadow-primary-200'
                              }`}
                >
                  <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-semibold text-primary-600">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl
                          transition-colors active:bg-gray-50 min-w-[56px]
                          ${isActive ? 'text-primary-600' : 'text-gray-400'}`}
              aria-label={label}
            >
              <Icon
                className="w-6 h-6"
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
