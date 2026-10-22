/** Engine state: one tournament. Plain, JSON-serialisable data only. */

export type TournamentId = string;
export type TableId = string;

export interface Table {
  id: TableId;
  /** The number painted on the physical table; unique within the tournament. */
  number: number;
  /** Optional; empty string when not set. */
  name: string;
  /** Inactive tables (broken, reserved) get no matches. */
  active: boolean;
}

export type PlayerId = string;

/** A person registered once per tournament; may later be entered in several competitions. */
export interface Player {
  id: PlayerId;
  firstName: string;
  lastName: string;
  /** Empty string when the player has no club. */
  club: string;
  rating: number | null;
  birthYear: number | null;
}

export interface TournamentState {
  id: TournamentId;
  name: string;
  /** ISO calendar date, YYYY-MM-DD. */
  date: string;
  venue: string;
  tables: Table[];
  players: Player[];
  /** Counter for engine-made ids (tables, players, ...), so ids are never reused. */
  nextId: number;
}
