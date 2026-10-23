import { fail, ok, type Result } from './result';
import type { TournamentId, TournamentState } from './types';
import { isIsoDate } from './validation';
import { DEFAULT_EXPECTED_DURATIONS } from './overdue';

export interface CreateTournamentInput {
  /** Chosen by the caller (the app generates it); the engine never makes random ids. */
  id: TournamentId;
  name: string;
  date: string;
  venue: string;
}

export function createTournament(input: CreateTournamentInput): Result<TournamentState> {
  const name = input.name.trim();
  if (!name) return fail({ code: 'required', field: 'name' });
  if (!isIsoDate(input.date)) return fail({ code: 'invalidDate', field: 'date' });
  return ok({
    id: input.id,
    name,
    date: input.date,
    venue: input.venue.trim(),
    tables: [],
    players: [],
    competitions: [],
    expectedDurations: { ...DEFAULT_EXPECTED_DURATIONS },
    nextId: 1,
    log: [],
  });
}
