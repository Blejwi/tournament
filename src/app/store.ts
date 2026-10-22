import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  BACKUP_INTERVAL_MINUTES,
  createTournament,
  execute,
  exportTournament,
  importTournament,
  type Command,
  type CreateTournamentInput,
  type EngineError,
  type TournamentId,
  type TournamentState,
} from '@/engine';
import type { TournamentStorage, TournamentSummary } from '@/storage/storage';

/** What the backup reminder needs to know about the open tournament (see `getBackupReminder`). ISO times. */
export interface BackupTracking {
  lastChangeAt: string | null;
  unsavedSince: string | null;
  postponedUntil: string | null;
}

const NO_BACKUP_ACTIVITY: BackupTracking = { lastChangeAt: null, unsavedSince: null, postponedUntil: null };

/** "Import as new" (gets a fresh id) or "replace" an existing tournament (keeps its id). */
export type ImportTarget = { mode: 'new' } | { mode: 'replace'; id: TournamentId };

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
  /** Changes and backups of the open tournament in this session, for the backup reminder. */
  backup: BackupTracking;

  createTournament(input: Omit<CreateTournamentInput, 'id'>): { id: TournamentId } | { error: EngineError };
  /** Loads a tournament from storage; returns false when it doesn't exist. */
  openTournament(id: TournamentId): boolean;
  closeTournament(): void;
  deleteTournament(id: TournamentId): void;
  /** Runs an engine command on the open tournament. Returns the engine error, or null on success. */
  dispatch(command: Command): EngineError | null;
  /** Imports a tournament file. On an error nothing is saved or changed. */
  importTournament(file: string, target: ImportTarget): { id: TournamentId } | { error: EngineError };
  /** Returns the open tournament's file text for a backup download, and records the backup. */
  exportCurrent(): string;
  /** "Later" on the backup reminder: no reminder for one more interval. */
  postponeBackup(): void;
}

export type AppStore = StoreApi<AppState>;

const MINUTE = 60_000;

export function createAppStore(
  storage: TournamentStorage,
  newId: () => string,
  now: () => string = () => new Date().toISOString(),
): AppStore {
  return createStore<AppState>()((set, get) => {
    const refreshList = () => set({ tournaments: storage.listTournaments() });

    return {
      tournaments: storage.listTournaments(),
      current: null,
      backup: NO_BACKUP_ACTIVITY,

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
        set({ current: state, backup: NO_BACKUP_ACTIVITY });
        return state !== null;
      },

      closeTournament() {
        set({ current: null, backup: NO_BACKUP_ACTIVITY });
      },

      deleteTournament(id) {
        storage.deleteTournament(id);
        if (get().current?.id === id) set({ current: null, backup: NO_BACKUP_ACTIVITY });
        refreshList();
      },

      dispatch(command) {
        const current = get().current;
        if (!current) throw new Error('dispatch called with no open tournament');
        const result = execute(current, command);
        if (!result.ok) return result.error;
        storage.saveTournament(result.value);
        const at = now();
        const { backup } = get();
        set({
          current: result.value,
          tournaments: storage.listTournaments(),
          backup: { ...backup, lastChangeAt: at, unsavedSince: backup.unsavedSince ?? at },
        });
        return null;
      },

      importTournament(file, target) {
        const id = target.mode === 'new' ? newId() : target.id;
        const result = importTournament({ id, file });
        if (!result.ok) return { error: result.error };
        storage.saveTournament(result.value);
        // A replaced tournament that is open shows the imported data from now on.
        if (get().current?.id === id) set({ current: result.value, backup: NO_BACKUP_ACTIVITY });
        refreshList();
        return { id };
      },

      exportCurrent() {
        const current = get().current;
        if (!current) throw new Error('exportCurrent called with no open tournament');
        set({ backup: { ...get().backup, unsavedSince: null, postponedUntil: null } });
        return exportTournament(current);
      },

      postponeBackup() {
        const until = new Date(Date.parse(now()) + BACKUP_INTERVAL_MINUTES * MINUTE).toISOString();
        set({ backup: { ...get().backup, postponedUntil: until } });
      },
    };
  });
}
