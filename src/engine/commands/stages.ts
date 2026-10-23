import { idSource } from '../ids';
import { findStage, replaceCompetition, replaceStage } from '../locate';
import { seededRandom } from '../random';
import { fail, ok, type Result } from '../result';
import { handlerFor, type DrawEntrant } from '../stages';
import type { Competition, CompetitionId, StageConfig, StageId, TournamentState } from '../types';
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
  if (!isSupportedChain(cmd.stages)) return fail({ code: 'unsupportedStageChain' });
  for (const config of cmd.stages) {
    const valid = handlerFor(config).validateConfig(config);
    if (!valid.ok) return valid;
  }
  const ids = idSource(state);
  const stages = cmd.stages.map((config) => handlerFor(config).create(ids.next('stage'), config));
  return ok(ids.commit(replaceCompetition(state, { ...competition.value, stages })));
}

/**
 * The stage chains v1 supports so far; it grows ticket by ticket (groups → bracket: #0009,
 * groups → double elimination: #0011, groups → groups: #0013): a single groups stage, or a direct
 * single or double elimination bracket.
 */
const SUPPORTED_CHAINS: StageConfig['type'][][] = [['groups'], ['groups', 'groups'], ['singleElimination'], ['doubleElimination']];

function isSupportedChain(stages: StageConfig[]): boolean {
  return SUPPORTED_CHAINS.some((chain) => chain.length === stages.length && chain.every((type, i) => stages[i].type === type));
}

export function generateDraw(state: TournamentState, cmd: Cmd<'generateDraw'>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const { competition, stage, index } = located.value;
  if (stage.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  const entrants = entrantsFor(competition, index);
  if (!entrants.ok) return entrants;
  const ids = idSource(state);
  const drawn = handlerFor(stage).draw(stage, { entrants: entrants.value, random: seededRandom(cmd.randomSeed), ids });
  if (!drawn.ok) return drawn;
  // A later stage was drawn from this stage's groups or matches: it has to be drawn again.
  const stages = competition.stages.map((s, i) => (i < index ? s : i === index ? drawn.value : handlerFor(s).clearDraw(s)));
  return ok(ids.commit(replaceCompetition(state, { ...competition, stages })));
}

/** Who is placed in the draw of stage `index`: the competition's entries, or the advancers of the stage before. */
function entrantsFor(competition: Competition, index: number): Result<DrawEntrant[]> {
  if (index === 0) return ok(competition.entries.map((e) => ({ source: { kind: 'entry' as const, entry: e.id }, seed: e.seed })));
  const previous = competition.stages[index - 1];
  const advancers = handlerFor(previous).advancers;
  if (!advancers) return fail({ code: 'unsupportedStageChain' });
  if (previous.drawState === 'notDrawn') return fail({ code: 'stageNotDrawn' });
  return ok(advancers(previous));
}

export function confirmStage(state: TournamentState, cmd: Cmd<'confirmStage'>): Result<TournamentState> {
  const located = findStage(state, cmd.stage);
  if (!located.ok) return located;
  const { competition, stage } = located.value;
  if (stage.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  if (stage.drawState === 'notDrawn') return fail({ code: 'stageNotDrawn' });
  return ok(replaceStage(state, competition, { ...stage, drawState: 'confirmed' }));
}
