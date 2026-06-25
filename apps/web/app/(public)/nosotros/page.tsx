import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Award, Heart, Star, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import TeamSection, { type TeamMember } from '@/components/nosotros/TeamSection';

export const metadata: Metadata = buildMetadata({
  title: 'Sobre Nosotros — Deyanira Makeup Beauty Lima',
  description: 'Conoce nuestra historia, valores y al equipo de estilistas profesionales certificadas de Deyanira Makeup Beauty en Cieneguilla, Lima. +6 años transformando a las mujeres limeñas.',
  path: '/nosotros',
  keywords: [
    'sobre Deyanira Makeup Beauty',
    'salón de belleza Cieneguilla historia',
    'maquilladoras profesionales Lima',
    'estilistas Lima certificadas',
  ],
});

const VALUES = [
  {
    icon: Award,
    color: 'bg-amber-100 text-gold-600',
    title: 'Profesionalismo',
    desc: 'Cada servicio se realiza con la máxima precisión y técnica. Nunca improvisamos con tu imagen.',
  },
  {
    icon: Heart,
    color: 'bg-red-100 text-red-500',
    title: 'Pasión',
    desc: 'Amamos lo que hacemos. Cada clienta merece sentirse la versión más bella de sí misma.',
  },
  {
    icon: Star,
    color: 'bg-yellow-100 text-yellow-600',
    title: 'Calidad',
    desc: 'Trabajamos solo con marcas profesionales de alta gama. Resultados que duran y brillan.',
  },
  {
    icon: Clock,
    color: 'bg-blue-100 text-blue-600',
    title: 'Puntualidad',
    desc: 'Respetamos tu tiempo. Confirmamos citas, enviamos recordatorios y atendemos en horario.',
  },
];

const STATS = [
  { value: '+5', label: 'años de experiencia' },
  { value: '+500', label: 'clientas felices' },
  { value: '4', label: 'especialidades' },
  { value: '5★', label: 'valoración promedio' },
];

type StaffMember = {
  id: string;
  name: string;
  role?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
  certifications?: string[] | null;
  staffServices?: Array<{ service: { name: string } }>;
};

// Iniciales (hasta 2) a partir del nombre.
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '✦';
}

// Placeholder elegante cuando la estilista aún no tiene foto: avatar con iniciales
// sobre un degradado suave (en vez de un bloque amarillo plano con una letra gigante).
function AvatarFallback({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl';
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-primary-50">
      <div className={`${dim} rounded-full bg-gradient-to-br from-gold-400 to-primary-500 flex items-center justify-center text-white font-display font-bold shadow-lg ring-4 ring-white/70`}>
        {initialsOf(name)}
      </div>
    </div>
  );
}

export default async function NosotrosPage() {
  const [staff, settings] = await Promise.all([
    api.staff.list().catch(() => []) as Promise<StaffMember[]>,
    api.settings.public().catch(() => ({})) as Promise<{ teamPhotoUrl?: string | null; salonPhotoUrl?: string | null }>,
  ]);
  const teamPhoto = settings.teamPhotoUrl || null; // foto grupal del equipo (admin)
  const salonPhoto = settings.salonPhotoUrl || null; // foto del salón → fondo del hero
  const team = staff.slice(0, 4); // fallback: collage si no hay foto grupal
  const members: TeamMember[] = staff.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role ?? null,
    photoUrl: m.photoUrl ?? null,
    bio: m.bio ?? null,
    certifications: (m.certifications ?? []).filter(Boolean),
    services: m.staffServices?.map((ss) => ss.service.name) ?? [],
  }));
  return (
    <div className="min-h-screen bg-white pt-16">

      {/* Hero — con foto del salón de fondo si está configurada */}
      <section className="relative overflow-hidden px-4 py-20 md:py-28">
        {salonPhoto ? (
          <>
            <Image src={salonPhoto} alt="Salón Deyanira Makeup Beauty" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-amber-50" />
        )}
        <div className="relative max-w-3xl mx-auto text-center">
          <span className={`inline-block text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-5 ${salonPhoto ? 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm' : 'bg-primary-100 text-primary-700'}`}>
            Nuestra historia
          </span>
          <h1 className={`text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-5 leading-tight ${salonPhoto ? 'text-white drop-shadow-lg' : 'text-gray-900'}`}>
            Belleza profesional<br />
            <span className={salonPhoto ? 'text-primary-300' : 'text-primary-600'}>con el corazón</span>
          </h1>
          <p className={`text-base md:text-lg leading-relaxed max-w-2xl mx-auto ${salonPhoto ? 'text-white/85' : 'text-gray-600'}`}>
            Nacimos con una misión clara: que cada mujer en Lima pueda lucir su mejor versión,
            sin importar el evento. Desde maquillaje nupcial hasta el look del día a día,
            ponemos nuestro arte y dedicación en cada servicio.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary-500 text-white px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-4xl font-display font-bold text-white mb-1">{value}</p>
                <p className="text-primary-100 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Historia */}
      <section className="px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-display font-bold text-gray-900 mb-5">
                ¿Quiénes somos?
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Deyanira Makeup Beauty es un salón de belleza profesional ubicado en Lima, Perú.
                  Nos especializamos en realzar la belleza única de cada clienta con técnicas
                  modernas y productos de primera calidad.
                </p>
                <p>
                  Empezamos como un pequeño estudio de maquillaje y hoy somos un equipo
                  de profesionales apasionadas que ofrecemos servicios completos de belleza:
                  maquillaje, cabello, uñas y cejas.
                </p>
                <p>
                  Nuestra filosofía es simple: tratar a cada clienta como si fuera única,
                  porque lo es. Cada rostro, cada ocasión y cada historia merecen
                  un tratamiento personalizado.
                </p>
              </div>
              <Link href="/reservar" className="btn-primary mt-8 inline-flex">
                Reservar mi cita
              </Link>
            </div>

            {/* Imagen grupal del equipo (foto única configurada en el admin). Si no
                hay foto grupal, se arma un collage con las fotos de las estilistas. */}
            <div className="relative">
              {teamPhoto ? (
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-lg ring-1 ring-black/5">
                  <Image
                    src={teamPhoto}
                    alt="Equipo de Deyanira Makeup Beauty"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 45vw"
                  />
                </div>
              ) : team.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {team.map((m) => (
                    <div key={m.id} className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5">
                      {m.photoUrl ? (
                        <Image
                          src={m.photoUrl}
                          alt={m.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 45vw, 22vw"
                        />
                      ) : (
                        <AvatarFallback name={m.name} />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative aspect-[4/5] rounded-3xl overflow-hidden">
                  <AvatarFallback name="Deyanira" size="lg" />
                </div>
              )}
              {/* Decorative card */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">⭐</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">+500 clientas</p>
                  <p className="text-gray-500 text-xs">en Lima, Perú</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Equipo — sección premium (cliente: métricas, fundadora destacada, modales) */}
      <TeamSection members={members} />

      {/* Valores */}
      <section className="bg-gray-50 px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-3xl font-display font-bold text-gray-900 mb-3">
              Nuestros valores
            </h2>
            <p className="text-gray-500">Lo que nos guía en cada servicio</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {VALUES.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="card p-6 text-center">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-primary-500 text-white px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-display font-bold mb-4">
            ¿Lista para vivir la experiencia?
          </h2>
          <p className="text-primary-100 mb-8">
            Únete a las cientos de clientas que ya confían en nosotras.
          </p>
          <Link
            href="/reservar"
            className="inline-flex items-center gap-2 bg-white text-primary-700 font-bold px-8 py-4 rounded-full text-base hover:bg-primary-50 active:scale-95 transition-all shadow-xl"
          >
            Agendar mi cita
          </Link>
        </div>
      </section>
    </div>
  );
}
