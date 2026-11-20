import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Never blow small content up beyond this, so a lone group doesn't fill the whole screen. */
const MAX_SCALE = 2;
const MARGIN = 24;

/**
 * Shows its content as large as fits the space, centred, with no pan, zoom or scrolling.
 * Fits again whenever the space or the content changes size (a resize, a result that adds a round).
 */
export function FitToScreen({ children, className }: { children: ReactNode; className?: string }) {
  const space = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ k: 1, x: 0, y: 0 });

  useLayoutEffect(() => {
    const [outer, inner] = [space.current, content.current];
    if (!outer || !inner) return;
    const update = () => {
      const [ow, oh] = [outer.clientWidth, outer.clientHeight];
      const [iw, ih] = [inner.offsetWidth, inner.offsetHeight];
      if (!iw || !ih) return;
      const k = Math.min((ow - MARGIN) / iw, (oh - MARGIN) / ih, MAX_SCALE);
      setFit((prev) => {
        const next = { k, x: (ow - iw * k) / 2, y: (oh - ih * k) / 2 };
        return prev.k === next.k && prev.x === next.x && prev.y === next.y ? prev : next;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={space} className={`relative overflow-hidden ${className ?? ''}`}>
      <div
        ref={content}
        className="pointer-events-none absolute top-0 left-0 w-max select-none"
        style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})`, transformOrigin: '0 0' }}
      >
        {children}
      </div>
    </div>
  );
}
