import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  createTournament,
  execute,
  type Command,
  type CreateTournamentInput,
  type EngineError,
  type TournamentId,
  type TournamentState,
} from '@/engine';
import type { TournamentStorage, TournamentSummary } from '@/storage/storage';

/**
 * Thin app state over the engine: holds the open tournament, dispatches commands to
 * the engine and autosaves through the storage interface after every successful command.
 * No tournament rules live here.
 */
export interface AppState {
  /** The tournament list, from the storage index. */
  tournaments: TournamentSummary[];
  /** The open tournament's engine state, or null on the tournament list screen. */
  current: TournamentState | null;

  createTournament(input: Omit<CreateTournamentInput, 'id'>): { id: TournamentId } | { error: EngineError };
  /** Loads a tournament from storage; returns false when it doesn't exist. */
  openTournament(id: TournamentId): boolean;
  closeTournament(): void;
  deleteTournament(id: TournamentId): void;
  /** Runs an engine command on the open tournament. Returns the engine error, or null on success. */
  dispatch(command: Command): EngineError | null;
}

export type AppStore = StoreApi<AppState>;

export function createAppStore(storage: TournamentStorage, newId: () => string): AppStore {
  return createStore<AppState>()((set, get) => {
    const refreshList = () => set({ tournaments: storage.listTournaments() });

    return {
      tournaments: storage.listTournaments(),
      current: null,

      createTournament(input) {
        const result = createTournament({ ...input, id: newId() });
        if (!result.ok) return { error: result.error };
        storage.saveTournament(result.value);
        refreshList();
        return { id: result.value.id };
      },

      openTournament(id) {
        if (get().current?.id === id) return true;
        const state = storage.loadTournament(id);
        set({ current: state });
        return state !== null;
      },

      closeTournament() {
        set({ current: null });
      },

      deleteTournament(id) {
        storage.deleteTournament(id);
        if (get().current?.id === id) set({ current: null });
        refreshList();
      },

      dispatch(command) {
        const current = get().current;
        if (!current) throw new Error('dispatch called with no open tournament');
        const result = execute(current, command);
        if (!result.ok) return result.error;
        storage.saveTournament(result.value);
        set({ current: result.value, tournaments: storage.listTournaments() });
        return null;
      },
    };
  });
}
