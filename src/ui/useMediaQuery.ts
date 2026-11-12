import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query matches, kept up to date. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** Below Tailwind's `md` breakpoint: the play screen shows its panels as sheets over the canvas. */
export const useIsPhone = () => useMediaQuery('(max-width: 767px)');

/** A touch screen without a mouse: hints talk about fingers, not the wheel. */
export const useIsTouch = () => useMediaQuery('(pointer: coarse)');
