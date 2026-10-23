import { derive } from '../derive';
import type { CompetitionId, Timestamp, TournamentState } from '../types';
import { matchView } from './matches';

/** How many of a competition's matches are in each state that needs the operator's eye (competition tabs). */
export interface MatchCountsView {
  competition: CompetitionId;
  ready: number;
  busy: number;
  /** On a table: in progress or overdue. */
  live: number;
  /** On a table past its expected duration (included in `live`). */
  overdue: number;
}

/** Match counts for every competition, in competition order. */
export function getMatchCounts(state: TournamentState, now: Timestamp): MatchCountsView[] {
  const counts = new Map<CompetitionId, MatchCountsView>(
    state.competitions.map((c) => [c.id, { competition: c.id, ready: 0, busy: 0, live: 0, overdue: 0 }]),
  );
  for (const derived of derive(state).matches) {
    const { status } = matchView(state, derived, now);
    const row = counts.get(derived.competition.id)!;
    if (status === 'ready') row.ready++;
    else if (status === 'busy') row.busy++;
    else if (status === 'in_progress') row.live++;
    else if (status === 'overdue') {
      row.live++;
      row.overdue++;
    }
  }
  return [...counts.values()];
}
