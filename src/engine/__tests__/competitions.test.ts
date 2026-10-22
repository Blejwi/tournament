import { describe, expect, it } from 'vitest';
import { execute, getCompetition, getCompetitions, getPlayers, type TournamentState } from '@/engine';
import { errorOf, newTournament, unwrap } from './helpers';

/** A tournament with one competition and registered (not yet entered) players with these last names. */
function withPlayers(...lastNames: string[]) {
  let state = newTournament();
  for (const lastName of lastNames) state = unwrap(execute(state, { type: 'addPlayer', firstName: 'Jan', lastName, club: 'KS' }));
  state = unwrap(execute(state, { type: 'addCompetition', name: 'Open' }));
  const competition = getCompetitions(state)[0].id;
  const player = (lastName: string) => getPlayers(state).find((p) => p.lastName === lastName)!.id;
  return { state, competition, player };
}

function entryOf(state: TournamentState, competition: string, lastName: string): string {
  return getCompetition(state, competition)!.entries.find((e) => e.players[0].lastName === lastName)!.id;
}

describe('competitions', () => {
  it('adds a competition with 3 games to win by default', () => {
    const state = unwrap(execute(newTournament(), { type: 'addCompetition', name: "Men's Open" }));

    expect(getCompetitions(state)).toEqual([
      { id: expect.any(String), name: "Men's Open", gamesToWin: 3, entryCount: 0 },
    ]);
  });

  it('keeps the chosen games to win', () => {
    let state = newTournament();
    for (const gamesToWin of [2, 4] as const) {
      state = unwrap(execute(state, { type: 'addCompetition', name: `Best of ${gamesToWin}`, gamesToWin }));
    }
    expect(getCompetitions(state).map((c) => c.gamesToWin)).toEqual([2, 4]);
  });

  it('needs a name and games to win of 2, 3 or 4', () => {
    const state = newTournament();
    expect(errorOf(execute(state, { type: 'addCompetition', name: ' ' }))).toEqual({ code: 'required', field: 'name' });
    const badGamesToWin = 5 as unknown as 3;
    expect(errorOf(execute(state, { type: 'addCompetition', name: 'Open', gamesToWin: badGamesToWin }))).toEqual({
      code: 'invalidGamesToWin',
    });
  });

  it('enters registered players, listing seeds first, then by name', () => {
    const { state, competition, player } = withPlayers('Nowak', 'Kowalski', 'Zieliński');
    let next = unwrap(execute(state, { type: 'enterPlayer', competition, player: player('Nowak') }));
    next = unwrap(execute(next, { type: 'enterPlayer', competition, player: player('Zieliński') }));
    next = unwrap(execute(next, { type: 'enterPlayer', competition, player: player('Kowalski') }));
    const zielinski = entryOf(next, competition, 'Zieliński');
    next = unwrap(execute(next, { type: 'setSeed', competition, entry: zielinski, seed: 1 }));

    const entries = getCompetition(next, competition)!.entries;
    expect(entries.map((e) => [e.players[0].lastName, e.seed])).toEqual([
      ['Zieliński', 1],
      ['Kowalski', null],
      ['Nowak', null],
    ]);
    expect(entries[0]).toEqual({
      id: zielinski,
      seed: 1,
      players: [{ id: player('Zieliński'), firstName: 'Jan', lastName: 'Zieliński', club: 'KS' }],
    });
    expect(getCompetitions(next)[0].entryCount).toBe(3);
  });

  it('enters a player at most once per competition, but in several competitions', () => {
    const { state, competition, player } = withPlayers('Nowak');
    let next = unwrap(execute(state, { type: 'enterPlayer', competition, player: player('Nowak') }));
    expect(errorOf(execute(next, { type: 'enterPlayer', competition, player: player('Nowak') }))).toEqual({
      code: 'alreadyEntered',
      player: player('Nowak'),
    });

    next = unwrap(execute(next, { type: 'addCompetition', name: 'U15' }));
    const u15 = getCompetitions(next)[1].id;
    next = unwrap(execute(next, { type: 'enterPlayer', competition: u15, player: player('Nowak') }));
    expect(getCompetition(next, u15)!.entries).toHaveLength(1);
  });

  it('reports an unknown competition, player or entry', () => {
    const { state, competition } = withPlayers('Nowak');
    expect(errorOf(execute(state, { type: 'enterPlayer', competition: 'nope', player: 'x' }))).toEqual({
      code: 'competitionNotFound',
      competition: 'nope',
    });
    expect(errorOf(execute(state, { type: 'enterPlayer', competition, player: 'nope' }))).toEqual({
      code: 'playerNotFound',
      player: 'nope',
    });
    expect(errorOf(execute(state, { type: 'setSeed', competition, entry: 'nope', seed: 1 }))).toEqual({
      code: 'entryNotFound',
      entry: 'nope',
    });
  });

  it('accepts seeds that are unique positive whole numbers, and clears them', () => {
    const { state, competition, player } = withPlayers('Nowak', 'Kowalski');
    let next = unwrap(execute(state, { type: 'enterPlayer', competition, player: player('Nowak') }));
    next = unwrap(execute(next, { type: 'enterPlayer', competition, player: player('Kowalski') }));
    const nowak = entryOf(next, competition, 'Nowak');
    const kowalski = entryOf(next, competition, 'Kowalski');
    next = unwrap(execute(next, { type: 'setSeed', competition, entry: nowak, seed: 1 }));

    expect(errorOf(execute(next, { type: 'setSeed', competition, entry: kowalski, seed: 1 }))).toEqual({
      code: 'seedTaken',
      seed: 1,
    });
    for (const seed of [0, -2, 1.5]) {
      expect(errorOf(execute(next, { type: 'setSeed', competition, entry: kowalski, seed }))).toEqual({
        code: 'invalidSeed',
      });
    }
    next = unwrap(execute(next, { type: 'setSeed', competition, entry: nowak, seed: null }));
    next = unwrap(execute(next, { type: 'setSeed', competition, entry: kowalski, seed: 1 }));
    expect(getCompetition(next, competition)!.entries.map((e) => [e.players[0].lastName, e.seed])).toEqual([
      ['Kowalski', 1],
      ['Nowak', null],
    ]);
  });

  it('removes an entry', () => {
    const { state, competition, player } = withPlayers('Nowak', 'Kowalski');
    let next = unwrap(execute(state, { type: 'enterPlayer', competition, player: player('Nowak') }));
    next = unwrap(execute(next, { type: 'enterPlayer', competition, player: player('Kowalski') }));
    next = unwrap(execute(next, { type: 'removeEntry', competition, entry: entryOf(next, competition, 'Nowak') }));
    expect(getCompetition(next, competition)!.entries.map((e) => e.players[0].lastName)).toEqual(['Kowalski']);
  });

  it('starts with no entries and no stages', () => {
    const state = unwrap(execute(newTournament(), { type: 'addCompetition', name: 'U15 Boys' }));
    const id = getCompetitions(state)[0].id;
    expect(getCompetition(state, id)).toEqual({
      id,
      name: 'U15 Boys',
      gamesToWin: 3,
      entries: [],
      stages: [],
    });
  });
});
