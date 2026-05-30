'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { ShoppingBag, ChevronLeft, Package } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'Procesando',  color: 'bg-blue-100 text-blue-700' },
  shipped:    { label: 'Enviado',     color: 'bg-indigo-100 text-indigo-700' },
  delivered:  { label: 'Entregado',   color: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelado',   color: 'bg-red-100 text-red-600' },
};

const PAY_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pago pendiente', color: 'text-orange-600' },
  paid:    { label: 'Pagado',         color: 'text-green-600' },
  failed:  { label: 'Pago fallido',   color: 'text-red-600' },
};

export default function MisPedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) {
        const ords = await api.orders.mine(token).catch(() => []);
        setOrders(ords as Record<string, unknown>[]);
      }
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-24 md:pb-10">
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/mi-cuenta" className="text-gray-500 hover:text-primary-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold text-xl text-gray-900">Mis pedidos</h1>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Todavía no has realizado pedidos</p>
            <Link href="/tienda"
              className="inline-flex items-center gap-2 bg-primary-600 text-white font-semibold px-6 py-3 rounded-full text-sm hover:bg-primary-500 transition-all"
              style={{ boxShadow: '0 4px 20px rgba(219,39,119,0.35)' }}
            >
              Ir a la tienda
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusInfo = STATUS_MAP[order.status as string] || { label: order.status as string, color: 'bg-gray-100 text-gray-600' };
              const payInfo = PAY_MAP[order.paymentStatus as string] || { label: order.paymentStatus as string, color: 'text-gray-600' };
              const items = (order.items as Record<string, unknown>[]) || [];

              return (
                <div key={order.id as string} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-sm text-gray-900">
                        Pedido #{(order.id as string).slice(-6).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.createdAt as string).toLocaleDateString('es-PE', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Productos */}
                  <div className="space-y-1.5 mb-3">
                    {items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate">{String(item.name ?? '')} ×{Number(item.qty)}</span>
                        <span className="text-gray-900 font-medium shrink-0 ml-2">
                          S/ {(Number(item.pricePen) * Number(item.qty)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <span className="font-black text-gray-900">S/ {Number(order.totalPen).toFixed(2)}</span>
                      <span className={`ml-2 text-xs font-medium ${payInfo.color}`}>{payInfo.label}</span>
                    </div>
                    {order.paymentMethod != null && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Package className="w-3.5 h-3.5" />
                        {String(order.paymentMethod) === 'culqi' ? 'Tarjeta' : 'Yape'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link href="/tienda"
          className="mt-6 flex items-center justify-center gap-2 w-full py-3 border border-gray-200 rounded-2xl text-sm font-medium text-gray-600 hover:border-primary-300 hover:text-primary-600 transition-colors bg-white"
        >
          <ShoppingBag className="w-4 h-4" /> Seguir comprando
        </Link>
      </div>
    </div>
  );
}
