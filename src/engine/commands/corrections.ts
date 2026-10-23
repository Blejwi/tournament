import { planCorrection } from '../corrections';
import { fail, ok, type Result } from '../result';
import type { MatchId, MatchResult, TournamentState } from '../types';

export type CorrectionCommand =
  /**
   * Changes a recorded result; the match keeps its table and its start and finish times. If later
   * matches already started or finished with a player who is now wrong, it fails with the list of
   * those matches (see `getCorrectionPreview`) unless `force` is set; with `force` they are reset.
   */
  { type: 'correctResult'; match: MatchId; result: MatchResult; force?: boolean };

type Cmd<T extends CorrectionCommand['type']> = Extract<CorrectionCommand, { type: T }>;

export function correctResult(state: TournamentState, cmd: Cmd<'correctResult'>): Result<TournamentState> {
  const plan = planCorrection(state, cmd.match, cmd.result);
  if (!plan.ok) return plan;
  if (plan.value.resets.length && !cmd.force) return fail({ code: 'correctionNeedsForce', matches: plan.value.resets });
  return ok(plan.value.state);
}
