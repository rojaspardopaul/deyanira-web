'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ShoppingCart } from 'lucide-react';

const NAV_LINKS = [
  { href: '/servicios', label: 'Servicios' },
  { href: '/tienda', label: 'Tienda' },
  { href: '/galeria', label: 'Galería' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/contacto', label: 'Contacto' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-display font-bold text-xl text-primary-700">
          Deyanira<span className="text-gold-500"> Beauty</span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-gray-600 hover:text-primary-600 font-medium transition-colors text-sm"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Acciones */}
        <div className="flex items-center gap-3">
          <Link href="/tienda" className="hidden md:flex items-center gap-1 text-gray-600 hover:text-primary-600">
            <ShoppingCart className="w-5 h-5" />
          </Link>
          <Link href="/reservar" className="hidden md:flex btn-primary text-sm px-5 py-2">
            Reservar cita
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-gray-600"
            aria-label="Menú"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Nav mobile */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-6 flex flex-col gap-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-gray-700 font-medium text-lg"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/reservar"
            className="btn-primary mt-2 text-center"
            onClick={() => setOpen(false)}
          >
            Reservar cita
          </Link>
        </div>
      )}
    </header>
  );
}
