import type { MatchStatus } from './derive';
import type { CompetitionId, EntryId, GroupId, MatchId, PlayerId, StageId, TableId } from './types';

/**
 * Typed engine errors. They carry a `code` and data only, never display text:
 * the UI translates them via the `errors.<code>` translation keys.
 */
export type EngineError =
  | { code: 'required'; field: string }
  | { code: 'invalidDate'; field: string }
  | { code: 'invalidTableNumber' }
  | { code: 'tableNumberTaken'; number: number }
  | { code: 'tableNotFound'; table: TableId }
  | { code: 'invalidRating' }
  | { code: 'invalidBirthYear' }
  | { code: 'playerNotFound'; player: PlayerId }
  | { code: 'invalidGamesToWin' }
  | { code: 'competitionNotFound'; competition: CompetitionId }
  | { code: 'entryNotFound'; entry: EntryId }
  | { code: 'alreadyEntered'; player: PlayerId }
  | { code: 'invalidSeed' }
  | { code: 'seedTaken'; seed: number }
  | { code: 'invalidGrouping' }
  | { code: 'unsupportedStageChain' }
  | { code: 'stageNotFound'; stage: StageId }
  | { code: 'stageNotDrawn' }
  | { code: 'stageConfirmed' }
  | { code: 'notEnoughEntries'; needed: number }
  | { code: 'tooManyEntries'; max: number }
  | { code: 'matchNotFound'; match: MatchId }
  /** The range isn't a shared place range of this stage that can have a play-off. */
  | { code: 'playOffNotFound'; from: number; to: number }
  /** A play-off can't be switched off while one of its matches is on a table. */
  | { code: 'playOffInProgress' }
  | { code: 'matchNotReady'; status: MatchStatus }
  | { code: 'matchNotOnTable' }
  | { code: 'matchFinished' }
  /** A correction needs a recorded result to change. */
  | { code: 'matchNotFinished' }
  /** Later matches already started or finished with a player the correction replaces: confirm with `force` to reset them. */
  | { code: 'correctionNeedsForce'; matches: MatchId[] }
  | { code: 'tableBusy'; number: number }
  | { code: 'tableInactive'; number: number }
  | { code: 'tableInUse'; number: number }
  | { code: 'gamePointsRequired' }
  | { code: 'groupNotFound'; group: GroupId }
  | { code: 'groupNotComplete' }
  | { code: 'tieNotFound' }
  | { code: 'invalidScoreFormat'; text: string }
  /** `game` is 1-based; `a` and `b` are the points as entered, slot A first. */
  | { code: 'invalidGame'; game: number; a: number; b: number }
  | { code: 'gamesAfterDecided'; game: number }
  | { code: 'matchNotDecided'; gamesToWin: number }
  | { code: 'invalidExpectedDuration' }
  | { code: 'importNotJson' }
  | { code: 'importNotTournamentFile' }
  | { code: 'importNewerVersion'; version: number }
  /** `path` is where the file is wrong, e.g. "tournament.players.1.lastName". */
  | { code: 'importInvalidData'; path: string };

export type EngineErrorCode = EngineError['code'];
