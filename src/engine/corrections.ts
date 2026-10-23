import { checkScore } from './commands/matches';
import { derive, type DerivedMatch } from './derive';
import { findMatch, replaceMatch } from './locate';
import { fail, ok, type Result } from './result';
import type { Match, MatchId, MatchResult, TournamentState } from './types';

/**
 * A correction worked out but not applied yet: the state with the new result and every reset
 * done, and the matches it resets (in tournament order).
 */
export interface CorrectionPlan {
  state: TournamentState;
  resets: MatchId[];
}

/**
 * Plans a correction of a recorded result (ADR 0003). The new result replaces the old one and
 * keeps the match's table and timing. Because slots point to their source, the following slots
 * re-resolve on their own; what remains is every match that already started or finished with a
 * player who is now wrong. Those are found generically: any match whose resolved entries differ
 * from before, through whatever sources feed it ("winner/loser of match X", a group place, ...).
 * Resetting a match can make more matches wrong (its winner is undecided again), so this repeats
 * until nothing changes.
 */
export function planCorrection(state: TournamentState, matchId: MatchId, result: MatchResult): Result<CorrectionPlan> {
  const located = findMatch(state, matchId);
  if (!located.ok) return located;
  if (!located.value.match.result) return fail({ code: 'matchNotFinished' });
  const valid = checkScore(located.value, result);
  if (!valid.ok) return valid;

  const before = derive(state);
  let next = replaceMatch(state, located.value, { ...located.value.match, result: structuredClone(result) });
  const resets = new Set<MatchId>();
  for (;;) {
    const wrong = derive(next).matches.filter(
      (m) => m.match.id !== matchId && hasStarted(m.match) && !samePlayers(before.match(m.match.id)!, m),
    );
    if (!wrong.length) break;
    for (const { match } of wrong) {
      resets.add(match.id);
      next = resetMatch(next, match.id);
    }
  }
  const order = before.matches.map((m) => m.match.id).filter((id) => resets.has(id));
  return ok({ state: next, resets: order });
}

/** Called to a table or finished: it was played (or is being played) by its resolved players. */
const hasStarted = (match: Match) => match.table !== null || match.result !== null;

const entryIds = (m: DerivedMatch) => m.entries.map((e) => e?.id ?? null);

function samePlayers(before: DerivedMatch, after: DerivedMatch): boolean {
  const [a, b] = [entryIds(before), entryIds(after)];
  return a[0] === b[0] && a[1] === b[1];
}

/** Back to unplayed: no result, off its table, no timing. */
function resetMatch(state: TournamentState, id: MatchId): TournamentState {
  const located = findMatch(state, id);
  if (!located.ok) return state;
  return replaceMatch(state, located.value, { ...located.value.match, table: null, assignedAt: null, result: null, finishedAt: null });
}
