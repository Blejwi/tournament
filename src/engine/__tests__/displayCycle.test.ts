import { describe, expect, it } from 'vitest';
import { getCompetition, getCompetitions, getDisplayCycle, getPlayers, type TournamentState } from '@/engine';
import { newTournament } from './helpers';
import { run } from './scenarios';

type Setup = 'confirmed' | 'drawn' | 'unconfigured';

/** One competition per name, each of 4 entries in one group, with its draw in the given state. Same players in all. */
function tournamentWith(...competitions: [name: string, setup: Setup][]) {
  let state = newTournament();
  for (let i = 1; i <= 4; i++) state = run(state, { type: 'addPlayer', firstName: 'Player', lastName: `P${i}`, club: '' });
  for (const [name, setup] of competitions) {
    state = run(state, { type: 'addCompetition', name });
    const competition = getCompetitions(state).find((c) => c.name === name)!.id;
    for (const player of getPlayers(state)) state = run(state, { type: 'enterPlayer', competition, player: player.id });
    if (setup === 'unconfigured') continue;
    state = run(state, { type: 'configureStages', competition, stages: [{ type: 'groups', grouping: { by: 'count', groups: 1 } }] });
    const stage = getCompetition(state, competition)!.stages[0].id;
    state = run(state, { type: 'generateDraw', stage, randomSeed: 1 });
    if (setup === 'confirmed') state = run(state, { type: 'confirmStage', stage });
  }
  return state;
}

const idOf = (state: TournamentState, name: string) => getCompetitions(state).find((c) => c.name === name)!.id;
const names = (state: TournamentState, excluded: string[] = []) =>
  getDisplayCycle(state, { excluded }).map((c) => c.name);

describe('display cycle', () => {
  it('lists the competitions in the order of the competition tabs', () => {
    const state = tournamentWith(['Open', 'confirmed'], ['U15', 'confirmed'], ['Veterans', 'confirmed']);
    expect(names(state)).toEqual(['Open', 'U15', 'Veterans']);
    expect(getDisplayCycle(state, { excluded: [] })[0]).toEqual({ id: idOf(state, 'Open'), name: 'Open' });
  });

  it('leaves out a competition whose first stage is not confirmed, or that has no stages', () => {
    const state = tournamentWith(['Open', 'confirmed'], ['U15', 'drawn'], ['Veterans', 'unconfigured']);
    expect(names(state)).toEqual(['Open']);
  });

  it('picks up a competition once its first stage is confirmed', () => {
    const before = tournamentWith(['Open', 'confirmed'], ['U15', 'drawn']);
    expect(names(before)).toEqual(['Open']);
    const competition = idOf(before, 'U15');
    const after = run(before, { type: 'confirmStage', stage: getCompetition(before, competition)!.stages[0].id });
    expect(names(after)).toEqual(['Open', 'U15']);
  });

  it('leaves out excluded competitions and ignores excluded ids that do not exist', () => {
    const state = tournamentWith(['Open', 'confirmed'], ['U15', 'confirmed'], ['Veterans', 'confirmed']);
    expect(names(state, [idOf(state, 'U15'), 'gone'])).toEqual(['Open', 'Veterans']);
  });

  it('is empty when all are excluded, or none is confirmed, or there are no competitions', () => {
    const state = tournamentWith(['Open', 'confirmed'], ['U15', 'confirmed']);
    expect(names(state, [idOf(state, 'Open'), idOf(state, 'U15')])).toEqual([]);
    expect(names(tournamentWith(['Open', 'drawn']))).toEqual([]);
    expect(names(newTournament())).toEqual([]);
  });
});
