import { exportTournament, importTournament, type TournamentId, type TournamentState } from '@/engine';
import type { TournamentStorage, TournamentSummary } from './storage';

const INDEX_KEY = 'tm:tournaments';
const tournamentKey = (id: TournamentId) => `tm:tournament:${id}`;

function readIndexJson(store: Storage): TournamentSummary[] | null {
  const raw = store.getItem(INDEX_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as TournamentSummary[];
  } catch {
    return null;
  }
}

const summaryOf = (s: TournamentState): TournamentSummary => ({
  id: s.id,
  name: s.name,
  date: s.date,
  venue: s.venue,
});

/**
 * Stores a tournament index plus one document per tournament in the browser's localStorage.
 * Each document is a tournament file (the export format), so stored tournaments from older
 * versions are validated and migrated by the engine exactly like imported files.
 */
export function createLocalStorageAdapter(store: Storage = window.localStorage): TournamentStorage {
  const readIndex = () => readIndexJson(store) ?? [];
  const writeIndex = (index: TournamentSummary[]) => store.setItem(INDEX_KEY, JSON.stringify(index));

  return {
    listTournaments: readIndex,

    loadTournament(id) {
      const file = store.getItem(tournamentKey(id));
      if (file === null) return null;
      const result = importTournament({ id, file });
      return result.ok ? result.value : null;
    },

    saveTournament(state) {
      store.setItem(tournamentKey(state.id), exportTournament(state));
      const index = readIndex();
      const at = index.findIndex((row) => row.id === state.id);
      if (at === -1) index.push(summaryOf(state));
      else index[at] = summaryOf(state);
      writeIndex(index);
    },

    deleteTournament(id) {
      store.removeItem(tournamentKey(id));
      writeIndex(readIndex().filter((row) => row.id !== id));
    },
  };
}
