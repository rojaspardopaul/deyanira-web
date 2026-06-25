'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, BadgeCheck, Crown, Star, X, CalendarCheck, Award } from 'lucide-react';

export type TeamMember = {
  id: string;
  name: string;
  role?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
  certifications: string[];
  services: string[];
};

const METRICS = [
  { value: '+500', label: 'Clientas felices' },
  { value: '+1000', label: 'Servicios realizados' },
  { value: '4.9★', label: 'Valoración promedio' },
  { value: '5+', label: 'Años de experiencia' },
];

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '✦';
}

// Avatar elegante cuando no hay foto.
function Avatar({ name, className = '' }: { name: string; className?: string }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#f5ece0] via-white to-[#f7e9ef] ${className}`}>
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold-400 to-primary-500 flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg ring-4 ring-white/70">
        {initialsOf(name)}
      </div>
    </div>
  );
}

// Aparición al hacer scroll (IntersectionObserver) — fade + leve subida.
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Chip({ children, tone = 'pink' }: { children: ReactNode; tone?: 'pink' | 'gold' }) {
  const cls = tone === 'gold'
    ? 'bg-amber-50 text-amber-700 ring-amber-200'
    : 'bg-primary-50 text-primary-700 ring-primary-100';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${cls}`}>
      {children}
    </span>
  );
}

// ── Modal de perfil completo ───────────────────────────────────
function ProfileModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto bg-[#FCFAF7] rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid sm:grid-cols-5">
          {/* Foto */}
          <div className="relative sm:col-span-2 aspect-[4/3] sm:aspect-auto sm:min-h-[420px] bg-gray-100">
            {member.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.photoUrl} alt={member.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <Avatar name={member.name} />
            )}
            <button onClick={onClose} className="sm:hidden absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Info */}
          <div className="sm:col-span-3 p-6 sm:p-8 relative">
            <button onClick={onClose} className="hidden sm:flex absolute top-4 right-4 w-9 h-9 rounded-full hover:bg-black/5 items-center justify-center text-gray-500">
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-display font-bold text-2xl md:text-3xl text-gray-900 leading-tight">{member.name}</h3>
            {member.role && <p className="text-primary-600 font-semibold mt-0.5">{member.role}</p>}

            {member.bio && <p className="text-gray-600 leading-relaxed mt-4 text-sm md:text-[15px]">{member.bio}</p>}

            {member.certifications.length > 0 && (
              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gold-600 mb-2">Certificaciones</p>
                <div className="flex flex-wrap gap-1.5">
                  {member.certifications.map((c) => (
                    <Chip key={c} tone="gold"><BadgeCheck className="w-3 h-3" /> {c}</Chip>
                  ))}
                </div>
              </div>
            )}

            {member.services.length > 0 && (
              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary-600 mb-2">Especialidades y servicios</p>
                <div className="flex flex-wrap gap-1.5">
                  {member.services.map((s) => (
                    <Chip key={s}><Sparkles className="w-3 h-3" /> {s}</Chip>
                  ))}
                </div>
              </div>
            )}

            <Link
              href="/reservar"
              className="mt-7 inline-flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-3.5 rounded-full font-bold text-sm text-white bg-primary-600 hover:bg-primary-500 active:scale-95 transition-all shadow-lg shadow-primary-500/25"
            >
              <CalendarCheck className="w-4 h-4" /> Reservar con {member.name.split(' ')[0]}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamSection({ members }: { members: TeamMember[] }) {
  const [active, setActive] = useState<TeamMember | null>(null);
  const founder = members[0] || null;
  const rest = members.slice(1);
  const allCerts = Array.from(new Set(members.flatMap((m) => m.certifications))).slice(0, 8);

  return (
    <section className="relative px-4 py-16 md:py-24 overflow-hidden" style={{ background: 'linear-gradient(180deg,#FCFAF7 0%,#F7F1EA 100%)' }}>
      {/* halos decorativos suaves */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-40" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.18), transparent 70%)' }} />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-40" style={{ background: 'radial-gradient(circle, rgba(219,39,119,0.12), transparent 70%)' }} />

      <div className="relative max-w-6xl mx-auto">
        {/* ── Hero del equipo ── */}
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-600 bg-white/70 ring-1 ring-gold-200 px-3 py-1.5 rounded-full mb-4">
            <Sparkles className="w-3.5 h-3.5" /> El equipo
          </span>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-gray-900 mb-4">Nuestro Equipo</h2>
          <p className="text-gray-500 leading-relaxed">
            Profesionales apasionadas por resaltar tu belleza con técnicas modernas y atención personalizada.
          </p>
        </Reveal>

        {/* ── Métricas ── */}
        <Reveal delay={80} className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {METRICS.map((m) => (
            <div key={m.label} className="rounded-2xl bg-white/80 backdrop-blur-sm ring-1 ring-black/5 shadow-sm px-4 py-5 text-center">
              <p className="font-display font-bold text-2xl md:text-3xl text-gray-900">{m.value}</p>
              <p className="text-[11px] md:text-xs text-gray-500 mt-1 uppercase tracking-wide">{m.label}</p>
            </div>
          ))}
        </Reveal>

        {/* ── Fundadora destacada ── */}
        {founder && (
          <Reveal delay={120} className="mt-12 md:mt-16">
            <div className="grid md:grid-cols-2 gap-0 rounded-[28px] overflow-hidden bg-white ring-1 ring-black/5 shadow-xl">
              <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[460px] bg-gray-100">
                {founder.photoUrl ? (
                  <Image src={founder.photoUrl} alt={founder.name} fill className="object-cover" sizes="(max-width:768px) 100vw, 50vw" />
                ) : (
                  <Avatar name={founder.name} />
                )}
                <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white bg-black/55 backdrop-blur-sm">
                  <Crown className="w-3.5 h-3.5 text-gold-300" /> Fundadora
                </span>
              </div>

              <div className="p-7 md:p-10 flex flex-col justify-center">
                <div className="flex flex-wrap gap-2 mb-4">
                  <Chip tone="gold"><Crown className="w-3 h-3" /> Fundadora</Chip>
                  <Chip tone="gold"><Star className="w-3 h-3 fill-current" /> 5+ años</Chip>
                  {founder.certifications.length > 0 && <Chip tone="gold"><Award className="w-3 h-3" /> Certificada</Chip>}
                </div>

                <h3 className="font-display font-bold text-3xl md:text-4xl text-gray-900 leading-tight">{founder.name}</h3>
                {founder.role && <p className="text-primary-600 font-semibold mt-1">{founder.role}</p>}
                {founder.bio && <p className="text-gray-500 leading-relaxed mt-4 line-clamp-2">{founder.bio}</p>}

                {founder.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-5">
                    {founder.services.slice(0, 4).map((s) => (
                      <Chip key={s}><Sparkles className="w-3 h-3" /> {s}</Chip>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setActive(founder)}
                  className="mt-7 self-start inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-gray-900 bg-gradient-to-r from-gold-300 to-gold-400 hover:to-gold-500 active:scale-95 transition-all shadow-md"
                >
                  Conocer más
                </button>
              </div>
            </div>
          </Reveal>
        )}

        {/* ── Resto del equipo (compactas) ── */}
        {rest.length > 0 && (
          <div className="mt-10 md:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((m, i) => (
              <Reveal key={m.id} delay={i * 90}>
                <div className="group h-full flex flex-col rounded-3xl overflow-hidden bg-white ring-1 ring-black/5 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300">
                  <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt={m.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <Avatar name={m.name} />
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-display font-bold text-xl text-gray-900 leading-tight">{m.name}</h3>
                    {m.role && <p className="text-primary-600 text-sm font-semibold mt-0.5">{m.role}</p>}
                    {m.services.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {m.services.slice(0, 3).map((s) => (
                          <Chip key={s}><Sparkles className="w-3 h-3" /> {s}</Chip>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setActive(m)}
                      className="mt-auto pt-5 text-sm font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1.5 self-start"
                    >
                      Ver perfil <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                    </button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {/* ── Certificaciones del equipo ── */}
        {allCerts.length > 0 && (
          <Reveal delay={120} className="mt-14 md:mt-20 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Formación y certificaciones</p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {allCerts.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white ring-1 ring-gold-200 shadow-sm text-sm font-medium text-gray-700">
                  <BadgeCheck className="w-4 h-4 text-gold-500" /> {c}
                </span>
              ))}
            </div>
          </Reveal>
        )}
      </div>

      {active && <ProfileModal member={active} onClose={() => setActive(null)} />}
    </section>
  );
}
