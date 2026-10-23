import { planCorrection } from '../corrections';
import { derive } from '../derive';
import type { EngineError } from '../errors';
import type { MatchId, MatchResult, Timestamp, TournamentState } from '../types';
import { matchView, type MatchView } from './matches';

export interface CorrectionPreview {
  /** Why this correction can't be made (e.g. an invalid score); null when it can. */
  error: EngineError | null;
  /**
   * The later matches that already started or finished with a player the correction replaces,
   * as they are now (before the correction). Correcting needs `force` and resets them; empty when
   * the correction only re-resolves slots.
   */
  resets: MatchView[];
}

/** The downstream-reset preview for correcting `match` to `result`: what `correctResult` would reset. */
export function getCorrectionPreview(state: TournamentState, match: MatchId, result: MatchResult, now: Timestamp): CorrectionPreview {
  const plan = planCorrection(state, match, result);
  if (!plan.ok) return { error: plan.error, resets: [] };
  const derived = derive(state);
  return { error: null, resets: plan.value.resets.map((id) => matchView(state, derived.match(id)!, now)) };
}
