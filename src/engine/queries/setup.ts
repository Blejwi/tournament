import type { ExpectedDurations, PlayerId, TableId, TournamentId, TournamentState } from '../types';

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

/** Expected match duration in minutes for each games-to-win value. */
export function getExpectedDurations(state: TournamentState): ExpectedDurations {
  return { ...state.expectedDurations };
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

/**
 * Short names for the second screen (#0028), by player id: last name and first initial, "Kowalski J.".
 * Players whose short names would be the same (case and surrounding spaces ignored) get the full first
 * name instead, "Kowalski Jan" and "Kowalski Jakub"; the others keep the short form. Built from all
 * registered players, so a name reads the same everywhere on the display.
 */
export function getDisplayNames(state: TournamentState): Record<PlayerId, string> {
  const parts = state.players.map((p) => ({ id: p.id, first: p.firstName.trim(), last: p.lastName.trim() }));
  const short = (p: { first: string; last: string }) => [p.last, p.first ? `${[...p.first][0]}.` : ''].filter(Boolean).join(' ');
  const full = (p: { first: string; last: string }) => [p.last, p.first].filter(Boolean).join(' ');
  const count = new Map<string, number>();
  for (const p of parts) count.set(short(p).toLowerCase(), (count.get(short(p).toLowerCase()) ?? 0) + 1);
  return Object.fromEntries(parts.map((p) => [p.id, (count.get(short(p).toLowerCase()) ?? 0) > 1 ? full(p) : short(p)]));
}
