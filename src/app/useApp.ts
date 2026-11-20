import { createContext, useContext, useMemo } from 'react';
import { useStore } from 'zustand';
import type { TournamentState } from '@/engine';
import { createLocalStorageAdapter } from '@/storage/localStorageAdapter';
import { createAppStore, type AppState } from './store';

/** The app's single store, saving to the browser's localStorage. */
export const appStorage = createLocalStorageAdapter();
export const appStore = createAppStore(appStorage, () => crypto.randomUUID());

/**
 * Gives `useQuery` a fixed tournament state instead of the operator store's: the read-only display
 * provides its own, so the play screen's components can be reused there without the store.
 */
export const TournamentStateContext = createContext<TournamentState | null>(null);

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
  const provided = useContext(TournamentStateContext);
  const stored = useApp((s) => s.current);
  const current = provided ?? stored;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- queries are pure; state + deps are the inputs
  return useMemo(() => (current ? query(current) : null), [current, ...deps]);
}
