import { useSyncExternalStore } from 'react';

/**
 * Where losers are drawn (#0023): `left` mirrors them (a double elimination losers bracket runs
 * leftwards beside the winners bracket; a play-off's losers half sits to its left), `below` keeps
 * everything flowing right, losers underneath.
 * A display preference of this device, so it lives in localStorage, not in the tournament.
 */
export type PlayOffLayout = 'left' | 'below';

const KEY = 'tm:view:playOffLayout';
const listeners = new Set<() => void>();

function read(): PlayOffLayout {
  try {
    return localStorage.getItem(KEY) === 'below' ? 'below' : 'left';
  } catch {
    return 'left';
  }
}

function write(layout: PlayOffLayout) {
  try {
    localStorage.setItem(KEY, layout);
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded.
  }
  current = layout;
  listeners.forEach((l) => l());
}

let current = read();

// Another window changed the choice (the operator's, while a display is open): follow it.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return;
    current = read();
    listeners.forEach((l) => l());
  });
}

export function usePlayOffLayout(): [PlayOffLayout, (layout: PlayOffLayout) => void] {
  const layout = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
  return [layout, write];
}
