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

/** Milliseconds since the Unix epoch. Always passed into the engine (`at`, `now`), never read from a clock. */
export type Timestamp = number;

export type CompetitionId = string;
export type EntryId = string;
export type StageId = string;
export type GroupId = string;
export type MatchId = string;

/** How many games decide a match. */
export type GamesToWin = 2 | 3 | 4;

/** A player's place in one competition. Singles only in v1, but the shape allows 1..n players. */
export interface Entry {
  id: EntryId;
  players: PlayerId[];
  /** Explicit ranking number that fixes the entry's place in the draw; null = placed at random. */
  seed: number | null;
}

/**
 * Where a slot's player comes from (ADR 0003). Slots never copy a player: who plays is
 * resolved from the results every time it's needed, so a correction only re-resolves.
 */
export type SlotSource =
  /** A fixed entry, e.g. in a first-stage group. */
  | { kind: 'entry'; entry: EntryId }
  /** An origin label such as "1A": the entry that finishes `place` in a group of an earlier stage. */
  | { kind: 'groupPlace'; stage: StageId; group: GroupId; place: number }
  /** The winner or loser of an earlier match. */
  | { kind: 'matchResult'; match: MatchId; take: 'winner' | 'loser' }
  /** An empty bracket position. */
  | { kind: 'bye' };

/** One game's points, slot A's first: [11, 7]. */
export type GameScore = [number, number];

/**
 * The recorded outcome of a match. Later kinds (walkover, retirement, disqualification)
 * join this union; `winner` is the slot index (0 = A, 1 = B).
 */
export type MatchResult = { kind: 'games'; games: GameScore[] } | { kind: 'gamesOnly'; games: [number, number] };

/** Where a match sits inside its stage. Bracket stages add their own kinds (sections). */
export type MatchLocation = { kind: 'group'; group: GroupId };

export interface Match {
  id: MatchId;
  location: MatchLocation;
  /** 1-based round within the stage (a Berger round in a group). */
  round: number;
  /** 1-based order within the round. */
  order: number;
  slots: [SlotSource, SlotSource];
  /** The table the match was called to; kept after the match finishes (history and stats). */
  table: TableId | null;
  /** When the match was called to its table: the match clock starts here. */
  assignedAt: Timestamp | null;
  result: MatchResult | null;
  finishedAt: Timestamp | null;
}

/** notDrawn → drawn (editable, re-drawable) → confirmed (locked, playable). */
export type DrawState = 'notDrawn' | 'drawn' | 'confirmed';

interface StageBase {
  id: StageId;
  drawState: DrawState;
  matches: Match[];
}

/** How a groups stage splits its entries: a number of groups, or a group size (uneven groups allowed). */
export type Grouping = { by: 'count'; groups: number } | { by: 'size'; size: number };

export interface Group {
  id: GroupId;
  /** "A", "B", ... */
  name: string;
  /**
   * The group's entries in draw position order (position 1 first), by source (ADR 0003):
   * fixed entries in a first stage, origin labels when fed by an earlier stage.
   */
  entries: SlotSource[];
}

export interface GroupsStage extends StageBase {
  type: 'groups';
  grouping: Grouping;
  groups: Group[];
}

/**
 * One phase of a competition. Each stage type has a handler behind a common stage interface
 * (see stages/); single elimination, double elimination and play-offs join this union.
 */
export type Stage = GroupsStage;
export type StageType = Stage['type'];

/** The options the operator picks per stage when configuring the chain. */
export type StageConfig = { type: 'groups'; grouping: Grouping };

export interface Competition {
  id: CompetitionId;
  name: string;
  gamesToWin: GamesToWin;
  entries: Entry[];
  /** The stage chain, in order: each stage is fed by the one before it. */
  stages: Stage[];
}

export interface TournamentState {
  id: TournamentId;
  name: string;
  /** ISO calendar date, YYYY-MM-DD. */
  date: string;
  venue: string;
  tables: Table[];
  players: Player[];
  competitions: Competition[];
  /** Counter for engine-made ids (tables, players, ...), so ids are never reused. */
  nextId: number;
}
