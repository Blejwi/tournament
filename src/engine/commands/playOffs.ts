import { idSource } from '../ids';
import { findStage, replaceStage } from '../locate';
import { appendLog } from '../log';
import { fail, ok, type Result } from '../result';
import { buildPlayOff, findPlayOff, playOffMatches, playOffRanges, sameRange } from '../stages/playOffs';
import type { PlaceRange, StageId, Timestamp, TournamentState } from '../types';

export type PlayOffCommand =
  /**
   * Switches the place play-off for a shared place range on or off (any time after the draw). The
   * first time it is switched on its matches are created; switched off they stay, disabled, with
   * any finished results, and switching on again brings them back.
   */
  { type: 'setPlayOff'; stage: StageId; range: PlaceRange; enabled: boolean; at: Timestamp };

export function setPlayOff(state: TournamentState, cmd: Extract<PlayOffCommand, { type: 'setPlayOff' }>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const { competition, stage } = located.value;
  if (stage.type === 'groups' || !playOffRanges(stage).some((r) => sameRange(r, cmd.range))) {
    return fail({ code: 'playOffNotFound', from: cmd.range.from, to: cmd.range.to });
  }
  const range = { from: cmd.range.from, to: cmd.range.to };
  const existing = findPlayOff(stage, range);
  if (!existing && !cmd.enabled) return ok(state); // never switched on: nothing to do
  if (existing?.enabled === cmd.enabled) return ok(state);

  let next: TournamentState;
  if (existing) {
    if (!cmd.enabled && playOffMatches(stage, range).some((m) => m.table !== null && !m.result)) return fail({ code: 'playOffInProgress' });
    const playOffs = stage.playOffs.map((p) => (p === existing ? { ...p, enabled: cmd.enabled } : p));
    next = replaceStage(state, competition, { ...stage, playOffs });
  } else {
    const ids = idSource(state);
    const matches = buildPlayOff(stage, range, ids);
    next = ids.commit(
      replaceStage(state, competition, {
        ...stage,
        matches: [...stage.matches, ...matches],
        playOffs: [...stage.playOffs, { range, enabled: true }],
      }),
    );
  }
  return ok(appendLog(next, { type: 'playOffSet', at: cmd.at, competition: competition.id, stage: stage.id, range, enabled: cmd.enabled }));
}
