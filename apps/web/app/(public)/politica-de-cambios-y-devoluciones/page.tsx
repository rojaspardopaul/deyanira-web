import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { LegalContent } from '@/components/legal/LegalContent';
import { DEFAULT_RETURNS } from '@/lib/legal';

export const metadata: Metadata = buildMetadata({
  title: 'Política de Cambios y Devoluciones',
  description: 'Condiciones de cambios, devoluciones, cancelaciones y reprogramaciones en Deyanira Makeup Beauty.',
  path: '/politica-de-cambios-y-devoluciones',
});

export default async function DevolucionesPage() {
  const s = (await api.settings.public().catch(() => ({}))) as { returnsPolicyMd?: string | null };
  const md = s?.returnsPolicyMd && String(s.returnsPolicyMd).trim() ? String(s.returnsPolicyMd) : DEFAULT_RETURNS;
  return <LegalContent markdown={md} fallbackTitle="Política de Cambios y Devoluciones" />;
}
