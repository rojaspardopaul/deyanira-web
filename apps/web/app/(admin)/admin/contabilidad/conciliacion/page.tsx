'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Tag, Clock, HandCoins, Copy, CheckCircle2, ChevronRight } from 'lucide-react';
import { adminApi, type FinanceConciliacion, type FinanceMovement } from '@/lib/api';
import MovementTimeline from '@/components/admin/finanzas/MovementTimeline';
import MovementDetailDrawer from '@/components/admin/finanzas/MovementDetailDrawer';
import { fmt, fmtDate } from '@/components/admin/finanzas/shared';

export default function ConciliacionPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [data, setData] = useState<FinanceConciliacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<FinanceMovement | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (!t) { router.push('/admin/login'); return; }
    setToken(t);
  }, [router]);

  const load = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    try { setData(await adminApi(t).finanzas.conciliacion()); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (token) load(token); }, [token, load]);

  if (loading) return <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">Analizando inconsistencias...</div>;
  if (!data) return null;

  if (data.totalPendientes === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-800">Todo conciliado</p>
        <p className="text-sm text-gray-500 mt-1">No hay inconsistencias pendientes. Buen trabajo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-semibold text-xs">
          {data.totalPendientes}
        </span>
        elementos requieren tu atención
      </div>

      {/* Movimientos sin comprobante */}
      <Section icon={Paperclip} title="Movimientos sin comprobante" count={data.sinVoucher.count} tone="amber"
        hint="Adjunta la boleta/factura abriendo el movimiento.">
        {data.sinVoucher.count > 0 && <MovementTimeline movements={data.sinVoucher.movements} onSelect={setDetail} />}
      </Section>

      {/* Sin categoría */}
      <Section icon={Tag} title="Movimientos sin categoría" count={data.sinCategoria.count} tone="amber"
        hint="Asigna una categoría desde el detalle del movimiento.">
        {data.sinCategoria.count > 0 && <MovementTimeline movements={data.sinCategoria.movements} onSelect={setDetail} />}
      </Section>

      {/* Adelantos pendientes */}
      <Section icon={Clock} title="Adelantos pendientes de pago" count={data.adelantosPendientes.count} tone="blue"
        hint={`Total esperado: ${fmt(data.adelantosPendientes.total)}`}>
        {data.adelantosPendientes.items.map((a) => (
          <Row key={a.id} onClick={() => router.push('/admin/citas')}
            left={<><p className="text-sm font-medium text-gray-800">{a.customerName}</p>
              <p className="text-xs text-gray-400">{fmtDate(a.createdAt)} · reserva sin pagar</p></>}
            right={<span className="text-sm font-semibold text-blue-600">{fmt(a.deposit)}</span>} />
        ))}
      </Section>

      {/* Pagos incompletos / por cobrar */}
      <Section icon={HandCoins} title="Saldos por cobrar" count={data.pagosIncompletos.count} tone="blue"
        hint={`Total pendiente: ${fmt(data.pagosIncompletos.total)}`}>
        {data.pagosIncompletos.items.map((p) => (
          <Row key={p.id} onClick={() => router.push('/admin/citas')}
            left={<><p className="text-sm font-medium text-gray-800">{p.customerName}</p>
              <p className="text-xs text-gray-400">{p.receiptNumber || 'reserva con saldo'}</p></>}
            right={<span className="text-sm font-semibold text-blue-600">{fmt(p.balancePen)}</span>} />
        ))}
      </Section>

      {/* Posibles duplicados */}
      <Section icon={Copy} title="Posibles duplicados" count={data.duplicados.count} tone="red"
        hint="Mismo tipo, monto y fecha. Revisa y anula el repetido.">
        {data.duplicados.groups.map((g) => (
          <div key={g.key} className="border border-red-100 rounded-xl p-2 my-2 bg-red-50/40">
            <MovementTimeline movements={g.movements} onSelect={setDetail} />
          </div>
        ))}
      </Section>

      <MovementDetailDrawer token={token} movement={detail} onClose={() => setDetail(null)} onChanged={() => { load(token); }} />
    </div>
  );
}

const TONES: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
};

function Section({
  icon: Icon, title, count, tone, hint, children,
}: {
  icon: typeof Paperclip; title: string; count: number; tone: string; hint: string; children?: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-50">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${TONES[tone]}`}><Icon className="w-5 h-5" /></div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-gray-400">{hint}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TONES[tone]}`}>{count}</span>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

function Row({ left, right, onClick }: { left: React.ReactNode; right: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 rounded-lg px-1">
      <div className="flex-1 min-w-0">{left}</div>
      {right}
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </button>
  );
}
