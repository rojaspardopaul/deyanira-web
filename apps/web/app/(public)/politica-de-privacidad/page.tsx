import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import { LegalContent } from '@/components/legal/LegalContent';
import { DEFAULT_PRIVACY } from '@/lib/legal';

export const metadata: Metadata = buildMetadata({
  title: 'Política de Privacidad',
  description: 'Cómo Deyanira Makeup Beauty trata y protege tus datos personales (Ley N.° 29733).',
  path: '/politica-de-privacidad',
});

export default async function PrivacidadPage() {
  const s = (await api.settings.public().catch(() => ({}))) as { privacyMd?: string | null };
  const md = s?.privacyMd && String(s.privacyMd).trim() ? String(s.privacyMd) : DEFAULT_PRIVACY;
  return <LegalContent markdown={md} fallbackTitle="Política de Privacidad" />;
}
