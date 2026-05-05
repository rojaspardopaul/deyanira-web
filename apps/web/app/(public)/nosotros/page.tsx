import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, Heart, Star, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Nosotros',
  description: 'Conoce a Deyanira Makeup Beauty: salón de belleza profesional en Lima, Perú. Nuestra historia, valores y equipo.',
};

const VALUES = [
  {
    icon: Award,
    color: 'bg-pink-100 text-pink-600',
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

const TEAM = [
  { name: 'Deyanira', role: 'Fundadora & Maquilladora profesional', initial: 'D' },
  { name: 'Equipo Cabello', role: 'Estilistas especializadas', initial: 'C' },
  { name: 'Equipo Uñas', role: 'Nail artists certificadas', initial: 'U' },
];

export default function NosotrosPage() {
  return (
    <div className="min-h-screen bg-white pt-16">

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-pink-50 px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-5">
            Nuestra historia
          </span>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gray-900 mb-5 leading-tight">
            Belleza profesional<br />
            <span className="text-primary-600">con el corazón</span>
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Nacimos con una misión clara: que cada mujer en Lima pueda lucir su mejor versión,
            sin importar el evento. Desde maquillaje nupcial hasta el look del día a día,
            ponemos nuestro arte y dedicación en cada servicio.
          </p>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────── */}
      <section className="bg-primary-600 text-white px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-4xl font-display font-bold text-white mb-1">{value}</p>
                <p className="text-primary-200 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Historia ──────────────────────────────────── */}
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

            {/* Imagen placeholder */}
            <div className="relative">
              <div className="aspect-[4/5] bg-gradient-to-br from-primary-100 to-primary-200 rounded-3xl flex items-center justify-center overflow-hidden">
                <span className="text-8xl">💄</span>
              </div>
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

      {/* ── Valores ───────────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-gray-900 mb-3">
              Nuestros valores
            </h2>
            <p className="text-gray-500">Lo que nos guía en cada servicio</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

      {/* ── Equipo ────────────────────────────────────── */}
      <section className="px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-gray-900 mb-3">
              Nuestro equipo
            </h2>
            <p className="text-gray-500">Profesionales certificadas y apasionadas</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {TEAM.map(({ name, role, initial }) => (
              <div key={name} className="card p-6 text-center group hover:-translate-y-1 transition-all">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-300 to-primary-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-2xl font-display">
                  {initial}
                </div>
                <h3 className="font-display font-bold text-gray-900 text-lg mb-1">{name}</h3>
                <p className="text-gray-500 text-sm">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────── */}
      <section className="bg-primary-600 text-white px-4 py-16 text-center">
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
