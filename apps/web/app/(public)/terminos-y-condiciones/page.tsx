import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { LegalContent } from '@/components/legal/LegalContent';
import { DEFAULT_TERMS } from '@/lib/legal';

export const metadata: Metadata = buildMetadata({
  title: 'Términos y Condiciones',
  description: 'Términos y condiciones de uso de Deyanira Makeup Beauty: servicios, reservas, pagos y más.',
  path: '/terminos-y-condiciones',
});

export default async function TerminosPage() {
  const s = (await api.settings.public().catch(() => ({}))) as { termsMd?: string | null };
  const md = s?.termsMd && String(s.termsMd).trim() ? String(s.termsMd) : DEFAULT_TERMS;
  return <LegalContent markdown={md} fallbackTitle="Términos y Condiciones" />;
}
