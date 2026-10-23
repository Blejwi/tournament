import { describe, expect, it } from 'vitest';
import { execute, getCompetition, getCompetitions, getPlayers, type TournamentState } from '@/engine';
import { errorOf, newTournament } from './helpers';
import { matchBetween, run, tableId } from './scenarios';

const T0 = Date.UTC(2026, 4, 1, 9, 0);

const person = (lastName: string) => ({ firstName: 'Jan', lastName, club: 'KS' });

function twoCompetitions() {
  const state = run(newTournament(), { type: 'addTable', number: 1 }, { type: 'addCompetition', name: 'Open' }, { type: 'addCompetition', name: 'U15' });
  const [open, u15] = getCompetitions(state).map((c) => c.id);
  return { state, open, u15 };
}

describe('registering a player inside a competition', () => {
  it('creates the player and the entry in one command', () => {
    const { state, open } = twoCompetitions();
    const next = run(state, { type: 'registerPlayer', competition: open, ...person('Nowak'), rating: 1500, birthYear: 2010 });

    expect(getPlayers(next)).toEqual([expect.objectContaining({ lastName: 'Nowak', rating: 1500, birthYear: 2010 })]);
    const entries = getCompetition(next, open)!.entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].players[0].id).toBe(getPlayers(next)[0].id);
  });

  it('changes nothing when the details or the competition are wrong', () => {
    const { state, open } = twoCompetitions();
    expect(errorOf(execute(state, { type: 'registerPlayer', competition: open, firstName: '', lastName: 'Nowak', club: '' }))).toEqual({
      code: 'required',
      field: 'firstName',
    });
    expect(errorOf(execute(state, { type: 'registerPlayer', competition: 'nope', ...person('Nowak') })).code).toBe('competitionNotFound');
  });

  it('is refused once the stage is confirmed', () => {
    const { state, open } = twoCompetitions();
    let next = run(state, { type: 'registerPlayer', competition: open, ...person('A') }, { type: 'registerPlayer', competition: open, ...person('B') });
    next = run(next, { type: 'configureStages', competition: open, stages: [{ type: 'groups', grouping: { by: 'count', groups: 1 } }] });
    const stage = getCompetition(next, open)!.stages[0].id;
    next = run(next, { type: 'generateDraw', stage, randomSeed: 1 }, { type: 'confirmStage', stage });
    expect(errorOf(execute(next, { type: 'registerPlayer', competition: open, ...person('C') }))).toEqual({ code: 'stageConfirmed' });
    expect(getPlayers(next)).toHaveLength(2);
  });
});

describe('the same person in a second competition', () => {
  it('is entered without re-registration and is busy across both competitions', () => {
    const { state, open, u15 } = twoCompetitions();
    let next = run(
      state,
      { type: 'registerPlayer', competition: open, ...person('P1') },
      { type: 'registerPlayer', competition: open, ...person('P2') },
      { type: 'registerPlayer', competition: u15, ...person('P3') },
    );
    const p1 = getPlayers(next).find((p) => p.lastName === 'P1')!.id;
    next = run(next, { type: 'enterPlayer', competition: u15, player: p1 });
    expect(getPlayers(next)).toHaveLength(3);

    const stages: Record<string, string> = {};
    for (const competition of [open, u15]) {
      next = run(next, { type: 'configureStages', competition, stages: [{ type: 'groups', grouping: { by: 'count', groups: 1 } }] });
      const stage = getCompetition(next, competition)!.stages[0].id;
      stages[competition] = stage;
      next = run(next, { type: 'generateDraw', stage, randomSeed: 1 }, { type: 'confirmStage', stage });
    }
    const openMatch = matchBetween(next, stages[open], 'P1', 'P2');
    next = run(next, { type: 'assignMatch', match: openMatch.id, table: tableId(next, 1), at: T0 });
    expect(matchBetween(next, stages[u15], 'P1', 'P3').status).toBe('busy');
  });
});

describe('removing an entry', () => {
  function shared() {
    const { state, open, u15 } = twoCompetitions();
    let next = run(state, { type: 'registerPlayer', competition: open, ...person('Solo') }, { type: 'registerPlayer', competition: open, ...person('Both') });
    const both = getPlayers(next).find((p) => p.lastName === 'Both')!.id;
    next = run(next, { type: 'enterPlayer', competition: u15, player: both });
    const entryOf = (s: TournamentState, competition: string, lastName: string) =>
      getCompetition(s, competition)!.entries.find((e) => e.players[0].lastName === lastName)!.id;
    return { next, open, u15, entryOf };
  }

  it('removes the player too when it was their only entry', () => {
    const { next, open, entryOf } = shared();
    const after = run(next, { type: 'removeEntry', competition: open, entry: entryOf(next, open, 'Solo') });
    expect(getPlayers(after).map((p) => p.lastName)).toEqual(['Both']);
  });

  it('keeps the player while they have another entry', () => {
    const { next, open, u15, entryOf } = shared();
    let after = run(next, { type: 'removeEntry', competition: open, entry: entryOf(next, open, 'Both') });
    expect(getPlayers(after).map((p) => p.lastName)).toEqual(['Both', 'Solo']);
    after = run(after, { type: 'removeEntry', competition: u15, entry: entryOf(after, u15, 'Both') });
    expect(getPlayers(after).map((p) => p.lastName)).toEqual(['Solo']);
  });
});
