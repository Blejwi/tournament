import { derive } from '../derive';
import { idSource, type IdSource } from '../ids';
import { findStage, replaceCompetition } from '../locate';
import { seededRandom } from '../random';
import { fail, ok, type Result } from '../result';
import { advancersOf, handlerFor, isStageComplete, isSupportedChain, type DrawEntrant } from '../stages';
import type { Competition, CompetitionId, Stage, StageConfig, StageId, TournamentState } from '../types';
import { findCompetition } from './competitions';

export type StageCommand =
  /** Replaces the competition's stage chain (only before the first stage is confirmed). */
  | { type: 'configureStages'; competition: CompetitionId; stages: StageConfig[] }
  /**
   * Draws (or re-draws) a stage that isn't confirmed yet. `randomSeed` makes the draw reproducible.
   * The stages after it are fed by its advancers, so they are drawn again too (as origin labels).
   */
  | { type: 'generateDraw'; stage: StageId; randomSeed: number }
  /** Locks the draw; from then on the stage's matches can be played. */
  | { type: 'confirmStage'; stage: StageId };

type Cmd<T extends StageCommand['type']> = Extract<StageCommand, { type: T }>;

export function configureStages(state: TournamentState, cmd: Cmd<'configureStages'>): Result<TournamentState> {
  const competition = findCompetition(state, cmd.competition);
  if (!competition.ok) return competition;
  if (competition.value.stages[0]?.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  if (!isSupportedChain(cmd.stages)) return fail({ code: 'unsupportedStageChain' });
  for (const config of cmd.stages) {
    const valid = handlerFor(config).validateConfig(config);
    if (!valid.ok) return valid;
  }
  const ids = idSource(state);
  const stages = cmd.stages.map((config) => handlerFor(config).create(ids.next('stage'), config));
  return ok(ids.commit(replaceCompetition(state, { ...competition.value, stages })));
}

/** The entrants of stage `index`: the competition's entries for the first stage, else the advancers of the stage before. */
function entrantsOf(competition: Competition, index: number): Result<DrawEntrant[]> {
  if (index === 0) return ok(competition.entries.map((e) => ({ source: { kind: 'entry' as const, entry: e.id }, seed: e.seed })));
  const previous = competition.stages[index - 1];
  if (previous.drawState === 'notDrawn') return fail({ code: 'stageNotDrawn' });
  const advancers = advancersOf(previous);
  return advancers ? ok(advancers) : fail({ code: 'unsupportedStageChain' });
}

/** Draws stage `index` and every stage after it, each from the advancers of the one before. */
function drawChain(competition: Competition, index: number, randomSeed: number, ids: IdSource): Result<Stage[]> {
  const stages = [...competition.stages];
  for (let i = index; i < stages.length; i++) {
    const entrants = entrantsOf({ ...competition, stages }, i);
    if (!entrants.ok) return entrants;
    const drawn = handlerFor(stages[i]).draw(stages[i], { entrants: entrants.value, random: seededRandom(randomSeed + i), ids });
    if (!drawn.ok) return drawn;
    stages[i] = drawn.value;
  }
  return ok(stages);
}

export function generateDraw(state: TournamentState, cmd: Cmd<'generateDraw'>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const { competition, stage, index } = located.value;
  if (stage.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  const ids = idSource(state);
  const stages = drawChain(competition, index, cmd.randomSeed, ids);
  if (!stages.ok) return stages;
  return ok(ids.commit(replaceCompetition(state, { ...competition, stages: stages.value })));
}

export function confirmStage(state: TournamentState, cmd: Cmd<'confirmStage'>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const { competition, stage, index } = located.value;
  if (stage.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  if (stage.drawState === 'notDrawn') return fail({ code: 'stageNotDrawn' });
  // A fed stage waits for its feeder: every advancer must be known.
  if (index > 0 && !isStageComplete(derive(state), competition.stages[index - 1])) return fail({ code: 'previousStageNotComplete' });
  const stages = competition.stages.map((s) => (s.id === stage.id ? { ...s, drawState: 'confirmed' as const } : s));
  return ok(replaceCompetition(state, { ...competition, stages }));
}
