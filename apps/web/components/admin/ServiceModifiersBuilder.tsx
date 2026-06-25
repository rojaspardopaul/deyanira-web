'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Settings2,
  AlertCircle, CheckCircle2, Eye, Upload, Image as ImageIcon,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import {
  calculatePrice, buildDefaultSelections, formatPricePen, formatPriceDelta, formatDuration,
  type ModifierGroup, type ModifierOption, type ServiceForPricing, type Selections,
  type FieldType, type ModifierType,
} from '@/lib/pricing';

// Tipos de campo disponibles en el MVP. Los demás están en el motor de pricing
// pero todavía no tienen UI renderizable en el cliente.
type MvpFieldType = 'single_select' | 'image_cards' | 'toggle' | 'quantity' | 'text_input';

const FIELD_TYPE_OPTIONS: Array<{ value: MvpFieldType; label: string; description: string; icon: string }> = [
  { value: 'single_select', label: 'Selección única (cards)',  description: 'El cliente elige una opción entre varias', icon: '🎴' },
  { value: 'image_cards',   label: 'Cards con imagen',          description: 'Como selección única pero con foto grande', icon: '🖼️' },
  { value: 'toggle',        label: 'Toggle on/off',             description: 'Activar / desactivar una opción extra', icon: '🔘' },
  { value: 'quantity',      label: 'Cantidad (número)',         description: 'El cliente ingresa una cantidad numérica', icon: '🔢' },
  { value: 'text_input',    label: 'Texto libre',               description: 'Campo de texto (sin afectar precio)', icon: '✍️' },
];

const MODIFIER_TYPE_OPTIONS: Array<{ value: ModifierType; label: string; example: string }> = [
  { value: 'fixed',        label: 'Suma fija (S/)',        example: 'Largo del cabello "Largo" → +S/40' },
  { value: 'percent',      label: 'Porcentaje (%)',        example: 'Aerógrafo → +15% del precio base' },
  { value: 'multiplier',   label: 'Multiplicador (x)',     example: 'Volumen alto → x2 del precio base' },
  { value: 'per_quantity', label: 'Por unidad (cantidad)', example: 'Cada accesorio adicional → +S/10' },
];

type DraftOption = Partial<ModifierOption> & { _key: string };
// Omit 'options' del Partial para que el borrador use DraftOption[] (parciales con _key)
// sin chocar con el ModifierOption[] que exige Partial<ModifierGroup>.
type DraftGroup = Omit<Partial<ModifierGroup>, 'options'> & { _key: string; _expanded?: boolean; options: DraftOption[] };

function uid() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function withKeys(groups: ModifierGroup[] | undefined): DraftGroup[] {
  return (groups || []).map((g) => ({
    ...g,
    _key: g.id || uid(),
    _expanded: false,
    options: (g.options || []).map((o) => ({ ...o, _key: o.id || uid() })),
  }));
}

function emptyGroup(): DraftGroup {
  return {
    _key: uid(),
    _expanded: true,
    name: '',
    helpText: '',
    fieldType: 'single_select',
    displayType: 'cards',
    required: false,
    sortOrder: 0,
    options: [],
  };
}

function emptyOption(): DraftOption {
  return {
    _key: uid(),
    label: '',
    modifierType: 'fixed',
    modifierValue: 0,
    durationDelta: 0,
    isDefault: false,
    sortOrder: 0,
  };
}

interface Props {
  serviceId: string;
  servicePricePen: number;
  serviceDuration: number;
  initialGroups: ModifierGroup[];
  onSaved?: (groups: ModifierGroup[]) => void;
}

export default function ServiceModifiersBuilder({
  serviceId, servicePricePen, serviceDuration, initialGroups, onSaved,
}: Props) {
  const [groups, setGroups] = useState<DraftGroup[]>(() => withKeys(initialGroups));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Sincroniza cuando cambia el servicio (al cerrar/abrir el modal con otro)
  const lastInitRef = useRef<ModifierGroup[] | undefined>(undefined);
  useEffect(() => {
    if (initialGroups !== lastInitRef.current) {
      setGroups(withKeys(initialGroups));
      setDirty(false);
      lastInitRef.current = initialGroups;
    }
  }, [initialGroups]);

  function markDirty() {
    setDirty(true); setError(''); setSuccess('');
  }

  // ── Mutadores de grupos ─────────────────────────────────────
  function addGroup() {
    setGroups((gs) => [...gs, { ...emptyGroup(), sortOrder: gs.length }]);
    markDirty();
  }

  function updateGroup(key: string, patch: Partial<DraftGroup>) {
    setGroups((gs) => gs.map((g) => (g._key === key ? { ...g, ...patch } : g)));
    markDirty();
  }

  function removeGroup(key: string) {
    setGroups((gs) => gs.filter((g) => g._key !== key));
    markDirty();
  }

  function moveGroup(key: string, dir: -1 | 1) {
    setGroups((gs) => {
      const idx = gs.findIndex((g) => g._key === key);
      if (idx < 0) return gs;
      const next = [...gs];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return gs;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((g, i) => ({ ...g, sortOrder: i }));
    });
    markDirty();
  }

  // ── Mutadores de opciones ───────────────────────────────────
  function addOption(groupKey: string) {
    setGroups((gs) => gs.map((g) => g._key === groupKey
      ? { ...g, options: [...g.options, { ...emptyOption(), sortOrder: g.options.length }] }
      : g));
    markDirty();
  }

  function updateOption(groupKey: string, optKey: string, patch: Partial<DraftOption>) {
    setGroups((gs) => gs.map((g) => g._key === groupKey
      ? { ...g, options: g.options.map((o) => (o._key === optKey ? { ...o, ...patch } : o)) }
      : g));
    markDirty();
  }

  function removeOption(groupKey: string, optKey: string) {
    setGroups((gs) => gs.map((g) => g._key === groupKey
      ? { ...g, options: g.options.filter((o) => o._key !== optKey) }
      : g));
    markDirty();
  }

  function moveOption(groupKey: string, optKey: string, dir: -1 | 1) {
    setGroups((gs) => gs.map((g) => {
      if (g._key !== groupKey) return g;
      const idx = g.options.findIndex((o) => o._key === optKey);
      if (idx < 0) return g;
      const next = [...g.options];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return g;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...g, options: next.map((o, i) => ({ ...o, sortOrder: i })) };
    }));
    markDirty();
  }

  // ── Upload de imagen para una opción ────────────────────────
  async function uploadOptionImage(groupKey: string, optKey: string, file: File) {
    if (file.size > 5 * 1024 * 1024) { setError('La imagen debe ser menor a 5MB'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const b64 = ev.target?.result as string;
        const uploaded = await adminApi().upload(b64, 'service-modifiers') as { url: string };
        updateOption(groupKey, optKey, { imageUrl: uploaded.url });
      } catch {
        setError('Error al subir la imagen');
      }
    };
    reader.readAsDataURL(file);
  }

  // ── Validación local antes de guardar ───────────────────────
  function validateLocal(): string | null {
    for (const g of groups) {
      if (!g.name || !g.name.trim()) return 'Cada grupo debe tener un nombre';
      if (!g.fieldType) return `El grupo "${g.name}" no tiene tipo de campo`;
      if (g.fieldType !== 'text_input' && g.fieldType !== 'quantity' && g.options.length === 0) {
        return `El grupo "${g.name}" debe tener al menos una opción`;
      }
      for (const o of g.options) {
        if (!o.label || !String(o.label).trim()) return `Una opción en "${g.name}" no tiene label`;
      }
    }
    return null;
  }

  // ── Persistencia ────────────────────────────────────────────
  async function save() {
    const err = validateLocal();
    if (err) { setError(err); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        groups: groups.map((g, gi) => ({
          name: g.name?.trim(),
          helpText: g.helpText || null,
          fieldType: g.fieldType,
          displayType: g.displayType || null,
          required: Boolean(g.required),
          sortOrder: gi,
          minValue: g.minValue ?? null,
          maxValue: g.maxValue ?? null,
          stepValue: g.stepValue ?? null,
          defaultValue: g.defaultValue ?? null,
          options: g.options.map((o, oi) => ({
            label: o.label?.trim(),
            value: o.value || null,
            imageUrl: o.imageUrl || null,
            iconName: o.iconName || null,
            modifierType: o.modifierType || 'fixed',
            modifierValue: Number(o.modifierValue ?? 0),
            durationDelta: Number(o.durationDelta ?? 0),
            isDefault: Boolean(o.isDefault),
            sortOrder: oi,
          })),
        })),
      };
      const fresh = await adminApi().services.setModifiers(serviceId, payload) as {
        modifierGroups?: ModifierGroup[];
      };
      setDirty(false);
      setSuccess('✓ Modificadores guardados correctamente');
      if (onSaved && fresh.modifierGroups) onSaved(fresh.modifierGroups);
      // Reset claves transitorias con los IDs reales devueltos por el servidor
      setGroups(withKeys(fresh.modifierGroups || []));
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  // ── Preview en tiempo real ──────────────────────────────────
  const previewService: ServiceForPricing = useMemo(() => ({
    id: serviceId,
    pricePen: servicePricePen,
    duration: serviceDuration,
    modifierGroups: groups.map((g) => ({
      id: g._key,
      name: g.name || 'Sin nombre',
      helpText: g.helpText || undefined,
      fieldType: (g.fieldType || 'single_select') as FieldType,
      displayType: g.displayType || undefined,
      required: Boolean(g.required),
      sortOrder: g.sortOrder || 0,
      minValue: g.minValue ?? undefined,
      maxValue: g.maxValue ?? undefined,
      stepValue: g.stepValue ?? undefined,
      defaultValue: g.defaultValue ?? undefined,
      options: g.options.map((o) => ({
        id: o._key,
        label: o.label || 'Sin label',
        value: o.value || undefined,
        imageUrl: o.imageUrl || undefined,
        modifierType: (o.modifierType || 'fixed') as ModifierType,
        modifierValue: Number(o.modifierValue ?? 0),
        durationDelta: Number(o.durationDelta ?? 0),
        isDefault: Boolean(o.isDefault),
        sortOrder: o.sortOrder || 0,
      })),
    })),
  }), [groups, serviceId, servicePricePen, serviceDuration]);

  const [previewSelections, setPreviewSelections] = useState<Selections>({});
  useEffect(() => {
    setPreviewSelections(buildDefaultSelections(previewService.modifierGroups));
  }, [previewService.modifierGroups?.length]); // solo cuando cambia la estructura

  const priced = useMemo(() => calculatePrice(previewService, previewSelections), [previewService, previewSelections]);

  // ── UI ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base text-gray-900 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-violet-500" />
            Modificadores dinámicos
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Opciones que cambian el precio y/o duración del servicio en tiempo real.
            Ej: "Largo del cabello", "¿Quieres aerógrafo?", etc.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPreview(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${showPreview ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Eye className="w-3.5 h-3.5" /> Vista previa
          </button>
        </div>
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <Settings2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-600 font-medium">No hay modificadores configurados</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Este servicio se reservará con su precio y duración base.
          </p>
          <button
            type="button"
            onClick={addGroup}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Agregar primer grupo
          </button>
        </div>
      )}

      {/* Grupos */}
      <div className="space-y-3">
        {groups.map((g, gi) => (
          <GroupEditor
            key={g._key}
            group={g}
            index={gi}
            total={groups.length}
            onUpdate={(patch) => updateGroup(g._key, patch)}
            onRemove={() => removeGroup(g._key)}
            onMove={(dir) => moveGroup(g._key, dir)}
            onAddOption={() => addOption(g._key)}
            onUpdateOption={(optKey, patch) => updateOption(g._key, optKey, patch)}
            onRemoveOption={(optKey) => removeOption(g._key, optKey)}
            onMoveOption={(optKey, dir) => moveOption(g._key, optKey, dir)}
            onUploadOptionImage={(optKey, file) => uploadOptionImage(g._key, optKey, file)}
            servicePricePen={servicePricePen}
          />
        ))}
      </div>

      {groups.length > 0 && (
        <button
          type="button"
          onClick={addGroup}
          className="w-full border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/40 rounded-xl py-3 text-sm font-medium text-gray-500 hover:text-violet-600 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Agregar otro grupo de opciones
        </button>
      )}

      {/* Preview panel */}
      {showPreview && groups.length > 0 && (
        <div className="border border-violet-200 bg-gradient-to-br from-violet-50/50 to-fuchsia-50/50 rounded-2xl p-4 sm:p-5">
          <h4 className="font-semibold text-sm text-violet-900 mb-3 flex items-center gap-1.5">
            <Eye className="w-4 h-4" /> Vista previa (así lo verá el cliente)
          </h4>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),260px] xl:grid-cols-[minmax(0,1fr),300px]">
            <div className="space-y-4 bg-white rounded-xl p-4 min-w-0">
              {previewService.modifierGroups?.map((g) => (
                <PreviewField
                  key={g.id}
                  group={g}
                  selection={previewSelections[g.id]}
                  onChange={(s) => setPreviewSelections((sel) => ({ ...sel, [g.id]: s }))}
                />
              ))}
            </div>
            <div className="bg-white rounded-xl p-4 lg:sticky lg:top-2 self-start min-w-0">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Precio base</p>
              <p className="text-sm text-gray-700">{formatPricePen(priced.basePrice)}</p>
              <p className="text-xs text-gray-500 mt-3 mb-1 uppercase tracking-wider font-semibold">Total final</p>
              <p className="text-2xl font-bold text-violet-700">{formatPricePen(priced.totalPrice)}</p>
              <p className="text-xs text-gray-500 mt-3 mb-1 uppercase tracking-wider font-semibold">Duración</p>
              <p className="text-sm text-gray-700">{formatDuration(priced.totalDuration)}</p>
              {priced.breakdown.length > 0 && (
                <div className="border-t border-gray-100 mt-3 pt-2 space-y-1">
                  {priced.breakdown.map((b, i) => (
                    <p key={i} className="text-[11px] text-gray-500 leading-snug">
                      <span className="font-medium text-gray-700">{b.label}</span>
                      {b.delta !== 0 && <span className="text-violet-600 ml-1 font-medium">{formatPriceDelta(b.delta)}</span>}
                      {b.durationDelta !== 0 && <span className="text-amber-600 ml-1 font-medium">{b.durationDelta > 0 ? '+' : ''}{b.durationDelta}m</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status + actions */}
      {(error || success || dirty) && (
        <div className="flex items-center justify-between gap-3 sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 pt-3">
          <div className="flex items-center gap-2 text-sm">
            {error && (
              <span className="flex items-center gap-1.5 text-red-600">
                <AlertCircle className="w-4 h-4" /> {error}
              </span>
            )}
            {!error && success && (
              <span className="flex items-center gap-1.5 text-green-600">
                <CheckCircle2 className="w-4 h-4" /> {success}
              </span>
            )}
            {!error && !success && dirty && (
              <span className="text-amber-600 text-xs">Hay cambios sin guardar</span>
            )}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar modificadores'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GROUP EDITOR
// ─────────────────────────────────────────────────────────────

function GroupEditor({
  group, index, total,
  onUpdate, onRemove, onMove,
  onAddOption, onUpdateOption, onRemoveOption, onMoveOption,
  onUploadOptionImage,
  servicePricePen,
}: {
  group: DraftGroup;
  index: number;
  total: number;
  onUpdate: (patch: Partial<DraftGroup>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddOption: () => void;
  onUpdateOption: (optKey: string, patch: Partial<DraftOption>) => void;
  onRemoveOption: (optKey: string) => void;
  onMoveOption: (optKey: string, dir: -1 | 1) => void;
  onUploadOptionImage: (optKey: string, file: File) => void;
  servicePricePen: number;
}) {
  const expanded = group._expanded ?? true;
  const fieldType = (group.fieldType || 'single_select') as MvpFieldType;
  const needsOptions = fieldType !== 'text_input' && fieldType !== 'quantity';
  const needsImage = fieldType === 'image_cards';

  return (
    <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 bg-gray-50/50 border-b border-gray-100">
        <button
          type="button"
          onClick={() => onUpdate({ _expanded: !expanded })}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <GripVertical className="w-3.5 h-3.5 text-gray-300" />
        <input
          type="text"
          placeholder='Nombre del grupo (ej. "Largo del cabello")'
          value={group.name || ''}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none"
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
            title="Subir"
          >▲</button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
            title="Bajar"
          >▼</button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Eliminar grupo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Tipo de campo + obligatorio */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo de campo</label>
              <select
                value={fieldType}
                onChange={(e) => {
                  const ft = e.target.value as MvpFieldType;
                  const displayType = ft === 'single_select' ? 'cards' : ft === 'image_cards' ? 'cards' : null;
                  onUpdate({ fieldType: ft as FieldType, displayType });
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
              >
                {FIELD_TYPE_OPTIONS.map((ft) => (
                  <option key={ft.value} value={ft.value}>{ft.icon} {ft.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                {FIELD_TYPE_OPTIONS.find((ft) => ft.value === fieldType)?.description}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Configuración</label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(group.required)}
                  onChange={(e) => onUpdate({ required: e.target.checked })}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-300"
                />
                Selección obligatoria
              </label>
              {fieldType === 'quantity' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Min</label>
                  <input
                    type="number"
                    value={group.minValue ?? ''}
                    onChange={(e) => onUpdate({ minValue: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-16 border border-gray-200 rounded px-2 py-1 text-sm"
                  />
                  <label className="text-xs text-gray-500">Max</label>
                  <input
                    type="number"
                    value={group.maxValue ?? ''}
                    onChange={(e) => onUpdate({ maxValue: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-16 border border-gray-200 rounded px-2 py-1 text-sm"
                  />
                  <label className="text-xs text-gray-500">Paso</label>
                  <input
                    type="number"
                    value={group.stepValue ?? ''}
                    onChange={(e) => onUpdate({ stepValue: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-16 border border-gray-200 rounded px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Texto de ayuda (opcional)</label>
            <input
              type="text"
              value={group.helpText || ''}
              placeholder='Ej: "Esto nos ayuda a calcular el tiempo exacto"'
              onChange={(e) => onUpdate({ helpText: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          {/* Opciones */}
          {needsOptions ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold text-gray-600">
                  {fieldType === 'toggle' ? 'Configuración del toggle' : 'Opciones'}
                </h5>
                {fieldType !== 'toggle' && (
                  <button
                    type="button"
                    onClick={onAddOption}
                    className="text-xs text-violet-600 hover:text-violet-700 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Agregar opción
                  </button>
                )}
              </div>

              {group.options.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-4 bg-gray-50 rounded-lg">
                  {fieldType === 'toggle' ? 'Agrega 1 opción que se aplicará cuando el toggle esté activo' : 'Aún no hay opciones'}
                </div>
              )}

              {group.options.map((opt, oi) => (
                <OptionEditor
                  key={opt._key}
                  option={opt}
                  index={oi}
                  total={group.options.length}
                  servicePricePen={servicePricePen}
                  needsImage={needsImage}
                  isToggle={fieldType === 'toggle'}
                  onUpdate={(patch) => onUpdateOption(opt._key, patch)}
                  onRemove={() => onRemoveOption(opt._key)}
                  onMove={(dir) => onMoveOption(opt._key, dir)}
                  onUploadImage={(file) => onUploadOptionImage(opt._key, file)}
                />
              ))}

              {fieldType === 'toggle' && group.options.length === 0 && (
                <button
                  type="button"
                  onClick={onAddOption}
                  className="w-full bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold py-2 rounded-lg"
                >
                  + Configurar opción del toggle
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              Este tipo no requiere opciones predefinidas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OPTION EDITOR
// ─────────────────────────────────────────────────────────────

function OptionEditor({
  option, index, total, servicePricePen, needsImage, isToggle,
  onUpdate, onRemove, onMove, onUploadImage,
}: {
  option: DraftOption;
  index: number;
  total: number;
  servicePricePen: number;
  needsImage: boolean;
  isToggle: boolean;
  onUpdate: (patch: Partial<DraftOption>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onUploadImage: (file: File) => void;
}) {
  const modType = (option.modifierType || 'fixed') as ModifierType;
  const fileRef = useRef<HTMLInputElement>(null);

  // Cálculo del impacto en precio para mostrar al admin
  const impact = (() => {
    const v = Number(option.modifierValue || 0);
    if (v === 0) return 'sin cambio';
    switch (modType) {
      case 'fixed':        return `${v > 0 ? '+' : ''}S/${v.toFixed(2)}`;
      case 'percent':      return `${v > 0 ? '+' : ''}${v}% (~${(servicePricePen * v / 100).toFixed(2)})`;
      case 'multiplier':   return `×${v} (precio = S/${(servicePricePen * v).toFixed(2)})`;
      case 'per_quantity': return `S/${v.toFixed(2)} × cantidad`;
    }
  })();

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
      <div className="flex items-start gap-3">
        {needsImage && (
          <div className="shrink-0">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50 cursor-pointer overflow-hidden flex items-center justify-center"
            >
              {option.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-5 h-5 text-gray-300" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadImage(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-[10px] text-violet-600 hover:underline mt-1 flex items-center gap-1 mx-auto"
            >
              <Upload className="w-3 h-3" /> {option.imageUrl ? 'Cambiar' : 'Subir'}
            </button>
          </div>
        )}

        <div className="flex-1 space-y-2 min-w-0">
          <input
            type="text"
            placeholder={isToggle ? 'Label cuando esté activo (ej. "Con aerógrafo")' : 'Nombre de la opción (ej. "Largo")'}
            value={option.label || ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-300"
          />

          {/* Modificador — responsive: stack en mobile, grid en desktop */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Tipo de modificador</label>
              <select
                value={modType}
                onChange={(e) => onUpdate({ modifierType: e.target.value as ModifierType })}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
              >
                {MODIFIER_TYPE_OPTIONS.map((mt) => (
                  <option key={mt.value} value={mt.value}>{mt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Valor</label>
              <input
                type="number"
                step="0.01"
                value={option.modifierValue ?? 0}
                onChange={(e) => onUpdate({ modifierValue: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">± minutos</label>
              <input
                type="number"
                value={option.durationDelta ?? 0}
                onChange={(e) => onUpdate({ durationDelta: Number(e.target.value) })}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
            <span>Impacto: <span className="font-mono text-violet-700">{impact}</span></span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(option.isDefault)}
                onChange={(e) => onUpdate({ isDefault: e.target.checked })}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-300"
              />
              Predeterminada
            </label>
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 text-xs"
          >▲</button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="p-1 text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 text-xs"
          >▼</button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-600 rounded mt-1"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PREVIEW FIELD (simulación del comportamiento del cliente)
// ─────────────────────────────────────────────────────────────

function PreviewField({
  group, selection, onChange,
}: {
  group: ModifierGroup;
  selection: { optionIds?: string[]; value?: unknown; quantity?: number } | undefined;
  onChange: (s: { optionIds?: string[]; value?: unknown; quantity?: number }) => void;
}) {
  const ft = group.fieldType;
  const sel = selection || {};

  if (ft === 'single_select' || ft === 'image_cards') {
    const selectedId = (sel.optionIds || [])[0];
    return (
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-1.5">{group.name} {group.required && <span className="text-red-500">*</span>}</p>
        {group.helpText && <p className="text-xs text-gray-500 mb-2">{group.helpText}</p>}
        <div className={`grid gap-2 ${ft === 'image_cards' ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {group.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange({ optionIds: [o.id] })}
              className={`text-left border rounded-xl p-2 transition-all ${
                selectedId === o.id ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200' : 'border-gray-200 hover:border-violet-300'
              }`}
            >
              {ft === 'image_cards' && o.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.imageUrl} alt={o.label} className="w-full h-16 object-cover rounded-md mb-1" />
              )}
              <p className="text-xs font-semibold text-gray-800 leading-tight">{o.label}</p>
              {o.modifierValue !== 0 && (
                <p className="text-[10px] text-violet-600 mt-0.5">{formatModifierLabel(o)}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (ft === 'toggle') {
    const opt = group.options[0];
    if (!opt) return null;
    const active = (sel.optionIds || []).includes(opt.id);
    return (
      <div className="flex items-center justify-between border border-gray-200 rounded-xl p-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{group.name}</p>
          <p className="text-xs text-gray-500">
            {opt.label} <span className="text-violet-600">{formatModifierLabel(opt)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ optionIds: active ? [] : [opt.id] })}
          className={`w-11 h-6 rounded-full transition-colors ${active ? 'bg-violet-500' : 'bg-gray-300'}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow m-0.5 transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    );
  }

  if (ft === 'quantity') {
    const v = Number(sel.value ?? sel.quantity ?? group.minValue ?? 0);
    const min = group.minValue ?? 0;
    const max = group.maxValue ?? 99;
    const step = group.stepValue ?? 1;
    return (
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-1.5">{group.name}</p>
        {group.helpText && <p className="text-xs text-gray-500 mb-2">{group.helpText}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ value: Math.max(min, v - step), quantity: Math.max(min, v - step) })}
            className="w-8 h-8 border border-gray-200 rounded-lg text-lg font-semibold hover:bg-gray-50"
          >−</button>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={v}
            onChange={(e) => {
              const nv = Number(e.target.value);
              onChange({ value: nv, quantity: nv });
            }}
            className="w-16 text-center border border-gray-200 rounded-lg py-1.5"
          />
          <button
            type="button"
            onClick={() => onChange({ value: Math.min(max, v + step), quantity: Math.min(max, v + step) })}
            className="w-8 h-8 border border-gray-200 rounded-lg text-lg font-semibold hover:bg-gray-50"
          >+</button>
        </div>
      </div>
    );
  }

  if (ft === 'text_input') {
    return (
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-1.5">{group.name}</p>
        {group.helpText && <p className="text-xs text-gray-500 mb-2">{group.helpText}</p>}
        <input
          type="text"
          value={String(sel.value || '')}
          onChange={(e) => onChange({ value: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Escribe aquí..."
        />
      </div>
    );
  }

  return null;
}

function formatModifierLabel(o: ModifierOption): string {
  const v = Number(o.modifierValue || 0);
  if (v === 0) return '';
  switch (o.modifierType) {
    case 'fixed':        return `${v > 0 ? '+' : ''}S/${v.toFixed(2)}`;
    case 'percent':      return `${v > 0 ? '+' : ''}${v}%`;
    case 'multiplier':   return `×${v}`;
    case 'per_quantity': return `+S/${v.toFixed(2)}/u`;
    default: return '';
  }
}
