import type { TournamentId, TournamentState } from '@/engine';

/** One row of the tournament list. Kept in a small index so the list loads without every tournament. */
export interface TournamentSummary {
  id: TournamentId;
  name: string;
  date: string;
  venue: string;
}

/**
 * Where tournaments are kept (ADR 0001). The app only talks to this interface,
 * so a different backend (e.g. sync) only needs a new adapter.
 */
export interface TournamentStorage {
  listTournaments(): TournamentSummary[];
  loadTournament(id: TournamentId): TournamentState | null;
  /** Saves the tournament document and updates its row in the index. */
  saveTournament(state: TournamentState): void;
  deleteTournament(id: TournamentId): void;
}
