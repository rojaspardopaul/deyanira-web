'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import Link from 'next/link';
import { Calendar, ShoppingBag, Users, BarChart3 } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }

    adminApi(token).dashboard()
      .then((d) => setData(d as Record<string, unknown>))
      .catch(() => { localStorage.removeItem('admin_token'); router.push('/admin/login'); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  );

  const stats = [
    { label: 'Citas hoy', value: data?.appointmentsToday, icon: Calendar, color: 'bg-pink-100 text-pink-600' },
    { label: 'Pedidos pendientes', value: data?.pendingOrders, icon: ShoppingBag, color: 'bg-orange-100 text-orange-600' },
    { label: 'Total clientes', value: data?.totalCustomers, icon: Users, color: 'bg-blue-100 text-blue-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-display font-bold mb-8">Dashboard</h1>

        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <p className="text-3xl font-bold mb-1">{value as number}</p>
              <p className="text-gray-600 text-sm">{label}</p>
            </div>
          ))}
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { href: '/admin/citas', label: 'Citas', icon: Calendar, color: 'bg-pink-50 text-pink-600 border-pink-100' },
            { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag, color: 'bg-orange-50 text-orange-600 border-orange-100' },
            { href: '/admin/clientes', label: 'Clientes', icon: Users, color: 'bg-blue-50 text-blue-600 border-blue-100' },
            { href: '/admin/contabilidad', label: 'Contabilidad', icon: BarChart3, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href}
              className={`flex flex-col items-center gap-2 p-4 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-shadow ${color.split(' ').slice(2).join(' ')}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.split(' ').slice(0, 2).join(' ')}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>

        {/* Citas próximas */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-lg mb-4">Próximas citas de hoy</h2>
          {(data?.recentAppointments as Record<string, unknown>[])?.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay citas programadas para hoy.</p>
          ) : (
            <div className="space-y-3">
              {(data?.recentAppointments as Record<string, unknown>[])?.map((apt) => (
                <div key={apt.id as string} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">{apt.guestName as string || 'Cliente'}</p>
                    <p className="text-gray-500 text-xs">
                      {(apt.service as Record<string, unknown>)?.name as string} · {apt.startTime as string}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    apt.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {apt.status as string}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
