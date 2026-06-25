'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Check, Crown, Sparkles, Users, ChevronRight, ChevronDown, Plus, X,
  GitCompare, Tag, Info,
} from 'lucide-react';
import { CatalogPreviewModal } from '@/components/catalog/CatalogPreviewModal';
import { focalImg } from '@/lib/cloudinary-client';

export type PackageItem = {
  id: string;
  label: string;
  quantity: number;
  daysBeforeMain?: number | null;
  longDescriptionMd?: string | null;
  catalogSlug?: string | null;
};

export type TrialAddon = {
  serviceId: string;
  name: string;
  duration: number;
  extraPricePen: number;
  daysBeforeMain?: number | null;
  longDescriptionMd?: string | null;
  imageUrl?: string | null;
};

export type Package = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  pricePen: number;
  comparePricePen?: number | null;
  groupSize: number | null;
  groupLabel: string | null;
  hasTrial: boolean;
  highlighted: boolean;
  items: PackageItem[];
  trialAddon?: TrialAddon | null;
};

function discountPct(pkg: Package): number | null {
  const before = pkg.comparePricePen;
  if (!before || before <= pkg.pricePen) return null;
  return Math.round(((before - pkg.pricePen) / before) * 100);
}

// ────────────────────────────────────────────────────────────
// Card individual (siempre visible)
// ────────────────────────────────────────────────────────────
function PackageCard({
  pkg,
  accent,
  inCompare,
  onToggleCompare,
  onOpenCatalog,
}: {
  pkg: Package;
  accent: string;
  inCompare: boolean;
  onToggleCompare: () => void;
  onOpenCatalog: (slug: string) => void;
}) {
  const [trialOn, setTrialOn] = useState(false);
  const [trialExpanded, setTrialExpanded] = useState(false);
  const pct = discountPct(pkg);
  const displayPrice = pkg.pricePen + (trialOn && pkg.trialAddon ? pkg.trialAddon.extraPricePen : 0);
  const reservarUrl = `/reservar?package=${pkg.id}${trialOn ? '&trial=1' : ''}`;
  const im = pkg.imageUrl ? focalImg(pkg.imageUrl, 800) : null;

  return (
    <article
      className="relative rounded-3xl overflow-hidden transition-all duration-300 flex flex-col"
      style={{
        background: '#fff',
        border: pkg.highlighted ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.08)',
        boxShadow: pkg.highlighted
          ? `0 8px 32px ${accent}22`
          : inCompare
            ? '0 0 0 3px rgba(59,130,246,0.25), 0 8px 24px rgba(0,0,0,0.06)'
            : '0 2px 12px rgba(0,0,0,0.05)',
      }}
    >
      {/* Badges arriba */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 z-10 pointer-events-none">
        <div className="flex flex-col gap-1.5">
          {pkg.highlighted && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white pointer-events-auto"
              style={{ background: accent }}
            >
              <Crown className="w-3 h-3" /> Recomendado
            </span>
          )}
          {pct !== null && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white pointer-events-auto"
              style={{ background: '#ef4444' }}
            >
              <Tag className="w-3 h-3" /> -{pct}%
            </span>
          )}
        </div>

        {/* Toggle comparar */}
        <button
          type="button"
          onClick={onToggleCompare}
          className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95"
          style={
            inCompare
              ? { background: '#3b82f6', color: 'white', boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }
              : { background: 'rgba(255,255,255,0.95)', color: '#1f2937', border: '1px solid rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)' }
          }
        >
          {inCompare ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {inCompare ? 'Añadido' : 'Comparar'}
        </button>
      </div>

      {/* Imagen con el nombre + descripción ENCIMA — card compacta (cabe en móvil) */}
      <div
        className="relative w-full aspect-[4/3] lg:aspect-[5/4] overflow-hidden"
        style={im ? { background: '#1a1014' } : { background: `linear-gradient(135deg, ${accent}cc, #1a1014)` }}
      >
        {im && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={im.src} alt={pkg.name} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: im.objectPosition }} loading="lazy" />
        )}
        {/* Degradado para que el texto se lea sobre la imagen */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 34%, rgba(0,0,0,0.05) 62%, transparent 100%)' }}
        />
        {/* Nombre + subtítulo + descripción sobre la imagen */}
        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
          <h3 className="font-display font-bold text-2xl md:text-3xl leading-tight text-white">
            {pkg.name}
          </h3>
          {pkg.subtitle && (
            <p className="text-[11px] uppercase tracking-wider font-semibold mt-0.5" style={{ color: accent }}>
              {pkg.subtitle}
            </p>
          )}
          {pkg.description && (
            <p className="text-sm mt-1.5 text-white/85 line-clamp-2">
              {pkg.description}
            </p>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-5 md:p-6 flex flex-col flex-1">
        {pkg.groupLabel && (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-1 self-start"
            style={{ background: `${accent}15`, color: accent }}
          >
            <Users className="w-3 h-3" /> {pkg.groupLabel}
          </div>
        )}

        {/* Items — siempre visible (sin acordeón) */}
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: '#8a6a78' }}>
            Incluye
          </p>
          <ul className="space-y-1.5">
            {pkg.items.map((it) => (
              <li key={it.id} className="flex items-start gap-2 text-sm" style={{ color: '#3a2630' }}>
                <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} />
                <span className="flex-1 inline-flex flex-wrap items-center gap-1">
                  <span>
                    {it.label}
                    {it.quantity > 1 && (
                      <span className="ml-1 text-xs font-semibold opacity-70">×{it.quantity}</span>
                    )}
                  </span>
                  {it.catalogSlug && (
                    <button
                      type="button"
                      onClick={() => onOpenCatalog(it.catalogSlug!)}
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-all hover:scale-105"
                      style={{ background: `${accent}15`, color: accent }}
                      title="Ver opciones del catálogo"
                    >
                      <Info className="w-3 h-3" /> Ver opciones
                    </button>
                  )}
                </span>
              </li>
            ))}
            {/* Servicio de prueba — siempre visible, tachado cuando el toggle está apagado */}
            {pkg.trialAddon && (
              <li
                className="flex items-start gap-2 text-sm transition-opacity"
                style={{ color: '#3a2630', opacity: trialOn ? 1 : 0.55 }}
              >
                <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: trialOn ? accent : '#9ca3af' }} />
                <span className="flex-1 inline-flex flex-wrap items-baseline gap-1.5">
                  <span style={{ textDecoration: trialOn ? 'none' : 'line-through' }}>
                    {pkg.trialAddon.name}
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                    style={{
                      background: trialOn ? `${accent}18` : 'rgba(0,0,0,0.05)',
                      color: trialOn ? accent : '#6b4d5a',
                    }}
                  >
                    {trialOn ? 'Incluido' : 'Opcional'}
                  </span>
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Toggle "Con prueba de maquillaje" */}
        {pkg.trialAddon && (
          <div className="mt-4 rounded-2xl overflow-hidden"
            style={{ background: trialOn ? `${accent}10` : '#FAFAFA', border: `1px solid ${trialOn ? accent : 'rgba(0,0,0,0.06)'}` }}>
            <div className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: trialOn ? `${accent}22` : 'rgba(0,0,0,0.05)', color: trialOn ? accent : '#6b4d5a' }}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#0F0F0F' }}>{pkg.trialAddon.name}</p>
                <p className="text-[11px]" style={{ color: '#6b4d5a' }}>
                  +S/{pkg.trialAddon.extraPricePen}
                  {pkg.trialAddon.daysBeforeMain ? ` · ${pkg.trialAddon.daysBeforeMain} días antes` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrialOn((v) => !v)}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                style={{ background: trialOn ? accent : 'rgba(0,0,0,0.15)' }}
                aria-pressed={trialOn}
              >
                <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                  style={{ transform: trialOn ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>
            {(pkg.trialAddon.longDescriptionMd || pkg.trialAddon.imageUrl) && (
              <>
                <button
                  type="button"
                  onClick={() => setTrialExpanded((v) => !v)}
                  className="w-full px-3 py-2 text-[11px] font-semibold flex items-center justify-between transition-colors hover:bg-black/5"
                  style={{ borderTop: '1px solid rgba(0,0,0,0.06)', color: '#6b4d5a' }}
                >
                  <span>{trialExpanded ? 'Ocultar info' : '¿En qué consiste?'}</span>
                  <ChevronDown
                    className="w-3 h-3 transition-transform"
                    style={{ transform: trialExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>
                {trialExpanded && (
                  <div className="px-3 pb-3 pt-1.5 text-xs leading-relaxed" style={{ color: '#3a2630' }}>
                    {pkg.trialAddon.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pkg.trialAddon.imageUrl} alt={pkg.trialAddon.name}
                        className="w-full rounded-lg mb-2" style={{ maxHeight: 140, objectFit: 'cover' }} />
                    )}
                    {pkg.trialAddon.longDescriptionMd && (
                      <div className="whitespace-pre-line">{pkg.trialAddon.longDescriptionMd}</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Precio + CTA */}
        <div className="mt-auto pt-5">
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            {pkg.comparePricePen && pkg.comparePricePen > pkg.pricePen && (
              <span className="text-base line-through" style={{ color: '#9ca3af' }}>
                S/{pkg.comparePricePen}
              </span>
            )}
            <span className="font-display font-bold text-3xl md:text-4xl leading-none" style={{ color: accent }}>
              S/{displayPrice}
            </span>
            {trialOn && pkg.trialAddon && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${accent}15`, color: accent }}>
                con prueba
              </span>
            )}
            {pct !== null && !trialOn && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>
                Ahorras S/{(pkg.comparePricePen || 0) - pkg.pricePen}
              </span>
            )}
          </div>
          <Link
            href={reservarUrl}
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full font-bold text-white text-sm transition-all duration-200 active:scale-95 hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              boxShadow: `0 6px 20px ${accent}44`,
            }}
          >
            Reservar este paquete
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

// ────────────────────────────────────────────────────────────
// Modal comparativo (solo los paquetes seleccionados)
// ────────────────────────────────────────────────────────────
function ComparisonModal({
  packages,
  selected,
  accent,
  onClose,
  onRemove,
}: {
  packages: Package[];
  selected: string[];
  accent: string;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  // Labels únicos ordenados por aparición en los paquetes seleccionados
  const allLabels = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const pkg of packages) {
      if (!selected.includes(pkg.id)) continue;
      for (const it of pkg.items) {
        if (!seen.has(it.label)) {
          seen.add(it.label);
          ordered.push(it.label);
        }
      }
    }
    return ordered;
  }, [packages, selected]);

  const selectedPackages = packages.filter((p) => selected.includes(p.id));

  function findItemQty(pkg: Package, label: string) {
    const it = pkg.items.find((x) => x.label === label);
    return it ? it.quantity : 0;
  }

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-white w-full md:max-w-5xl md:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 md:px-8 py-4 md:py-5 flex items-center justify-between border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold mb-1" style={{ color: accent }}>
              <GitCompare className="w-3.5 h-3.5 inline mr-1.5" /> Comparativa
            </div>
            <h3 className="font-display font-bold italic text-xl md:text-2xl" style={{ color: '#0F0F0F' }}>
              {selectedPackages.length} paquete{selectedPackages.length !== 1 ? 's' : ''} lado a lado
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: '#FAFAFA', borderBottom: '2px solid rgba(0,0,0,0.06)' }}>
                <th className="text-left p-4 text-xs uppercase tracking-wider font-bold" style={{ color: '#8a6a78', minWidth: 180 }}>
                  Incluye
                </th>
                {selectedPackages.map((pkg) => {
                  const pct = discountPct(pkg);
                  return (
                    <th key={pkg.id} className="p-4 text-center align-top" style={{ minWidth: 180 }}>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => onRemove(pkg.id)}
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-600 transition flex items-center justify-center"
                          title="Quitar de la comparación"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {pkg.highlighted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1.5"
                            style={{ background: accent, color: 'white' }}>
                            <Crown className="w-3 h-3" /> Top
                          </span>
                        )}
                        <div className="font-display font-bold text-base leading-tight" style={{ color: '#0F0F0F' }}>
                          {pkg.name}
                        </div>
                        {pkg.subtitle && (
                          <div className="text-[10px] uppercase tracking-wider font-semibold mt-0.5" style={{ color: accent }}>
                            {pkg.subtitle}
                          </div>
                        )}
                        {pkg.groupLabel && (
                          <div className="text-[10px] mt-1 font-medium" style={{ color: '#8a6a78' }}>
                            {pkg.groupLabel}
                          </div>
                        )}
                        <div className="mt-2">
                          {pkg.comparePricePen && pkg.comparePricePen > pkg.pricePen && (
                            <div className="text-xs line-through" style={{ color: '#9ca3af' }}>
                              S/{pkg.comparePricePen}
                            </div>
                          )}
                          <div className="font-display font-bold text-xl" style={{ color: accent }}>
                            S/{pkg.pricePen}
                          </div>
                          {pct !== null && (
                            <div className="text-[10px] font-bold mt-0.5" style={{ color: '#dc2626' }}>
                              Ahorras S/{(pkg.comparePricePen || 0) - pkg.pricePen}
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allLabels.map((label) => (
                <tr key={label} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td className="p-3 md:p-4 text-sm font-medium" style={{ color: '#3a2630' }}>{label}</td>
                  {selectedPackages.map((pkg) => {
                    const qty = findItemQty(pkg, label);
                    return (
                      <td key={pkg.id} className="p-3 md:p-4 text-center">
                        {qty > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="w-5 h-5" style={{ color: accent }} />
                            {qty > 1 && <span className="text-xs font-bold" style={{ color: accent }}>×{qty}</span>}
                          </span>
                        ) : (
                          <span className="text-base" style={{ color: 'rgba(0,0,0,0.15)' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {selectedPackages.some((p) => p.hasTrial) && (
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: `${accent}05` }}>
                  <td className="p-3 md:p-4 text-sm font-semibold flex items-center gap-2" style={{ color: accent }}>
                    <Sparkles className="w-4 h-4" /> Prueba de maquillaje
                  </td>
                  {selectedPackages.map((pkg) => (
                    <td key={pkg.id} className="p-3 md:p-4 text-center">
                      {pkg.hasTrial ? <Check className="w-5 h-5 mx-auto" style={{ color: accent }} /> : <span style={{ color: 'rgba(0,0,0,0.15)' }}>—</span>}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#FAFAFA' }}>
                <td className="p-3 md:p-4"></td>
                {selectedPackages.map((pkg) => (
                  <td key={pkg.id} className="p-2 md:p-3 text-center">
                    <Link
                      href={`/reservar?package=${pkg.id}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full font-bold text-xs text-white transition-all duration-200 active:scale-95 w-full"
                      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
                    >
                      Reservar
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────
export default function PackagesComparison({
  packages,
  accent,
}: {
  packages: Package[];
  accent: string;
}) {
  // Selecciona qué paquetes están en comparación
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [catalogSlug, setCatalogSlug] = useState<string | null>(null);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev; // máximo 4
      return [...prev, id];
    });
  }

  function removeFromCompare(id: string) {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  }

  const canCompare = compareIds.length >= 2;

  return (
    <div>
      {/* Grid de cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-2">
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            accent={accent}
            inCompare={compareIds.includes(pkg.id)}
            onToggleCompare={() => toggleCompare(pkg.id)}
            onOpenCatalog={(slug) => setCatalogSlug(slug)}
          />
        ))}
      </div>

      {/* Barra sticky inferior con CTA de comparar */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
          {/* pb extra en móvil para no quedar detrás del menú inferior (BottomNav) */}
          <div className="max-w-6xl mx-auto px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-4">
            <div
              className="pointer-events-auto rounded-2xl shadow-2xl p-3 md:p-4 flex items-center gap-3 backdrop-blur-md"
              style={{
                background: 'rgba(15,15,15,0.95)',
                border: `1px solid ${accent}44`,
              }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${accent}22`, color: accent }}>
                  <GitCompare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: accent }}>
                    Comparar paquetes
                  </p>
                  <p className="text-xs text-white font-semibold truncate">
                    {compareIds.length} seleccionado{compareIds.length > 1 ? 's' : ''}
                    {!canCompare && <span className="font-normal opacity-70"> · agrega 1 más para comparar</span>}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="px-2 py-2 text-xs text-white/60 hover:text-white transition shrink-0"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={!canCompare}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 4px 14px ${accent}55` }}
              >
                Comparar
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de comparativa */}
      {open && canCompare && (
        <ComparisonModal
          packages={packages}
          selected={compareIds}
          accent={accent}
          onClose={() => setOpen(false)}
          onRemove={(id) => {
            const next = compareIds.filter((x) => x !== id);
            setCompareIds(next);
            if (next.length < 2) setOpen(false);
          }}
        />
      )}

      {/* Modal preview de catálogo asociado a un servicio del paquete */}
      {catalogSlug && (
        <CatalogPreviewModal
          slug={catalogSlug}
          accent={accent}
          onClose={() => setCatalogSlug(null)}
        />
      )}
    </div>
  );
}
