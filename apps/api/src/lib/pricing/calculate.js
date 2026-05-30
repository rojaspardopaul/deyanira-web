// Motor de cálculo de precios para servicios con modificadores dinámicos.
// Usado tanto por el endpoint público (preview en tiempo real) como por la creación
// de citas (validación server-side anti-tampering).

const VALID_FIELD_TYPES = [
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
];

const VALID_MODIFIER_TYPES = ['fixed', 'percent', 'multiplier', 'per_quantity'];

const VALID_RULE_EFFECTS = [
  'add_price',
  'add_percent',
  'add_duration',
  'block_booking',
  'require_lead_days',
];

const VALID_RULE_OPERATORS = ['equals', 'in', 'gte', 'lte', 'truthy', 'falsy'];

// ── Helpers internos ─────────────────────────────────────────

function toNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Normaliza la selección del cliente:
//   { [groupId]: { optionIds?: string[], value?: any, quantity?: number } }
function normalizeSelection(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [groupId, sel] of Object.entries(raw)) {
    if (sel == null) continue;
    if (Array.isArray(sel)) {
      out[groupId] = { optionIds: sel.filter((v) => typeof v === 'string') };
    } else if (typeof sel === 'object') {
      out[groupId] = {
        optionIds: Array.isArray(sel.optionIds)
          ? sel.optionIds.filter((v) => typeof v === 'string')
          : [],
        value: sel.value,
        quantity: toNum(sel.quantity, 1),
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

// Aplica un modificador individual al precio base.
function applyModifier(basePrice, opt, quantity = 1) {
  const value = toNum(opt.modifierValue);
  switch (opt.modifierType) {
    case 'fixed':       return value;
    case 'percent':     return basePrice * (value / 100);
    case 'multiplier':  return basePrice * (value - 1);
    case 'per_quantity':return value * Math.max(0, quantity);
    default:            return 0;
  }
}

function evaluateOneCondition(cond, selections) {
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

function evaluateConditions(conditions, selections) {
  if (!Array.isArray(conditions) || conditions.length === 0) return false;
  return conditions.every((c) => evaluateOneCondition(c, selections));
}

// ── Validación de selección requerida ────────────────────────

function validateRequired(service, selections) {
  const errors = [];
  for (const g of service.modifierGroups || []) {
    if (!g.required) continue;
    const sel = selections[g.id];
    const hasOpt = sel && Array.isArray(sel.optionIds) && sel.optionIds.length > 0;
    const hasValue = sel && (sel.value !== undefined && sel.value !== '' && sel.value !== null);
    if (!hasOpt && !hasValue) {
      errors.push({ groupId: g.id, name: g.name, error: 'Selección requerida' });
    }
  }
  return errors;
}

// ── API principal ────────────────────────────────────────────
//
//   calculatePrice(service, rawSelection) → {
//     basePrice, basePriceDuration,
//     totalPrice, totalDuration,
//     breakdown: [{ kind, label, delta, durationDelta }],
//     blocked: boolean, blockedReasons: string[],
//     requiresLeadDays: number | null,
//   }

function calculatePrice(service, rawSelection) {
  const basePrice = toNum(service.pricePen);
  const baseDuration = toNum(service.duration, 0);
  const selections = normalizeSelection(rawSelection);

  let totalPrice = basePrice;
  let totalDuration = baseDuration;
  const breakdown = [];
  const blockedReasons = [];
  let blocked = false;
  let requiresLeadDays = null;

  // 1) Aplicar opciones seleccionadas
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

    // Para quantity / step_selector / range_slider: el valor numérico funciona como multiplicador
    if (
      (group.fieldType === 'quantity' || group.fieldType === 'step_selector' ||
       group.fieldType === 'range_slider') &&
      typeof sel.value === 'number'
    ) {
      // Si el grupo tiene una única opción "base" implícita y per_quantity, ya se aplicó arriba.
      // Si no hay opciones pero el grupo está marcado con price-per-unit en defaultValue, lo aplicamos.
      // (Caso simple: dejamos que la opción se encargue.)
    }
  }

  // 2) Aplicar reglas condicionales
  for (const rule of service.conditionalRules || []) {
    if (!rule.isActive) continue;
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

module.exports = {
  calculatePrice,
  validateRequired,
  normalizeSelection,
  VALID_FIELD_TYPES,
  VALID_MODIFIER_TYPES,
  VALID_RULE_EFFECTS,
  VALID_RULE_OPERATORS,
};
