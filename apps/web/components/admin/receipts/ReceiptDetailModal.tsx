'use client';

import { useState } from 'react';
import { X, Download, Mail, Ban, Plus, Loader2, Check } from 'lucide-react';
import DateTimePicker from '@/components/ui/datetime';
import { adminApi } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import type { Receipt } from '@/features/receipts/api/receipts.api';
import { STATUS_UI, METHODS, METHOD_LABEL, money, fmtDate } from './labels';

export default function ReceiptDetailModal({
  receipt: initial,
  onClose,
  onChanged,
}: {
  receipt: Receipt;
  onClose: () => void;
  onChanged: (r: Receipt) => void;
}) {
  const [receipt, setReceipt] = useState<Receipt>(initial);
  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<(typeof METHODS)[number]>('cash');
  const [payDate, setPayDate] = useState<string | null>(null);
  const [payNote, setPayNote] = useState('');
  const [busy, setBusy] = useState<'' | 'pay' | 'pdf' | 'email' | 'cancel'>('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const st = STATUS_UI[receipt.status] || STATUS_UI.pending;
  const canPay = receipt.status !== 'paid' && receipt.status !== 'cancelled' && receipt.balancePen > 0;
  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100';

  function update(r: Receipt) { setReceipt(r); onChanged(r); }

  async function addPayment() {
    setMsg(null);
    const amount = Number(payAmount) || 0;
    if (amount <= 0) { setMsg({ kind: 'err', text: 'Ingresa un monto válido' }); return; }
    if (amount > receipt.balancePen) { setMsg({ kind: 'err', text: `El monto excede el saldo (${money(receipt.balancePen)})` }); return; }
    setBusy('pay');
    try {
      const r = await adminApi().receipts.addPayment(receipt.id, {
        amountPen: amount, method: payMethod, paidAt: payDate, note: payNote.trim() || null,
      });
      update(r);
      setShowPay(false); setPayAmount(''); setPayNote(''); setPayDate(null);
      setMsg({ kind: 'ok', text: 'Pago registrado' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'No se pudo registrar el pago' });
    } finally { setBusy(''); }
  }

  async function downloadPdf() {
    setBusy('pdf'); setMsg(null);
    try {
      const blob = await adminApi().receipts.pdfBlob(receipt.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'No se pudo generar el PDF' });
    } finally { setBusy(''); }
  }

  async function sendEmail() {
    if (!receipt.customerEmail) return;
    if (!(await confirmAction({
      title: '¿Enviar el recibo por correo?',
      message: `Se enviará el recibo ${receipt.receiptNumber} a ${receipt.customerEmail} con el PDF adjunto.`,
    }))) return;
    setBusy('email'); setMsg(null);
    try {
      await adminApi().receipts.sendEmail(receipt.id);
      setMsg({ kind: 'ok', text: `Recibo enviado a ${receipt.customerEmail}` });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'No se pudo enviar el correo' });
    } finally { setBusy(''); }
  }

  async function cancelReceipt() {
    if (!(await confirmAction({
      title: '¿Anular este recibo?',
      message: `El recibo ${receipt.receiptNumber} quedará anulado. Esta acción no se puede deshacer.`,
      danger: true,
    }))) return;
    setBusy('cancel'); setMsg(null);
    try {
      const r = await adminApi().receipts.cancel(receipt.id);
      update(r);
      setMsg({ kind: 'ok', text: 'Recibo anulado' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'No se pudo anular' });
    } finally { setBusy(''); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-100 bg-white px-5 py-4 rounded-t-3xl">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-gray-900">{receipt.receiptNumber}</h2>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{receipt.customerName}{receipt.customerPhone ? ` · ${receipt.customerPhone}` : ''}</p>
            {receipt.customerEmail && <p className="text-xs text-gray-400">{receipt.customerEmail}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Detalle</p>
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
              {receipt.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-700">{it.description}{it.qty > 1 ? ` (${it.qty} × ${money(it.unitPen)})` : ''}</span>
                  <span className="font-medium text-gray-900">{money(it.amountPen)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{money(receipt.totalPen)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Pagado</span><span className="font-semibold text-green-600">{money(receipt.paidPen)}</span></div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5"><span className="font-semibold text-gray-700">Saldo</span><span className={`font-bold ${receipt.balancePen > 0 ? 'text-amber-600' : 'text-green-600'}`}>{money(receipt.balancePen)}</span></div>
          </div>

          {/* Historial de pagos */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Historial de pagos</p>
            {receipt.payments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin pagos registrados.</p>
            ) : (
              <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
                {receipt.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-600">{fmtDate(p.paidAt)} · {METHOD_LABEL[p.method] || p.method}{p.note ? ` · ${p.note}` : ''}</span>
                    <span className="font-medium text-gray-900">{money(p.amountPen)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agregar pago */}
          {canPay && (
            showPay ? (
              <div className="rounded-xl border border-pink-200 bg-pink-50/40 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Monto</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">S/</span>
                      <input className={inputCls + ' pl-7 text-right'} value={payAmount} onChange={(e) => setPayAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Método de pago</label>
                    <select className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value as (typeof METHODS)[number])}>
                      {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                    </select>
                  </div>
                </div>
                {/* Fecha en su propia fila: el calendario necesita ancho completo para no recortarse */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha</label>
                  <DateTimePicker mode="date" value={payDate} onChange={(v) => setPayDate(v as string | null)} />
                </div>
                <input className={inputCls} value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Nota (opcional)" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowPay(false)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancelar</button>
                  <button onClick={addPayment} disabled={busy === 'pay'} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50">
                    {busy === 'pay' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Registrar pago
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowPay(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-pink-600 hover:text-pink-700">
                <Plus className="w-4 h-4" /> Agregar pago
              </button>
            )
          )}

          {msg && (
            <p className={`text-sm rounded-lg px-3 py-2 ${msg.kind === 'ok' ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>{msg.text}</p>
          )}
        </div>

        {/* Acciones */}
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-white px-5 py-3 rounded-b-3xl">
          {receipt.status !== 'cancelled' ? (
            <button onClick={cancelReceipt} disabled={busy === 'cancel'} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50">
              <Ban className="w-3.5 h-3.5" /> Anular
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={downloadPdf} disabled={busy === 'pdf'} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
              {busy === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
            </button>
            <button
              onClick={sendEmail}
              disabled={busy === 'email' || !receipt.customerEmail}
              title={receipt.customerEmail ? 'Enviar por correo' : 'El recibo no tiene correo'}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 disabled:opacity-50"
            >
              {busy === 'email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Enviar correo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
