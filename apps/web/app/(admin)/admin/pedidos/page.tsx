'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import Link from 'next/link';
import { ChevronLeft, ShoppingBag } from 'lucide-react';
import { ConfirmModal, type ConfirmDialogConfig } from '@/components/ui/ConfirmModal';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 20;

const STATUS_MAP = {
  pending:    { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'Procesando', color: 'bg-blue-100 text-blue-700' },
  shipped:    { label: 'Enviado',    color: 'bg-indigo-100 text-indigo-700' },
  delivered:  { label: 'Entregado',  color: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelado',  color: 'bg-red-100 text-red-500' },
};

const PAY_MAP: Record<string, string> = {
  pending: 'Pago pendiente',
  awaiting_verification: 'Comprobante por verificar',
  paid: 'Pagado',
  failed: 'Fallido',
};

type Order = Record<string, unknown>;

export default function AdminPedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const data = await adminApi(token).orders.listPaged({ page, pageSize: PAGE_SIZE, status: statusFilter || undefined });
      setOrders(data.items as Order[]);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setOrders([]); setTotalPages(1); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  // Reinicia a la página 1 al cambiar el filtro de estado.
  useEffect(() => { setPage(1); }, [statusFilter]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    load(token);
  }, [router, load]);

  async function doUpdateStatus(id: string, status: string) {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    setUpdating(id);
    try {
      await adminApi(token).orders.update(id, { status });
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setUpdating(null);
    }
  }

  function askStatus(id: string, status: string, orderNum: string) {
    const isCancelling = status === 'cancelled';
    setConfirmDialog({
      title: isCancelling ? 'Cancelar pedido' : `Avanzar pedido ${orderNum}`,
      message: isCancelling
        ? `¿Cancelar el pedido ${orderNum}? Esta acción no se puede deshacer.`
        : `¿Cambiar el estado del pedido ${orderNum}?`,
      confirmLabel: isCancelling ? 'Sí, cancelar' : 'Sí, avanzar',
      confirmClass: isCancelling ? 'bg-red-600 hover:bg-red-500' : 'bg-primary-600 hover:bg-primary-500',
      onConfirm: () => doUpdateStatus(id, status),
    });
  }

  const nextStatus: Record<string, string> = {
    pending: 'processing',
    processing: 'shipped',
    shipped: 'delivered',
  };

  const nextLabel: Record<string, string> = {
    pending: 'Procesar',
    processing: 'Marcar enviado',
    shipped: 'Marcar entregado',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {confirmDialog && <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-500 hover:text-primary-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold text-2xl text-gray-900">Pedidos</h1>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 shadow-sm flex flex-wrap gap-3 items-center">
          <label className="text-xs font-semibold text-gray-500">Estado:</label>
          <div className="flex flex-wrap gap-2">
            {[['', 'Todos'], ...Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  statusFilter === val
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No hay pedidos para este filtro</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const s = STATUS_MAP[order.status as keyof typeof STATUS_MAP] || { label: order.status as string, color: 'bg-gray-100 text-gray-500' };
              const items = (order.items as Record<string, unknown>[]) || [];
              const canAdvance = order.status !== 'delivered' && order.status !== 'cancelled';

              return (
                <div key={order.id as string} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">
                        #{(order.id as string).slice(-6).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.createdAt as string).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${s.color}`}>{s.label}</span>
                      {order.paymentStatus != null && (
                        <span className={`text-xs font-medium ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
                          {PAY_MAP[order.paymentStatus as string] ?? String(order.paymentStatus ?? '')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cliente + dirección */}
                  <div className="text-xs text-gray-500 mb-2">
                    <span className="font-medium text-gray-700">{String(order.shipName ?? '')}</span>
                    {order.shipPhone != null && <span> · {String(order.shipPhone)}</span>}
                    {order.shipAddress != null && (
                      <span> · {String(order.shipAddress)}, {String(order.shipDistrict ?? '')}</span>
                    )}
                  </div>

                  {/* Items */}
                  <div className="mb-3 space-y-0.5">
                    {items.slice(0, 3).map((item, i) => (
                      <p key={i} className="text-xs text-gray-600">
                        {String(item.name ?? '')} ×{Number(item.qty)} — S/ {(Number(item.pricePen) * Number(item.qty)).toFixed(2)}
                      </p>
                    ))}
                    {items.length > 3 && (
                      <p className="text-xs text-gray-400">+{items.length - 3} más</p>
                    )}
                  </div>

                  {/* Comprobante de pago (Yape/Plin) */}
                  {order.proofImageUrl != null && String(order.proofImageUrl) !== '' && (
                    <a
                      href={String(order.proofImageUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-purple-700 hover:text-purple-900"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={String(order.proofImageUrl)}
                        alt="Comprobante"
                        className="w-12 h-12 object-cover rounded-lg border border-purple-200"
                      />
                      Ver comprobante de pago
                    </a>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="font-black text-gray-900">S/ {Number(order.totalPen).toFixed(2)}</span>
                    <div className="flex gap-2">
                      {canAdvance && nextStatus[order.status as string] && (
                        <button
                          onClick={() => askStatus(order.id as string, nextStatus[order.status as string], `#${(order.id as string).slice(-6).toUpperCase()}`)}
                          disabled={updating === order.id}
                          className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-semibold hover:bg-primary-100 transition-colors disabled:opacity-50"
                        >
                          {nextLabel[order.status as string]}
                        </button>
                      )}
                      {(order.status === 'pending' || order.status === 'processing') && (
                        <button
                          onClick={() => askStatus(order.id as string, 'cancelled', `#${(order.id as string).slice(-6).toUpperCase()}`)}
                          disabled={updating === order.id}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && orders.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
            className="mt-5"
          />
        )}
      </div>
    </div>
  );
}
