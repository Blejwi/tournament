import type { CompetitionId, EntryId, MatchId, PlayerId, StageId, TableId } from './types';

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
  | { code: 'matchNotFound'; match: MatchId };

export type EngineErrorCode = EngineError['code'];
