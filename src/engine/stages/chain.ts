import type { Derived } from '../derive';
import type { Stage, StageConfig, StageType } from '../types';
import type { DrawEntrant } from './handler';

/**
 * The stage chain mechanism: stage N is fed by the advancers of stage N-1. A stage type that can
 * feed another says who advances (`advancersOf`) and when they are all known (`isComplete`); the
 * stage type that is fed draws them as origin labels (`DrawEntrant.origin`). Adding a chain such
 * as groups → groups (#0013) or groups → double elimination (#0011) means listing the follower in
 * `FOLLOWERS` and letting its handler's `draw` accept entrants with an `origin`.
 */

/** In v1 the group winner and the runner-up advance (glossary: Advancer). */
export const ADVANCERS_PER_GROUP = 2;

/** Which stage types may follow each stage type. A type that isn't listed ends the chain. */
const FOLLOWERS: Partial<Record<StageType, StageType[]>> = {
  groups: ['singleElimination', 'doubleElimination'],
};

/** Whether the chain of stage options is allowed: any first stage, each later one fed by the one before. */
export function isSupportedChain(stages: StageConfig[]): boolean {
  return stages.length > 0 && stages.every((stage, i) => i === 0 || (FOLLOWERS[stages[i - 1].type] ?? []).includes(stage.type));
}

/**
 * The advancers a stage hands on, as origin-label entrants (no seeds: the next stage places them
 * by origin), or null when the stage type doesn't feed a later stage. Needs the drawn stage.
 */
export function advancersOf(stage: Stage): DrawEntrant[] | null {
  if (stage.type !== 'groups') return null;
  const entrants: DrawEntrant[] = [];
  stage.groups.forEach((group, groupIndex) => {
    for (let place = 1; place <= ADVANCERS_PER_GROUP; place++) {
      entrants.push({ source: { kind: 'groupPlace', stage: stage.id, group: group.id, place }, seed: null, origin: { group: groupIndex, place } });
    }
  });
  return entrants;
}

/** Every advancer of the stage is decided: its groups are complete and no tie among the advancers is left to the operator. */
export function isComplete(derived: Derived, stage: Stage): boolean {
  if (stage.type !== 'groups') return false;
  return stage.groups.every((group) => {
    const standings = derived.standings(stage, group);
    return standings.complete && standings.rows.filter((r) => r.place <= ADVANCERS_PER_GROUP).every((r) => !r.tied);
  });
}
