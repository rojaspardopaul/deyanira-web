'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { Calendar, ShoppingBag, LogOut, ChevronRight, Settings } from 'lucide-react';
import { useLoading } from '@/lib/loading';

export default function MiCuentaPage() {
  const router = useRouter();
  const { wrap } = useLoading();
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [appointments, setAppointments] = useState<Record<string, unknown>[]>([]);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const supabase = createClient();
    wrap(
      supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) { router.push('/login'); return; }
        setUser(data.user as unknown as Record<string, unknown>);
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (token) {
          api.customers.me(token).catch(() => {});
          const [apts, ords] = await Promise.all([
            api.appointments.mine(token).catch(() => []),
            api.orders.mine(token).catch(() => []),
          ]);
          setAppointments(apts as Record<string, unknown>[]);
          setOrders(ords as Record<string, unknown>[]);
        }
      })
    );
  }, [router, wrap]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  if (!user) return null;

  const userData = user?.user_metadata as Record<string, unknown> | undefined;
  const name = (userData?.name as string) || (user?.email as string) || 'Cliente';
  const email = user?.email as string;

  const nextApt = appointments.find(
    (a) => (a.status === 'pending' || a.status === 'confirmed') && new Date(a.date as string) >= new Date()
  );
  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'processing');

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-24 md:pb-10">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Avatar + nombre */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-4 mb-5 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-600 font-black text-xl">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl text-gray-900">{name}</h1>
            <p className="text-gray-500 text-sm truncate">{email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Salir</span>
          </button>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
            <p className="text-3xl font-black text-primary-600 mb-1">{appointments.length}</p>
            <p className="text-xs text-gray-500 font-medium">Citas realizadas</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
            <p className="text-3xl font-black text-primary-600 mb-1">{orders.length}</p>
            <p className="text-xs text-gray-500 font-medium">Pedidos</p>
          </div>
        </div>

        {/* Próxima cita */}
        {nextApt && (
          <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-1">Próxima cita</p>
                <p className="font-bold text-gray-900">{(nextApt.service as Record<string, unknown>)?.name as string}</p>
                <p className="text-sm text-gray-600">
                  {new Date(nextApt.date as string).toLocaleDateString('es-PE', {
                    weekday: 'short', day: 'numeric', month: 'short',
                    timeZone: 'America/Lima',
                  })} · {nextApt.startTime as string}
                </p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                nextApt.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {nextApt.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
              </span>
            </div>
          </div>
        )}

        {/* Pedido pendiente */}
        {pendingOrders.length > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">Pedido en curso</p>
            <p className="font-bold text-gray-900">#{(pendingOrders[0].id as string).slice(-6).toUpperCase()}</p>
            <p className="text-sm text-gray-600">
              S/ {Number(pendingOrders[0].totalPen).toFixed(2)} · {pendingOrders[0].status as string}
            </p>
          </div>
        )}

        {/* Menú */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {[
            { href: '/mi-cuenta/citas', icon: Calendar, label: 'Mis citas', desc: `${appointments.length} citas` },
            { href: '/mi-cuenta/pedidos', icon: ShoppingBag, label: 'Mis pedidos', desc: `${orders.length} pedidos` },
            { href: '/mi-cuenta/perfil', icon: Settings, label: 'Mi perfil', desc: 'Editar datos y contraseña' },
            { href: '/reservar', icon: Calendar, label: 'Nueva cita', desc: 'Reservar ahora' },
          ].map(({ href, icon: Icon, label, desc }, i, arr) => (
            <Link key={href} href={href}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>
          ))}
        </div>

        <Link href="/tienda"
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 border border-gray-200 rounded-2xl text-sm font-medium text-gray-600 hover:border-primary-300 hover:text-primary-600 transition-colors bg-white">
          <ShoppingBag className="w-4 h-4" /> Ver tienda
        </Link>
      </div>
    </div>
  );
}
