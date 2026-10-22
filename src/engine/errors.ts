import type { PlayerId, TableId } from './types';

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
  | { code: 'playerNotFound'; player: PlayerId };

export type EngineErrorCode = EngineError['code'];
