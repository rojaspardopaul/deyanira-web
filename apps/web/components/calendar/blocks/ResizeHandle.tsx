'use client';

/**
 * Invisible hit area at the bottom of an AptBlock used to resize its duration.
 * The visual indicator (a small horizontal bar) only appears on hover.
 * This component is embedded inside AptBlock when `resizable={true}`.
 */
export function ResizeHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize group/handle flex items-end justify-center pb-0.5"
      onPointerDown={e => { e.stopPropagation(); onPointerDown(e); }}
    >
      <div className="w-8 h-0.5 rounded-full bg-current opacity-0 group-hover/handle:opacity-30 transition-opacity" />
    </div>
  );
}
