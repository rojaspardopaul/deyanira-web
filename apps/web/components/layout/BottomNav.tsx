'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Scissors, CalendarCheck, ShoppingBag, User, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSalonSettings } from '@/lib/useSalonSettings';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  featured?: boolean;
  exact?: boolean;
};

const ITEMS: NavItem[] = [
  { href: '/',          label: 'Inicio',    icon: Home,          exact: true },
  { href: '/servicios', label: 'Servicios', icon: Scissors },
  { href: '/reservar',  label: 'Reservar',  icon: CalendarCheck, featured: true },
  { href: '/tienda',    label: 'Tienda',    icon: ShoppingBag },
  { href: '/mi-cuenta', label: 'Cuenta',    icon: User },
];

// El checkout tiene su propia barra de acción fija (total + pagar); el nav global
// sobra y, al ser ambos fixed bottom-0, se encimaban en móvil.
const HIDDEN_ON = ['/admin', '/login', '/registro', '/checkout'];

export default function BottomNav() {
  const pathname = usePathname();
  const settings = useSalonSettings();
  const items = ITEMS.filter((i) => i.href !== '/tienda' || settings?.storeEnabled !== false);
  const [initial, setInitial] = useState<string | null>(null);
  // Se oculta al deslizar hacia abajo y reaparece al deslizar hacia arriba (estilo LinkedIn).
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'U';
        setInitial(name.charAt(0).toUpperCase());
      } else {
        setInitial(null);
      }
    }

    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        const name = u.user_metadata?.name || u.user_metadata?.full_name || u.email?.split('@')[0] || 'U';
        setInitial(name.charAt(0).toUpperCase());
      } else {
        setInitial(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Mostrar/ocultar según la dirección del scroll.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y < 80) setHidden(false);              // siempre visible cerca del top
        else if (delta > 6) setHidden(true);       // bajando → ocultar
        else if (delta < -6) setHidden(false);     // subiendo → mostrar
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null;

  return (
    <>
      <div className="md:hidden pb-nav" aria-hidden="true" style={{ background: '#0A0A0A' }} />
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(212,175,55,0.15)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: hidden ? 'translateY(110%)' : 'translateY(0)',
          transition: 'transform 0.3s ease',
          willChange: 'transform',
        }}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {items.map(({ href, label, icon: Icon, featured, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            const isCuenta = href === '/mi-cuenta';

            if (featured) {
              return (
                <Link key={href} href={href} className="flex flex-col items-center gap-1 -mt-5" aria-label={label}>
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #b8962e, #D4AF37)'
                        : 'linear-gradient(135deg, #D4AF37, #f0c84a)',
                      boxShadow: '0 4px 20px rgba(212,175,55,0.5)',
                    }}
                  >
                    <Icon className="w-6 h-6" strokeWidth={2.5} style={{ color: '#ffffff' }} />
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: '#D4AF37' }}>{label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 active:scale-90 min-w-[56px] relative"
                aria-label={label}
                style={{ color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.3)' }}
              >
                {isCuenta && initial ? (
                  <div
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-white font-bold"
                    style={{
                      fontSize: '11px',
                      background: isActive
                        ? 'linear-gradient(135deg, #e6368a, #FF4FA2)'
                        : 'linear-gradient(135deg, #FF4FA2, #e6368a)',
                      boxShadow: '0 2px 8px rgba(255,79,162,0.5)',
                    }}
                  >
                    {initial}
                  </div>
                ) : (
                  <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.5 : 2} />
                )}
                <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                {isActive && (
                  <span
                    className="absolute bottom-1 w-1 h-1 rounded-full"
                    style={{ background: '#D4AF37' }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
