import type { TournamentId, TournamentState } from '@/engine';
import type { TournamentStorage, TournamentSummary } from './storage';

/** Version of the stored document shape. Bump it and add a migration when TournamentState changes incompatibly. */
export const SCHEMA_VERSION = 1;

const INDEX_KEY = 'tm:tournaments';
const tournamentKey = (id: TournamentId) => `tm:tournament:${id}`;

interface StoredTournament {
  schemaVersion: number;
  tournament: TournamentState;
}

function readJson<T>(store: Storage, key: string): T | null {
  const raw = store.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
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

/** Stores a tournament index plus one document per tournament in the browser's localStorage. */
export function createLocalStorageAdapter(store: Storage = window.localStorage): TournamentStorage {
  const readIndex = () => readJson<TournamentSummary[]>(store, INDEX_KEY) ?? [];
  const writeIndex = (index: TournamentSummary[]) => store.setItem(INDEX_KEY, JSON.stringify(index));

  return {
    listTournaments: readIndex,

    loadTournament(id) {
      const doc = readJson<StoredTournament>(store, tournamentKey(id));
      if (!doc || doc.schemaVersion !== SCHEMA_VERSION) return null;
      return doc.tournament;
    },

    saveTournament(state) {
      const doc: StoredTournament = { schemaVersion: SCHEMA_VERSION, tournament: state };
      store.setItem(tournamentKey(state.id), JSON.stringify(doc));
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
