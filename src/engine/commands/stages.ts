import { idSource } from '../ids';
import { findStage, replaceCompetition, replaceStage } from '../locate';
import { seededRandom } from '../random';
import { fail, ok, type Result } from '../result';
import { handlerFor } from '../stages';
import type { CompetitionId, StageConfig, StageId, TournamentState } from '../types';
import { findCompetition } from './competitions';

export type StageCommand =
  /** Replaces the competition's stage chain (only before the first stage is confirmed). */
  | { type: 'configureStages'; competition: CompetitionId; stages: StageConfig[] }
  /** Draws (or re-draws) a stage that isn't confirmed yet. `randomSeed` makes the draw reproducible. */
  | { type: 'generateDraw'; stage: StageId; randomSeed: number }
  /** Locks the draw; from then on the stage's matches can be played. */
  | { type: 'confirmStage'; stage: StageId };

type Cmd<T extends StageCommand['type']> = Extract<StageCommand, { type: T }>;

export function configureStages(state: TournamentState, cmd: Cmd<'configureStages'>): Result<TournamentState> {
  const competition = findCompetition(state, cmd.competition);
  if (!competition.ok) return competition;
  if (competition.value.stages[0]?.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  // v1 grows the supported chains ticket by ticket; for now: groups only.
  if (cmd.stages.length !== 1 || cmd.stages[0].type !== 'groups') return fail({ code: 'unsupportedStageChain' });
  for (const config of cmd.stages) {
    const valid = handlerFor(config).validateConfig(config);
    if (!valid.ok) return valid;
  }
  const ids = idSource(state);
  const stages = cmd.stages.map((config) => handlerFor(config).create(ids.next('stage'), config));
  return ok(ids.commit(replaceCompetition(state, { ...competition.value, stages })));
}

export function generateDraw(state: TournamentState, cmd: Cmd<'generateDraw'>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const { competition, stage, index } = located.value;
  if (stage.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  if (index > 0) return fail({ code: 'unsupportedStageChain' }); // later stages are fed by advancers (#0009, #0013)
  const entrants = competition.entries.map((e) => ({ source: { kind: 'entry' as const, entry: e.id }, seed: e.seed }));
  const ids = idSource(state);
  const drawn = handlerFor(stage).draw(stage, { entrants, random: seededRandom(cmd.randomSeed), ids });
  if (!drawn.ok) return drawn;
  return ok(ids.commit(replaceStage(state, competition, drawn.value)));
}

export function confirmStage(state: TournamentState, cmd: Cmd<'confirmStage'>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const { competition, stage } = located.value;
  if (stage.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  if (stage.drawState === 'notDrawn') return fail({ code: 'stageNotDrawn' });
  return ok(replaceStage(state, competition, { ...stage, drawState: 'confirmed' }));
}
