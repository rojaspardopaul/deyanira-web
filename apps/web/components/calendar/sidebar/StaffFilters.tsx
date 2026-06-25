'use client';

import { STATUS, ALL_STATUSES } from '../status';
import { staffColor } from '../constants';
import { getCategoryTheme } from '@/lib/categoryTheme';
import type { AptStatus, StaffMember } from '../types';

type StaffFiltersProps = {
  staffList: StaffMember[];
  staffVisibility: Record<string, boolean>;
  onToggleStaff: (id: string) => void;
  hiddenStatuses: AptStatus[];
  onToggleStatus: (s: AptStatus) => void;
  categoryOptions: { slug: string; name: string }[];
  hiddenCategories: string[];
  onToggleCategory: (slug: string) => void;
};

export function StaffFilters({
  staffList, staffVisibility, onToggleStaff,
  hiddenStatuses, onToggleStatus,
  categoryOptions, hiddenCategories, onToggleCategory,
}: StaffFiltersProps) {
  return (
    <div className="flex flex-col gap-3 px-3 py-2 overflow-y-auto flex-1">

      {/* ── Estados ───────────────────────────────────── */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Estados</p>
        <div className="flex flex-col gap-0.5">
          {ALL_STATUSES.map(s => {
            const cfg     = STATUS[s];
            const visible = !hiddenStatuses.includes(s);
            return (
              <button
                key={s}
                onClick={() => onToggleStatus(s)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all w-full
                  ${visible ? 'hover:bg-gray-50' : 'opacity-40 hover:opacity-60'}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                <span className={`text-xs font-medium flex-1 ${visible ? 'text-gray-700' : 'text-gray-400'}`}>
                  {cfg.label}
                </span>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                  ${visible ? 'bg-gold-400 border-gold-400' : 'bg-white border-gray-300'}`}>
                  {visible && (
                    <svg className="w-2.5 h-2.5 text-gray-900" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Categorías ────────────────────────────────── */}
      {categoryOptions.length > 0 && (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Categorías</p>
          <div className="flex flex-col gap-0.5">
            {categoryOptions.map(cat => {
              const t       = getCategoryTheme(cat.slug, cat.name);
              const visible = !hiddenCategories.includes(cat.slug);
              return (
                <button
                  key={cat.slug}
                  onClick={() => onToggleCategory(cat.slug)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all w-full
                    ${visible ? 'hover:bg-gray-50' : 'opacity-40 hover:opacity-60'}`}
                >
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] leading-none shrink-0"
                    style={{ backgroundColor: t.soft }}
                  >
                    {t.emoji}
                  </span>
                  <span className={`text-xs font-medium flex-1 truncate ${visible ? 'text-gray-700' : 'text-gray-400'}`}>
                    {cat.name}
                  </span>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                    ${visible ? 'border-transparent' : 'bg-white border-gray-300'}`}
                    style={visible ? { backgroundColor: t.accent } : {}}
                  >
                    {visible && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Estilistas ────────────────────────────────── */}
      {staffList.length > 0 && (
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Estilistas</p>
          <div className="flex flex-col gap-0.5">
            {staffList.map((staff, idx) => {
              const visible = staffVisibility[staff.id] !== false;
              const color   = staffColor(idx);
              return (
                <button
                  key={staff.id}
                  onClick={() => onToggleStaff(staff.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all w-full
                    ${visible ? 'hover:bg-gray-50' : 'opacity-40 hover:opacity-60'}`}
                >
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className={`text-xs font-medium flex-1 truncate ${visible ? 'text-gray-700' : 'text-gray-400'}`}>
                    {staff.name}
                  </span>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                    ${visible ? 'border-transparent' : 'bg-white border-gray-300'}`}
                    style={visible ? { backgroundColor: color } : {}}
                  >
                    {visible && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
