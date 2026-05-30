'use client';

import React, { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import Link from 'next/link';
import { Calendar, CalendarDays, ShoppingBag, Users, BarChart3, Package, Settings, Image, Scissors, UserCog, Clock, ReceiptText } from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('admin');

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('admin_user') || '{}');
      if (stored.role) setRole(stored.role);
    } catch { /* ignore */ }

    adminApi().dashboard()
      .then((d) => setData(d as Record<string, unknown>))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  );

  const stats = [
    { label: 'Citas hoy', value: data?.appointmentsToday, icon: Calendar, color: 'bg-amber-100 text-gold-600' },
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
          {([
            { href: '/admin/calendario',    label: 'Calendario',   icon: CalendarDays, bg: 'bg-amber-50',    text: 'text-gold-600',    border: 'border-amber-100',   roles: ['super_admin','admin','estilista'] },
            { href: '/admin/citas',         label: 'Citas',         icon: Calendar,    bg: 'bg-amber-50',    text: 'text-gold-600',    border: 'border-amber-100',   roles: ['super_admin','admin','estilista'] },
            { href: '/admin/horarios',      label: 'Horarios',      icon: Clock,       bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-100',  roles: ['super_admin','admin','estilista'] },
            { href: '/admin/clientes',      label: 'Clientes',      icon: Users,       bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-100',    roles: ['super_admin','admin'] },
            { href: '/admin/pedidos',       label: 'Pedidos',       icon: ShoppingBag, bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-100',  roles: ['super_admin','admin'] },
            { href: '/admin/pagos',         label: 'Adelantos',     icon: ReceiptText, bg: 'bg-pink-50',    text: 'text-pink-600',    border: 'border-pink-100',    roles: ['super_admin','admin'] },
            { href: '/admin/contabilidad',  label: 'Contabilidad',  icon: BarChart3,   bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', roles: ['super_admin','admin'] },
            { href: '/admin/servicios',     label: 'Servicios',     icon: Scissors,    bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100',  roles: ['super_admin','admin'] },
            { href: '/admin/paquetes',      label: 'Paquetes',      icon: Package,     bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-100',    roles: ['super_admin','admin'] },
            { href: '/admin/catalogos',     label: 'Catálogos',     icon: Image,       bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-100',    roles: ['super_admin','admin'] },
            { href: '/admin/productos',     label: 'Productos',     icon: Package,     bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100',   roles: ['super_admin','admin'] },
            { href: '/admin/estilistas',    label: 'Estilistas',    icon: UserCog,     bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-100',    roles: ['super_admin','admin'] },
            { href: '/admin/galeria',       label: 'Galería',       icon: Image,       bg: 'bg-amber-50',   text: 'text-gold-600',    border: 'border-amber-100',   roles: ['super_admin','admin'] },
            { href: '/admin/configuracion', label: 'Config.',       icon: Settings,    bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200',    roles: ['super_admin','admin'] },
            { href: '/admin/usuarios',      label: 'Usuarios',      icon: UserCog,     bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-100',  roles: ['super_admin'] },
          ] as { href: string; label: string; icon: React.ElementType; bg: string; text: string; border: string; roles: string[] }[])
            .filter(t => t.roles.includes(role))
            .map(({ href, label, icon: Icon, bg, text, border }) => (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-2 p-4 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-shadow ${border}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${text}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </Link>
            ))}
        </div>

        {/* Próximas citas */}
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
