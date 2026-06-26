'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Calendar, Users, Scissors, Package,
  ShoppingBag, Clock, Image, DollarSign, Settings, LogOut,
  Sparkles, Menu, X, UserCog, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ReceiptText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { adminAuth } from '@/lib/api';
import { useSidebarToggle } from '@/components/calendar/hooks/useSidebarToggle';
import { ConfirmHost } from '@/lib/confirm';

type AdminUser = { id: string; name: string; email: string; role: string; staffId: string | null };

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Rutas que también marcan este ítem como activo (p. ej. el cluster de Imágenes). */
  match?: string[];
};
type NavGroup = { label: string | null; items: NavItem[] };

// Grupos ordenados de más a menos importante. `label: null` = ítems sueltos (sin
// encabezado, no colapsables). "Imágenes" es una sola entrada → abre las pestañas
// Catálogos/Galería/Marca y portada.
const NAV_SUPER_ADMIN: NavGroup[] = [
  { label: null, items: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  ] },
  { label: 'Agenda', items: [
    { href: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
    { href: '/admin/citas', label: 'Citas', icon: Calendar },
    { href: '/admin/horarios', label: 'Horarios', icon: Clock },
  ] },
  { label: 'Personas', items: [
    { href: '/admin/clientes', label: 'Clientes', icon: Users },
    { href: '/admin/estilistas', label: 'Estilistas', icon: Scissors },
  ] },
  { label: 'Ventas', items: [
    { href: '/admin/servicios', label: 'Servicios', icon: Scissors },
    { href: '/admin/paquetes', label: 'Paquetes', icon: Package },
    { href: '/admin/productos', label: 'Productos', icon: Package },
    { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  ] },
  { label: null, items: [
    { href: '/admin/galeria', label: 'Imágenes', icon: Image, match: ['/admin/catalogos', '/admin/galeria', '/admin/imagenes'] },
  ] },
  { label: 'Finanzas', items: [
    { href: '/admin/contabilidad', label: 'Contabilidad', icon: DollarSign },
    { href: '/admin/recibos', label: 'Recibos', icon: ReceiptText },
  ] },
  { label: 'Sistema', items: [
    { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
    { href: '/admin/usuarios', label: 'Usuarios', icon: UserCog },
  ] },
];

// Admin = igual pero sin "Usuarios".
const NAV_ADMIN: NavGroup[] = NAV_SUPER_ADMIN.map((g) => ({
  ...g,
  items: g.items.filter((i) => i.href !== '/admin/usuarios'),
})).filter((g) => g.items.length > 0);

const NAV_ESTILISTA: NavGroup[] = [
  { label: null, items: [
    { href: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
    { href: '/admin/citas', label: 'Mis citas', icon: Calendar },
    { href: '/admin/horarios', label: 'Mi horario', icon: Clock },
  ] },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  estilista: 'Estilista',
};

const GROUPS_STORAGE_KEY = 'admin_nav_groups';

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.match) return item.match.some((m) => pathname.startsWith(m));
  return pathname.startsWith(item.href);
}

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-gold-600" />
      </div>
      {!collapsed && (
        <span className="font-bold italic text-base text-gray-900 tracking-tight whitespace-nowrap">
          Deyanira <span className="text-gold-600">Admin</span>
        </span>
      )}
    </div>
  );
}

function NavItemLink({
  item, collapsed, onClose,
}: {
  item: NavItem;
  collapsed: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const isActive = isItemActive(pathname || '', item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-colors
        ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'}
        ${isActive ? 'bg-amber-50 text-gold-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-gold-600' : 'text-gray-400'}`} />
      {!collapsed && item.label}
    </Link>
  );
}

function NavGroups({
  nav, collapsed, openGroups, onToggleGroup, onClose,
}: {
  nav: NavGroup[];
  collapsed: boolean;
  openGroups: Record<string, boolean>;
  onToggleGroup: (label: string) => void;
  onClose?: () => void;
}) {
  return (
    <>
      {nav.map((group, gi) => {
        const items = group.items.map((item) => (
          <NavItemLink key={item.href} item={item} collapsed={collapsed} onClose={onClose} />
        ));

        // Ítems sueltos (sin encabezado).
        if (!group.label) {
          return (
            <div key={`g-${gi}`} className={`space-y-0.5 ${gi > 0 && collapsed ? 'pt-1 mt-1 border-t border-gray-100' : ''}`}>
              {items}
            </div>
          );
        }

        // Colapsado (icon-only): sin encabezado, separador entre grupos.
        if (collapsed) {
          return (
            <div key={group.label} className="space-y-0.5 pt-1 mt-1 border-t border-gray-100">
              {items}
            </div>
          );
        }

        // Grupo con encabezado colapsable.
        const open = openGroups[group.label] !== false;
        return (
          <div key={group.label} className="pt-1">
            <button
              type="button"
              onClick={() => onToggleGroup(group.label!)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
              aria-expanded={open}
            >
              <span>{group.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
            </button>
            {open && <div className="space-y-0.5">{items}</div>}
          </div>
        );
      })}
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isMd, setIsMd] = useState(true); // default true to avoid SSR flash on desktop
  const { collapsed, toggle } = useSidebarToggle();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GROUPS_STORAGE_KEY);
      if (raw) setOpenGroups(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: prev[label] === false ? true : false };
      try { window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsMd(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMd(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (pathname === '/admin/login') return;
    let cancelled = false;

    adminAuth.me()
      .then(({ admin }) => {
        if (cancelled) return;
        setAdminUser(admin);
        try {
          // No sobrescribir admin_token: es el JWT Bearer real guardado al iniciar
          // sesión (se usa para auth cross-dominio). Solo refrescamos el usuario.
          window.localStorage.setItem('admin_user', JSON.stringify(admin));
        } catch { /* ignore */ }
        if (admin.role === 'estilista') {
          const allowed = ['/admin/calendario', '/admin/citas', '/admin/horarios'];
          if (!allowed.some(p => pathname.startsWith(p))) {
            router.replace('/admin/calendario');
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        try {
          window.localStorage.removeItem('admin_token');
          window.localStorage.removeItem('admin_user');
        } catch { /* ignore */ }
        router.replace(`/admin/login${pathname && pathname !== '/admin' ? `?next=${encodeURIComponent(pathname)}` : ''}`);
      });

    const onExpired = () => {
      router.replace(`/admin/login${pathname ? `?next=${encodeURIComponent(pathname)}` : ''}`);
    };
    window.addEventListener('admin:session-expired', onExpired);

    return () => {
      cancelled = true;
      window.removeEventListener('admin:session-expired', onExpired);
    };
  }, [pathname, router]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function logout() {
    try { await adminAuth.logout(); } catch { /* ignore */ }
    try {
      window.localStorage.removeItem('admin_token');
      window.localStorage.removeItem('admin_user');
    } catch { /* ignore */ }
    setAdminUser(null);
    router.replace('/admin/login');
  }

  if (pathname === '/admin/login') return <>{children}</>;

  if (!adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Verificando sesión...</p>
      </div>
    );
  }

  const nav = adminUser.role === 'super_admin'
    ? NAV_SUPER_ADMIN
    : adminUser.role === 'estilista'
    ? NAV_ESTILISTA
    : NAV_ADMIN;

  const sidebarWidth = collapsed ? 60 : 240;

  const UserFooter = () => (
    <div className={`pb-2 ${collapsed ? 'px-1' : 'px-3'}`}>
      {!collapsed && (
        <div className="px-3 py-2 rounded-xl bg-gray-50 mb-1">
          <p className="text-xs font-semibold text-gray-900 truncate">{adminUser.name}</p>
          <p className="text-[11px] text-gray-500 truncate">{ROLE_LABELS[adminUser.role] || adminUser.role}</p>
        </div>
      )}
      <button
        onClick={logout}
        title={collapsed ? 'Cerrar sesión' : undefined}
        className={`flex items-center gap-3 w-full rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors
          ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'}`}
      >
        <LogOut className="w-4 h-4 shrink-0" />
        {!collapsed && 'Cerrar sesión'}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col shrink-0 min-h-screen border-r border-gray-200 bg-white fixed top-0 left-0 bottom-0 transition-all duration-200 overflow-hidden z-30"
        style={{ width: sidebarWidth }}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between border-b border-gray-100 px-3 shrink-0">
          <Logo collapsed={collapsed} />
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors shrink-0"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft className="w-4 h-4" />
            }
          </button>
        </div>

        {/* Nav links */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${collapsed ? 'px-1' : 'px-2'}`}>
          <NavGroups nav={nav} collapsed={collapsed} openGroups={openGroups} onToggleGroup={toggleGroup} />
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100">
          <UserFooter />
        </div>
      </aside>

      {/* Main content — shifts right with sidebar */}
      <div
        className="flex-1 min-w-0 flex flex-col transition-all duration-200"
        style={{ marginLeft: isMd ? sidebarWidth : 0 }}
      >
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b border-gray-200 bg-white">
          <Logo collapsed={false} />
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl"
            aria-label="Menú admin"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-2xl">
              <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
                <Logo collapsed={false} />
                <button onClick={() => setMobileOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl" aria-label="Cerrar menú">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
                <NavGroups nav={nav} collapsed={false} openGroups={openGroups} onToggleGroup={toggleGroup} onClose={() => setMobileOpen(false)} />
              </nav>
              <div className="border-t border-gray-100 px-3 pb-2">
                <div className="px-3 py-2 rounded-xl bg-gray-50 mb-1">
                  <p className="text-xs font-semibold text-gray-900 truncate">{adminUser.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{ROLE_LABELS[adminUser.role] || adminUser.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}

        <main className="flex-1">
          {children}
        </main>
      </div>

      {/* Host de confirmaciones estilizadas (regla de oro) — una sola instancia */}
      <ConfirmHost />
    </div>
  );
}
