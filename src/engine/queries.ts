import type { PlayerId, TableId, TournamentId, TournamentState } from './types';

/**
 * Queries are pure functions of the state (plus `now` once a query depends on time).
 * They return fresh view objects, so callers can never mutate engine state through them.
 */

export interface TournamentView {
  id: TournamentId;
  name: string;
  date: string;
  venue: string;
}

export function getTournament(state: TournamentState): TournamentView {
  return { id: state.id, name: state.name, date: state.date, venue: state.venue };
}

export interface TableView {
  id: TableId;
  number: number;
  name: string;
  active: boolean;
}

/** All tables, ordered by number. */
export function getTables(state: TournamentState): TableView[] {
  return state.tables.map((t) => ({ ...t })).sort((a, b) => a.number - b.number);
}

export interface PlayerView {
  id: PlayerId;
  firstName: string;
  lastName: string;
  club: string;
  rating: number | null;
  birthYear: number | null;
}

const nameOrder = new Intl.Collator('pl', { sensitivity: 'base' });

/** All registered players, ordered by last name, then first name. */
export function getPlayers(state: TournamentState): PlayerView[] {
  return state.players
    .map((p) => ({ ...p }))
    .sort((a, b) => nameOrder.compare(a.lastName, b.lastName) || nameOrder.compare(a.firstName, b.firstName));
}
