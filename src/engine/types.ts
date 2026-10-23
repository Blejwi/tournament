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

/** Expected duration of a match in whole minutes, for each games-to-win value (overdue detection). */
export type ExpectedDurations = Record<GamesToWin, number>;

/** A player's place in one competition. Singles only in v1, but the shape allows 1..n players. */
export interface Entry {
  id: EntryId;
  players: PlayerId[];
  /** Explicit ranking number that fixes the entry's place in the draw; null = placed at random. */
  seed: number | null;
  /**
   * When the player withdrew from the competition (`withdrawPlayer`); null while still in it.
   * Every match of a withdrawn entry that has no result is a walkover for the opponent (derived, never stored).
   */
  withdrawnAt: Timestamp | null;
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
 * The recorded outcome of a match, slot A first. `gamesOnly` (e.g. 3:1) is for stages that allow it
 * (brackets); groups need the points of every game. The special results name their winner (slot index).
 */
export type MatchResult = { kind: 'games'; games: GameScore[] } | { kind: 'gamesOnly'; games: [number, number] } | SpecialResult;

/**
 * - walkover: won without playing, because the opponent did not play
 * - retirement: the opponent stopped part-way; `games` are the games completed so far (they count in the ratios)
 * - disqualification: the opponent was disqualified
 */
export type SpecialResult =
  | { kind: 'walkover'; winner: 0 | 1 }
  | { kind: 'retirement'; winner: 0 | 1; games: GameScore[] }
  | { kind: 'disqualification'; winner: 0 | 1 };

export type SpecialResultKind = SpecialResult['kind'];

/**
 * A part of a bracket stage, drawn as its own labelled block on the canvas.
 * - main: the single elimination tree
 * - thirdPlace: the optional 3rd-place match
 * - winners, losers, secondFinal: the three parts of a double elimination bracket (ADR 0002)
 * Place play-offs add their sections here.
 */
export type BracketSection = 'main' | 'thirdPlace' | 'winners' | 'losers' | 'secondFinal';

/** Where a match sits inside its stage: a group, or a section of a bracket. */
export type MatchLocation = { kind: 'group'; group: GroupId } | { kind: 'bracket'; section: BracketSection };

/** A single place (`from === to`) or a shared place range such as 5–8. */
export interface PlaceRange {
  from: number;
  to: number;
}

/**
 * The final places a match decides (spec: "places" metadata), e.g. a final: winner 1, loser 2;
 * a quarter-final: loser 5–8. Null where the entry plays on (a semi-final winner).
 */
export interface MatchPlaces {
  winner: PlaceRange | null;
  loser: PlaceRange | null;
}

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
  /** The final places this match decides; bracket matches only (group places come from the standings). */
  places?: MatchPlaces;
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
  /** The operator's orders for ties the tiebreak rules can't break (see `resolveTie`). */
  tieResolutions: TieResolution[];
}

/**
 * The operator's order for a set of entries the ITTF tiebreak can't separate. It applies while
 * exactly these entries are tied; if a correction changes the tie, the tie is flagged again.
 */
export interface TieResolution {
  /** Best first. */
  entries: EntryId[];
  /** A manual decision, or drawn by lot. */
  method: 'decision' | 'lot';
}

export interface GroupsStage extends StageBase {
  type: 'groups';
  grouping: Grouping;
  groups: Group[];
  /**
   * For a groups stage fed by an earlier groups stage (groups → groups): two entries that already
   * met in the earlier stage don't play again, their result there counts (carry-over). Turned
   * off, they play again. A first stage ignores it.
   */
  carryOver: boolean;
}

/**
 * A single elimination bracket of 8, 16, 32 or 64 positions. The bracket's matches carry it all:
 * round 1 holds the draw (entries and BYEs), later rounds point to "winner of match X" (ADR 0003).
 */
export interface SingleEliminationStage extends StageBase {
  type: 'singleElimination';
  /** Whether the semi-final losers play a 3rd-place match (otherwise they share 3–4). */
  thirdPlace: boolean;
}

/**
 * A double elimination bracket of 8, 16, 32 or 64 positions, built like the 16-player paper sheet
 * (ADR 0002): the winners bracket (section `winners`, round 1 holds the draw), the losers bracket
 * (`losers`, round r = losers round LRr) and the 2nd final (`secondFinal`). The WB final winner is
 * champion; there is no grand final. Every match carries its `places`.
 */
export interface DoubleEliminationStage extends StageBase {
  type: 'doubleElimination';
}

/**
 * One phase of a competition. Each stage type has a handler behind a common stage interface
 * (see stages/); play-offs join this union.
 */
export type Stage = GroupsStage | SingleEliminationStage | DoubleEliminationStage;
export type StageType = Stage['type'];

/** The options the operator picks per stage when configuring the chain. */
export type StageConfig =
  /** `carryOver` defaults to true; see `GroupsStage.carryOver`. */
  | { type: 'groups'; grouping: Grouping; carryOver?: boolean }
  | { type: 'singleElimination'; thirdPlace: boolean }
  | { type: 'doubleElimination' };

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
  /** How long a match is expected to take, per games-to-win value; a match on its table past that is overdue. */
  expectedDurations: ExpectedDurations;
  /** Counter for engine-made ids (tables, players, ...), so ids are never reused. */
  nextId: number;
  /**
   * The change log, oldest first: one entry per logged action, written by the command itself.
   * Read-only for the operator; the tournament file keeps it in its top-level `log` section.
   */
  log: LogEntry[];
}

/**
 * The match a change-log entry is about, as it was when the entry was written. Slots re-resolve
 * after a correction (ADR 0003), so the log keeps its own copy of who played.
 */
export interface LoggedMatch {
  competition: CompetitionId;
  stage: StageId;
  match: MatchId;
  /** The players in slot A and slot B at that moment; empty for a slot that wasn't decided. */
  players: [PlayerId[], PlayerId[]];
}

/** A table as it was when the entry was written (tables can be renumbered or removed later). */
export interface LoggedTable {
  table: TableId;
  number: number;
}

/** A place in a stage's draw as it was when an entry was written: who sat there (nobody for a BYE or a free place). */
export interface LoggedDrawPlace {
  /** The group's name ("A"); null in a bracket. */
  group: string | null;
  /** 1-based draw position (in the group, or in the first round of the bracket). */
  position: number;
  players: PlayerId[];
}

/**
 * One change-log entry: a timestamped record of an operator action, with enough detail to settle
 * a dispute (e.g. the old and new score). Data only, no display text. Adding an entry type:
 * see "How to add a change-log entry" in CLAUDE.md.
 */
export type LogEntry =
  /** A match was called to a table (`assignMatch`). */
  | { type: 'matchAssigned'; at: Timestamp; match: LoggedMatch; table: LoggedTable }
  /** A match was taken off its table (`unassignMatch`). */
  | { type: 'matchUnassigned'; at: Timestamp; match: LoggedMatch; table: LoggedTable }
  /** A score was entered (`recordResult`); `table` is where it was played, if it was called. */
  | { type: 'resultRecorded'; at: Timestamp; match: LoggedMatch; result: MatchResult; table: LoggedTable | null }
  /** Two draw positions traded places before the draw was confirmed (`swapSlots`); players as they were before. */
  | { type: 'drawSlotsSwapped'; at: Timestamp; competition: CompetitionId; stage: StageId; a: LoggedDrawPlace; b: LoggedDrawPlace }
  /** A player was moved to another draw position (`movePlayer`); `from` and `to` as they were before. */
  | { type: 'drawPlayerMoved'; at: Timestamp; competition: CompetitionId; stage: StageId; from: LoggedDrawPlace; to: LoggedDrawPlace }
  /** A walkover, retirement or disqualification was entered (`recordResult`); `table` is where it was called, if it was. */
  | { type: 'specialResultRecorded'; at: Timestamp; match: LoggedMatch; result: SpecialResult; table: LoggedTable | null }
  /** A player withdrew from a competition (`withdrawPlayer`); `players` are the entry's players. */
  | { type: 'playerWithdrew'; at: Timestamp; competition: CompetitionId; players: PlayerId[] }
  /** A recorded result was changed (`correctResult`); `reset` are the later matches that were reset, as they were before. */
  | { type: 'resultCorrected'; at: Timestamp; match: LoggedMatch; before: MatchResult; after: MatchResult; reset: LoggedMatch[] };

export type LogEntryType = LogEntry['type'];
