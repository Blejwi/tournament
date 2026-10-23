import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CanvasContext, type CanvasApi, type View } from './canvasContext';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * A pan/zoom surface: drag the background to pan, wheel (or the buttons, or + / - / F keys) to zoom.
 * `overlay` is drawn in screen space on top, given the current view (for popovers).
 */
export function Canvas(props: {
  children: ReactNode;
  /** Changing it re-fits the view (e.g. another competition). */
  fitKey: string;
  onBackgroundClick?: () => void;
  overlay?: (view: View) => ReactNode;
  className?: string;
  /** Replaces the default usage hint in the corner. */
  hint?: string;
}) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState(false);

  const zoomAround = useCallback((factor: number, cx?: number, cy?: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const px = cx ?? vp.clientWidth / 2;
    const py = cy ?? vp.clientHeight / 2;
    setView((v) => {
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    });
  }, []);

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const world = worldRef.current;
    if (!vp || !world) return;
    const [ww, wh] = [world.offsetWidth, world.offsetHeight];
    // Never below 60% on fit, so cards stay legible; pan for the rest.
    const k = clamp(Math.min((vp.clientWidth - 48) / ww, (vp.clientHeight - 48) / wh, 1), 0.6, 1);
    setView({ k, x: Math.max(16, (vp.clientWidth - ww * k) / 2), y: Math.max(16, (vp.clientHeight - wh * k) / 2) });
  }, []);

  useLayoutEffect(fit, [fit, props.fitKey]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      zoomAround(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [zoomAround]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') zoomAround(1.25);
      else if (e.key === '-') zoomAround(0.8);
      else if (e.key === 'f' || e.key === 'F' || e.key === '0') fit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomAround, fit]);

  const api: CanvasApi = {
    worldRectOf(el) {
      const world = worldRef.current!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: (r.left - world.left) / view.k, y: (r.top - world.top) / view.k, w: r.width / view.k, h: r.height / view.k };
    },
    reveal(rect) {
      const vp = viewportRef.current;
      if (!vp) return;
      setView((v) => {
        const [sx, sy] = [v.x + rect.x * v.k, v.y + rect.y * v.k];
        const visible = sx >= 8 && sy >= 8 && sx + rect.w * v.k + 360 <= vp.clientWidth && sy + rect.h * v.k <= vp.clientHeight - 8;
        if (visible) return v;
        return { ...v, x: Math.max(16, (vp.clientWidth - rect.w * v.k - 360) / 2) - rect.x * v.k, y: vp.clientHeight / 4 - rect.y * v.k };
      });
    },
  };

  const grid = 24 * view.k;
  return (
    <CanvasContext.Provider value={api}>
      <div className={cn('relative min-h-0 overflow-hidden', props.className)}>
        <div
          ref={viewportRef}
          role="region"
          aria-label={t('play.canvas')}
          className="absolute inset-0 touch-none bg-slate-100"
          style={{
            cursor: dragging ? 'grabbing' : 'grab',
            backgroundImage: 'radial-gradient(#c5cfdb 1px, transparent 1px)',
            backgroundSize: `${grid}px ${grid}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
          onPointerDown={(e) => {
            if (e.button !== 0 || (e.target as Element).closest('[data-nopan], button, input, select, a')) return;
            drag.current = { startX: e.clientX, startY: e.clientY, x: view.x, y: view.y, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const [dx, dy] = [e.clientX - d.startX, e.clientY - d.startY];
            if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) {
              d.moved = true;
              setDragging(true);
            }
            if (d.moved) setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy }));
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            setDragging(false);
            if (d && !d.moved) props.onBackgroundClick?.();
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(false);
          }}
        >
          <div
            ref={worldRef}
            className="absolute top-0 left-0 w-max"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0' }}
          >
            {props.children}
          </div>
        </div>
        <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-md bg-white/80 px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
          {props.hint ?? t('play.hint')}
        </div>
        <div data-nopan className="absolute right-3 bottom-3 z-10 flex items-center rounded-lg bg-white text-sm shadow ring-1 ring-slate-200">
          <button type="button" className="size-8 rounded-l-lg hover:bg-slate-100" aria-label={t('play.zoomOut')} title={t('play.zoomOut')} onClick={() => zoomAround(0.8)}>
            <Minus className="mx-auto size-4" />
          </button>
          <button
            type="button"
            className="h-8 w-12 text-xs tabular-nums hover:bg-slate-100"
            title={t('play.resetZoom')}
            aria-label={t('play.resetZoom')}
            onClick={() => zoomAround(1 / view.k)}
          >
            {Math.round(view.k * 100)}%
          </button>
          <button type="button" className="size-8 hover:bg-slate-100" aria-label={t('play.zoomIn')} title={t('play.zoomIn')} onClick={() => zoomAround(1.25)}>
            <Plus className="mx-auto size-4" />
          </button>
          <button type="button" className="flex h-8 items-center gap-1 rounded-r-lg border-l border-slate-200 px-3 text-xs font-semibold hover:bg-slate-100" onClick={fit}>
            <Maximize className="size-3.5" aria-hidden />
            {t('play.fit')}
          </button>
        </div>
        {props.overlay?.(view)}
      </div>
    </CanvasContext.Provider>
  );
}
