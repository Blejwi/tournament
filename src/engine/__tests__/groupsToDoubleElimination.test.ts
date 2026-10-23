import { describe, expect, it } from 'vitest';
import { execute, getCompetition, getStage, type TournamentState } from '@/engine';
import { errorOf } from './helpers';
import { originLabel, playAllGroups } from './groupsToBracketScenarios';
import { bracketOf, competitionWith, run } from './scenarios';

function drawn(count: number, groups: number, randomSeed = 42) {
  const setup = competitionWith(count);
  let state = run(setup.state, {
    type: 'configureStages',
    competition: setup.competition,
    stages: [{ type: 'groups', grouping: { by: 'count', groups } }, { type: 'doubleElimination' }],
  });
  const [groupsStage, bracket] = getCompetition(state, setup.competition)!.stages.map((s) => s.id);
  state = run(state, { type: 'generateDraw', stage: groupsStage, randomSeed });
  state = run(state, { type: 'confirmStage', stage: groupsStage });
  return { state, groupsStage, bracket };
}

const firstRound = (state: TournamentState, stage: string) =>
  bracketOf(state, stage)
    .sections.find((s) => s.section === 'winners')!
    .rounds[0].matches.flatMap((m) => ([0, 1] as const).map((i) => (m.slots[i].source.kind === 'bye' ? 'BYE' : originLabel(m, i)!)));

describe('groups → double elimination', () => {
  it('places 4 groups into the winners bracket by the #0009 rules, with the losers bracket of #0010', () => {
    const { state, bracket } = drawn(16, 4);
    const labels = firstRound(state, bracket);
    expect([...labels].sort()).toEqual(['1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D']);
    expect(labels[0]).toBe('1A');
    expect(labels[7]).toBe('1B');
    for (const g of 'ABCD') expect(labels.indexOf(`2${g}`) < 4).not.toBe(labels.indexOf(`1${g}`) < 4);
    expect(bracketOf(state, bracket).sections.map((s) => s.section)).toEqual(['winners', 'losers', 'secondFinal']);
  });

  it('gates confirming the bracket on every group being complete, and resolves placeholders as groups finish', () => {
    const { state, groupsStage, bracket } = drawn(16, 4);
    expect(errorOf(execute(state, { type: 'confirmStage', stage: bracket }))).toEqual({ code: 'previousStageNotComplete' });
    const partly = playAllGroups(state, groupsStage, ['A', 'B', 'C']);
    expect(errorOf(execute(partly, { type: 'confirmStage', stage: bracket }))).toEqual({ code: 'previousStageNotComplete' });
    const all = playAllGroups(partly, groupsStage, ['D']);
    expect(getStage(run(all, { type: 'confirmStage', stage: bracket }), bracket, 0)?.drawState).toBe('confirmed');
  });

  it('needs at least 8 advancers', () => {
    const { state, stage } = setupThree();
    expect(errorOf(execute(state, { type: 'generateDraw', stage, randomSeed: 1 }))).toEqual({ code: 'notEnoughAdvancers', needed: 8 });
  });
});

function setupThree() {
  const setup = competitionWith(12);
  const state = run(setup.state, {
    type: 'configureStages',
    competition: setup.competition,
    stages: [{ type: 'groups', grouping: { by: 'count', groups: 3 } }, { type: 'doubleElimination' }],
  });
  return { state, stage: getCompetition(state, setup.competition)!.stages[0].id };
}
