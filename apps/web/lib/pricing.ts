// Motor de cálculo de precios para servicios con modificadores dinámicos.
// Réplica TypeScript del motor backend en apps/api/src/lib/pricing/calculate.js.
// Mantenidos en sincronía a propósito: el backend siempre revalida server-side
// al crear citas (anti-tampering). Este motor es solo para la UI en tiempo real.

export const FIELD_TYPES = [
  'single_select',
  'multi_select',
  'toggle',
  'quantity',
  'text_input',
  'textarea',
  'image_cards',
  'range_slider',
  'color_selector',
  'step_selector',
  'upload_image',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const MODIFIER_TYPES = ['fixed', 'percent', 'multiplier', 'per_quantity'] as const;
export type ModifierType = (typeof MODIFIER_TYPES)[number];

export const RULE_EFFECTS = [
  'add_price',
  'add_percent',
  'add_duration',
  'block_booking',
  'require_lead_days',
] as const;
export type RuleEffect = (typeof RULE_EFFECTS)[number];

export type RuleOperator = 'equals' | 'in' | 'gte' | 'lte' | 'truthy' | 'falsy';

export interface ModifierOption {
  id: string;
  label: string;
  value?: string | null;
  imageUrl?: string | null;
  iconName?: string | null;
  modifierType: ModifierType;
  modifierValue: number;
  durationDelta: number;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  helpText?: string | null;
  fieldType: FieldType;
  displayType?: string | null;
  required?: boolean;
  sortOrder?: number;
  minValue?: number | null;
  maxValue?: number | null;
  stepValue?: number | null;
  defaultValue?: string | null;
  options: ModifierOption[];
}

export interface ConditionalRule {
  id: string;
  name: string;
  conditions: Array<{
    groupId: string;
    operator: RuleOperator;
    value?: unknown;
  }>;
  effect: RuleEffect;
  effectValue: { value?: number; days?: number };
  isActive?: boolean;
  sortOrder?: number;
}

export interface ServiceForPricing {
  id: string;
  pricePen: number | string;
  duration: number;
  modifierGroups?: ModifierGroup[];
  conditionalRules?: ConditionalRule[];
}

export type Selection = {
  optionIds?: string[];
  value?: unknown;
  quantity?: number;
};
export type Selections = Record<string, Selection>;

export interface PriceBreakdownItem {
  kind: 'option' | 'rule';
  groupId?: string;
  groupName?: string;
  optionId?: string;
  label: string;
  delta: number;
  durationDelta: number;
}

export interface PriceResult {
  basePrice: number;
  baseDuration: number;
  totalPrice: number;
  totalDuration: number;
  breakdown: PriceBreakdownItem[];
  blocked: boolean;
  blockedReasons: string[];
  requiresLeadDays: number | null;
}

// ── Helpers ──────────────────────────────────────────────────

function toNum(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function applyModifier(basePrice: number, opt: ModifierOption, quantity = 1): number {
  const value = toNum(opt.modifierValue);
  switch (opt.modifierType) {
    case 'fixed':        return value;
    case 'percent':      return basePrice * (value / 100);
    case 'multiplier':   return basePrice * (value - 1);
    case 'per_quantity': return value * Math.max(0, quantity);
    default:             return 0;
  }
}

function evaluateOneCondition(cond: ConditionalRule['conditions'][number], selections: Selections): boolean {
  if (!cond || !cond.groupId) return false;
  const sel = selections[cond.groupId];
  if (!sel) return cond.operator === 'falsy';

  switch (cond.operator) {
    case 'equals':
      return (
        (sel.optionIds || []).includes(String(cond.value)) ||
        String(sel.value) === String(cond.value)
      );
    case 'in':
      return (
        Array.isArray(cond.value) &&
        cond.value.some(
          (v) => (sel.optionIds || []).includes(String(v)) || String(sel.value) === String(v),
        )
      );
    case 'gte': return toNum(sel.value ?? sel.quantity) >= toNum(cond.value);
    case 'lte': return toNum(sel.value ?? sel.quantity) <= toNum(cond.value);
    case 'truthy': return Boolean(sel.value || (sel.optionIds && sel.optionIds.length > 0));
    case 'falsy':  return !(sel.value || (sel.optionIds && sel.optionIds.length > 0));
    default: return false;
  }
}

function evaluateConditions(conds: ConditionalRule['conditions'], selections: Selections): boolean {
  if (!Array.isArray(conds) || conds.length === 0) return false;
  return conds.every((c) => evaluateOneCondition(c, selections));
}

// Normaliza la selección del cliente a la forma canónica
export function normalizeSelection(raw: unknown): Selections {
  if (!raw || typeof raw !== 'object') return {};
  const out: Selections = {};
  for (const [groupId, sel] of Object.entries(raw as Record<string, unknown>)) {
    if (sel == null) continue;
    if (Array.isArray(sel)) {
      out[groupId] = { optionIds: sel.filter((v): v is string => typeof v === 'string') };
    } else if (typeof sel === 'object') {
      const s = sel as Record<string, unknown>;
      out[groupId] = {
        optionIds: Array.isArray(s.optionIds)
          ? (s.optionIds as unknown[]).filter((v): v is string => typeof v === 'string')
          : [],
        value: s.value,
        quantity: toNum(s.quantity, 1),
      };
    } else if (typeof sel === 'string') {
      out[groupId] = { optionIds: [sel] };
    } else if (typeof sel === 'boolean') {
      out[groupId] = { value: sel };
    } else if (typeof sel === 'number') {
      out[groupId] = { value: sel, quantity: sel };
    }
  }
  return out;
}

// ── API principal ────────────────────────────────────────────

export function calculatePrice(service: ServiceForPricing, rawSelection: unknown): PriceResult {
  const basePrice = toNum(service.pricePen);
  const baseDuration = toNum(service.duration, 0);
  const selections = normalizeSelection(rawSelection);

  let totalPrice = basePrice;
  let totalDuration = baseDuration;
  const breakdown: PriceBreakdownItem[] = [];
  const blockedReasons: string[] = [];
  let blocked = false;
  let requiresLeadDays: number | null = null;

  // 1) Modificadores de opciones
  for (const group of service.modifierGroups || []) {
    const sel = selections[group.id];
    if (!sel) continue;
    const selectedOptionIds = Array.isArray(sel.optionIds) ? sel.optionIds : [];
    const quantity = toNum(sel.quantity, 1);

    for (const optId of selectedOptionIds) {
      const opt = (group.options || []).find((o) => o.id === optId);
      if (!opt) continue;
      const delta = applyModifier(basePrice, opt, quantity);
      const durDelta = toNum(opt.durationDelta, 0);
      totalPrice += delta;
      totalDuration += durDelta;
      breakdown.push({
        kind: 'option',
        groupId: group.id,
        groupName: group.name,
        optionId: opt.id,
        label: opt.label,
        delta: round2(delta),
        durationDelta: durDelta,
      });
    }
  }

  // 2) Reglas condicionales
  for (const rule of service.conditionalRules || []) {
    if (rule.isActive === false) continue;
    const conds = Array.isArray(rule.conditions) ? rule.conditions : [];
    const matches = evaluateConditions(conds, selections);
    if (!matches) continue;

    const ev = rule.effectValue || {};
    const val = toNum(ev.value);

    switch (rule.effect) {
      case 'add_price':
        totalPrice += val;
        breakdown.push({ kind: 'rule', label: rule.name, delta: round2(val), durationDelta: 0 });
        break;
      case 'add_percent': {
        const d = basePrice * (val / 100);
        totalPrice += d;
        breakdown.push({ kind: 'rule', label: rule.name, delta: round2(d), durationDelta: 0 });
        break;
      }
      case 'add_duration':
        totalDuration += val;
        breakdown.push({ kind: 'rule', label: rule.name, delta: 0, durationDelta: val });
        break;
      case 'block_booking':
        blocked = true;
        blockedReasons.push(rule.name || 'Reserva bloqueada');
        break;
      case 'require_lead_days': {
        const d = toNum(ev.days);
        requiresLeadDays = Math.max(requiresLeadDays || 0, d);
        break;
      }
    }
  }

  return {
    basePrice: round2(basePrice),
    baseDuration,
    totalPrice: round2(totalPrice),
    totalDuration,
    breakdown,
    blocked,
    blockedReasons,
    requiresLeadDays,
  };
}

export function validateRequired(service: ServiceForPricing, rawSelection: unknown) {
  const selections = normalizeSelection(rawSelection);
  const errors: { groupId: string; name: string; error: string }[] = [];
  for (const g of service.modifierGroups || []) {
    if (!g.required) continue;
    const sel = selections[g.id];
    const hasOpt = sel && Array.isArray(sel.optionIds) && sel.optionIds.length > 0;
    const hasValue = sel && sel.value !== undefined && sel.value !== '' && sel.value !== null;
    if (!hasOpt && !hasValue) {
      errors.push({ groupId: g.id, name: g.name, error: 'Selección requerida' });
    }
  }
  return errors;
}

// Selección por defecto a partir de los valores marcados como `isDefault`
export function buildDefaultSelections(groups: ModifierGroup[] | undefined): Selections {
  const out: Selections = {};
  if (!groups) return out;
  for (const g of groups) {
    const defaults = (g.options || []).filter((o) => o.isDefault).map((o) => o.id);
    if (defaults.length > 0) {
      out[g.id] = { optionIds: g.fieldType === 'single_select' ? defaults.slice(0, 1) : defaults };
    } else if (g.fieldType === 'quantity' || g.fieldType === 'step_selector' || g.fieldType === 'range_slider') {
      const def = g.defaultValue != null && g.defaultValue !== '' ? Number(g.defaultValue) : (g.minValue ?? 0);
      out[g.id] = { value: def, quantity: def };
    } else if (g.fieldType === 'toggle') {
      out[g.id] = { value: false };
    }
  }
  return out;
}

export function formatPriceDelta(n: number): string {
  if (n === 0) return '';
  const sign = n > 0 ? '+' : '−';
  return `${sign}S/${Math.abs(n).toFixed(2)}`;
}

export function formatPricePen(n: number): string {
  return `S/${n.toFixed(2)}`;
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
