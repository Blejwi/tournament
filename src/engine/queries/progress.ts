import type { CompetitionId, TournamentState } from '../types';
import { getFinalPlaces } from './places';

export interface CompetitionProgressView {
  id: CompetitionId;
  name: string;
  /** Every entry has its final place (the same rule as `getFinalPlaces(...).complete`). */
  finished: boolean;
}

export interface TournamentProgressView {
  /** At least one competition has entries and every competition with entries is finished. */
  finished: boolean;
  /** The competitions that have entries, in tab order; a competition without entries is left out. */
  competitions: CompetitionProgressView[];
}

/** Which competitions are finished, and whether the whole tournament is (it can then be printed). */
export function getTournamentProgress(state: TournamentState): TournamentProgressView {
  const competitions = state.competitions
    .filter((c) => c.entries.length > 0)
    .map((c) => ({ id: c.id, name: c.name, finished: getFinalPlaces(state, c.id)?.complete ?? false }));
  return { finished: competitions.length > 0 && competitions.every((c) => c.finished), competitions };
}
