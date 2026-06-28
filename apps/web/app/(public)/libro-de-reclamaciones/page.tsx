import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import ReclamacionForm from '@/components/legal/ReclamacionForm';

export const metadata: Metadata = buildMetadata({
  title: 'Libro de Reclamaciones',
  description: 'Libro de Reclamaciones virtual de Deyanira Makeup Beauty conforme a INDECOPI. Registra tu reclamo o queja.',
  path: '/libro-de-reclamaciones',
});

export default async function LibroReclamacionesPage() {
  const s = (await api.settings.public().catch(() => ({}))) as {
    razonSocial?: string | null; ruc?: string | null;
    address?: string | null; district?: string | null; city?: string | null;
  };
  const direccion = [s?.address, s?.district, s?.city || 'Lima'].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen pt-24 pb-20 px-4" style={{ background: '#FCFAF7' }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <span className="text-3xl">📖</span>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-gray-900 mt-2">Libro de Reclamaciones</h1>
          <p className="text-sm text-gray-500 mt-2">
            Conforme al Código de Protección y Defensa del Consumidor (INDECOPI). Completa el formulario y
            recibirás una copia en tu correo.
          </p>
        </div>
        <ReclamacionForm proveedor={{ razonSocial: s?.razonSocial, ruc: s?.ruc, direccion }} />
      </div>
    </div>
  );
}
