import { derive } from '../derive';
import type { CompetitionId, PlaceRange, TournamentState } from '../types';
import { entryView, type EntryView } from './competitions';

export interface FinalPlaceView {
  /** A single place (from === to) or a shared range such as 5–8. */
  place: PlaceRange;
  entry: EntryView;
}

export interface FinalPlacesView {
  /** The entries whose place is decided so far, by place; within a shared range, top to bottom of the draw. */
  rows: FinalPlaceView[];
  /** Every entry has its place. */
  complete: boolean;
}

/**
 * Final places of a competition, from the `places` metadata of its last stage's matches: each
 * decided match gives its winner and loser the places it decides. A shared range only counts the
 * entries that can land in it, so with BYEs 13 entries in 16 give the round-1 losers 9–13, not 9–16.
 * Groups-only competitions have no such metadata yet, so they give no rows.
 */
export function getFinalPlaces(state: TournamentState, id: CompetitionId): FinalPlacesView | null {
  const competition = state.competitions.find((c) => c.id === id);
  if (!competition) return null;
  const stage = competition.stages.at(-1);
  if (!stage) return { rows: [], complete: false };
  const derived = derive(state);

  // How many entries each range will hold: one per side of a match that assigns it, unless that side is a BYE.
  const capacity = new Map<string, number>();
  const key = (range: PlaceRange) => `${range.from}-${range.to}`;
  const placed: FinalPlaceView[] = [];
  for (const match of stage.matches) {
    if (!match.places) continue;
    const view = derived.match(match.id)!;
    for (const take of ['winner', 'loser'] as const) {
      const range = match.places[take];
      if (!range) continue;
      const side = view.winner === null ? null : take === 'winner' ? view.winner : 1 - view.winner;
      const byeSide = view.decidedByBye && take === 'loser';
      if (byeSide) continue;
      capacity.set(key(range), (capacity.get(key(range)) ?? 0) + 1);
      const entry = side === null ? null : view.entries[side];
      if (entry) placed.push({ place: range, entry: entryView(state, entry) });
    }
  }

  const rows = placed
    .map((row) => ({ ...row, place: { from: row.place.from, to: row.place.from + (capacity.get(key(row.place)) ?? 1) - 1 } }))
    .sort((a, b) => a.place.from - b.place.from); // stable: draw order within a range
  return { rows, complete: competition.entries.length > 0 && rows.length === competition.entries.length };
}
