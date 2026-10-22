import { useMemo } from 'react';
import { useStore } from 'zustand';
import type { TournamentState } from '@/engine';
import { createLocalStorageAdapter } from '@/storage/localStorageAdapter';
import { createAppStore, type AppState } from './store';

/** The app's single store, saving to the browser's localStorage. */
export const appStore = createAppStore(createLocalStorageAdapter(), () => crypto.randomUUID());

/** React hook: select a slice of the app state. */
export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

/**
 * React hook: run an engine query on the open tournament. The query re-runs when the engine
 * state or one of `deps` (the query's other arguments, e.g. `now`) changes.
 * Don't call queries inside `useApp` selectors: they return new objects on every call,
 * which makes Zustand re-render forever.
 */
export function useQuery<T>(query: (state: TournamentState) => T, deps: readonly unknown[] = []): T | null {
  const current = useApp((s) => s.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- queries are pure; state + deps are the inputs
  return useMemo(() => (current ? query(current) : null), [current, ...deps]);
}
