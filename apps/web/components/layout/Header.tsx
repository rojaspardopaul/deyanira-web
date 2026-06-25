'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, ShoppingBag, User, CalendarCheck, LogOut, Settings } from 'lucide-react';
import { useSalonSettings } from '@/lib/useSalonSettings';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { href: '/servicios', label: 'Servicios' },
  { href: '/tienda',   label: 'Tienda' },
  { href: '/galeria',  label: 'Galería' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/contacto', label: 'Contacto' },
];

type AuthUser = { name: string; email: string; initial: string } | null;

export default function Header() {
  const [open, setOpen]           = useState(false);
  const [scrolled, setScrolled]   = useState(false);
  const [authUser, setAuthUser]   = useState<AuthUser>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname    = usePathname();
  const router      = useRouter();
  const isHome      = pathname === '/';
  const salonSettings = useSalonSettings();
  // Tienda visible salvo que esté explícitamente deshabilitada en Configuración.
  const showStore = salonSettings?.storeEnabled !== false;
  const navLinks = NAV_LINKS.filter((l) => l.href !== '/tienda' || showStore);

  if (pathname.startsWith('/admin')) return null;

  // Auth state
  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente';
        setAuthUser({ name, email: user.email || '', initial: name.charAt(0).toUpperCase() });
      } else {
        setAuthUser(null);
      }
    }

    loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        const name = u.user_metadata?.name || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Cliente';
        setAuthUser({ name, email: u.email || '', initial: name.charAt(0).toUpperCase() });
      } else {
        setAuthUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setOpen(false); setDropdownOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthUser(null);
    setDropdownOpen(false);
    router.push('/');
    router.refresh();
  }

  const transparent = isHome && !scrolled && !open;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
          transparent
            ? 'bg-transparent border-b border-white/0'
            : 'border-b border-white/10'
        }`}
        style={transparent ? {} : {
          background: 'rgba(15,15,15,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src={salonSettings?.logoDarkUrl || '/logo-dark.png'}
              alt={salonSettings?.salonName || 'Deyanira Makeup Beauty'}
              width={0}
              height={0}
              sizes="200px"
              style={{ width: 'auto', height: '3.5rem' }}
              className="object-contain transition-all duration-300 group-hover:scale-105"
              priority
              unoptimized
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative text-sm font-medium transition-colors duration-200 pb-0.5 group"
                  style={{ color: isActive ? '#FF4FA2' : 'rgba(255,255,255,0.7)' }}
                >
                  {label}
                  <span
                    className="absolute -bottom-0.5 left-0 h-px rounded-full transition-all duration-300"
                    style={{
                      background: 'linear-gradient(90deg, #FF4FA2, #D4AF37)',
                      width: isActive ? '100%' : '0%',
                    }}
                  />
                  <span
                    className="absolute -bottom-0.5 left-0 h-px rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:w-full"
                    style={{ background: 'linear-gradient(90deg, #FF4FA2, #D4AF37)', width: '0%' }}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-1">
            {showStore && (
              <Link href="/tienda"
                className="p-2 rounded-xl transition-all duration-200 text-white/60 hover:text-white hover:bg-white/8"
                aria-label="Tienda">
                <ShoppingBag className="w-5 h-5" />
              </Link>
            )}

            {/* User avatar / login */}
            {authUser ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className="ml-1 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/30"
                  style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: '0 2px 10px rgba(255,79,162,0.4)' }}
                  aria-label="Menú de usuario"
                  aria-expanded={dropdownOpen}
                >
                  {authUser.initial}
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)' }}>
                          {authUser.initial}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{authUser.name}</p>
                          <p className="text-xs text-gray-500 truncate">{authUser.email}</p>
                        </div>
                      </div>
                    </div>
                    {/* Links */}
                    <div className="py-1">
                      <Link href="/mi-cuenta"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <User className="w-4 h-4 text-gray-400" />
                        Mi cuenta
                      </Link>
                      <Link href="/mi-cuenta/perfil"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <Settings className="w-4 h-4 text-gray-400" />
                        Mi perfil
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <LogOut className="w-4 h-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login"
                className="p-2 rounded-xl transition-all duration-200 text-white/60 hover:text-white hover:bg-white/8"
                aria-label="Iniciar sesión">
                <User className="w-5 h-5" />
              </Link>
            )}

            <Link href="/reservar"
              className="ml-3 inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-semibold rounded-full text-sm transition-all duration-200 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: '0 4px 20px rgba(255,79,162,0.4)' }}>
              <CalendarCheck className="w-4 h-4" />
              Reservar cita
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(v => !v)}
            className="md:hidden p-2 -mr-1 rounded-xl transition-colors text-white/80 hover:bg-white/10"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile slide-down menu */}
        <div
          className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
            open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-3 py-3 space-y-1"
            style={{ background: 'rgba(15,15,15,0.97)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Mobile user section */}
            {authUser ? (
              <div className="flex items-center gap-3 px-4 py-3 mb-1 rounded-xl" style={{ background: 'rgba(255,79,162,0.08)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)' }}>
                  {authUser.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{authUser.name}</p>
                  <p className="text-xs text-white/50 truncate">{authUser.email}</p>
                </div>
              </div>
            ) : (
              <Link href="/login"
                className="flex items-center justify-between px-4 py-3.5 rounded-xl font-medium text-base text-white/70 hover:bg-white/5 transition-colors">
                <span className="flex items-center gap-2"><User className="w-4 h-4" /> Iniciar sesión</span>
              </Link>
            )}

            {navLinks.map(({ href, label }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl font-medium text-base transition-all duration-200"
                  style={{
                    color: isActive ? '#FF4FA2' : 'rgba(255,255,255,0.7)',
                    background: isActive ? 'rgba(255,79,162,0.08)' : 'transparent',
                  }}
                >
                  {label}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF4FA2' }} />
                  )}
                </Link>
              );
            })}

            {authUser && (
              <>
                <Link href="/mi-cuenta"
                  className="flex items-center gap-2 px-4 py-3.5 rounded-xl font-medium text-base text-white/70 hover:bg-white/5 transition-colors">
                  <User className="w-4 h-4" /> Mi cuenta
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3.5 rounded-xl font-medium text-base text-red-400 hover:bg-red-900/20 transition-colors">
                  <LogOut className="w-4 h-4" /> Cerrar sesión
                </button>
              </>
            )}

            <div className="pt-2 pb-1 px-1">
              <Link href="/reservar"
                className="flex items-center justify-center gap-2 w-full py-3.5 text-white font-bold rounded-2xl text-base transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #FF4FA2, #e6368a)', boxShadow: '0 4px 20px rgba(255,79,162,0.4)' }}>
                <CalendarCheck className="w-5 h-5" />
                Reservar cita
              </Link>
            </div>
          </div>
        </div>
      </header>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
