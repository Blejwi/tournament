import type { IdSource } from '../ids';
import type { Random } from '../random';
import type { Result } from '../result';
import type { SlotSource, Stage, StageConfig, StageId } from '../types';

/** Someone to place in a draw: an entry (first stage) or an origin label (fed by an earlier stage). */
export interface DrawEntrant {
  source: SlotSource;
  seed: number | null;
}

export interface DrawContext {
  /** In no particular order; the handler places them by seed and at random. */
  entrants: DrawEntrant[];
  random: Random;
  ids: IdSource;
}

/**
 * The common stage interface: every stage type (groups, single elimination, double elimination,
 * play-offs) implements it, so the commands and queries never switch on the format themselves.
 */
export interface StageHandler<S extends Stage = Stage> {
  /** Checks the operator's options for this stage. */
  validateConfig(config: Extract<StageConfig, { type: S['type'] }>): Result<void>;
  /** A new, not yet drawn stage from its options. */
  create(id: StageId, config: Extract<StageConfig, { type: S['type'] }>): S;
  /** The options the stage was configured with. */
  config(stage: S): Extract<StageConfig, { type: S['type'] }>;
  /** Places the entrants and creates the stage's matches; the result has `drawState: 'drawn'`. */
  draw(stage: S, ctx: DrawContext): Result<S>;
  /** Discards the draw (back to `notDrawn`), e.g. when the entries change. */
  clearDraw(stage: S): S;
  /** Whether a match in this stage may be recorded as games only (e.g. 3:1), without the points of each game. */
  allowsGamesOnly: boolean;
}
