import { describe, expect, it } from 'vitest';
import { execute, getPlayers, type TournamentState } from '@/engine';
import { errorOf, newTournament, unwrap } from './helpers';

const kowalski = { firstName: 'Jan', lastName: 'Kowalski', club: 'KS Orzeł' };

function withPlayer(): [TournamentState, string] {
  const state = unwrap(execute(newTournament(), { type: 'addPlayer', ...kowalski }));
  return [state, getPlayers(state)[0].id];
}

describe('players', () => {
  it('registers a player with first name, last name and club', () => {
    const [state] = withPlayer();
    expect(getPlayers(state)).toEqual([
      { id: expect.any(String), firstName: 'Jan', lastName: 'Kowalski', club: 'KS Orzeł', rating: null, birthYear: null },
    ]);
  });

  it('keeps the optional rating and birth year', () => {
    const state = unwrap(
      execute(newTournament(), { type: 'addPlayer', ...kowalski, rating: 1650, birthYear: 2011 }),
    );
    expect(getPlayers(state)[0]).toMatchObject({ rating: 1650, birthYear: 2011 });
  });

  it('allows a player without a club', () => {
    const state = unwrap(execute(newTournament(), { type: 'addPlayer', firstName: 'Ola', lastName: 'Nowak', club: ' ' }));
    expect(getPlayers(state)[0]).toMatchObject({ firstName: 'Ola', lastName: 'Nowak', club: '' });
  });

  it('lists players by last name, then first name', () => {
    let state = newTournament();
    for (const [firstName, lastName] of [
      ['Piotr', 'Nowak'],
      ['Anna', 'Nowak'],
      ['Jan', 'Kowalski'],
    ]) {
      state = unwrap(execute(state, { type: 'addPlayer', firstName, lastName, club: '' }));
    }
    expect(getPlayers(state).map((p) => `${p.firstName} ${p.lastName}`)).toEqual([
      'Jan Kowalski',
      'Anna Nowak',
      'Piotr Nowak',
    ]);
  });

  it('needs a first and a last name', () => {
    const state = newTournament();
    expect(errorOf(execute(state, { type: 'addPlayer', firstName: '', lastName: 'Nowak', club: '' }))).toEqual({
      code: 'required',
      field: 'firstName',
    });
    expect(errorOf(execute(state, { type: 'addPlayer', firstName: 'Ola', lastName: ' ', club: '' }))).toEqual({
      code: 'required',
      field: 'lastName',
    });
  });

  it('rejects a negative rating and an impossible birth year', () => {
    const state = newTournament();
    expect(errorOf(execute(state, { type: 'addPlayer', ...kowalski, rating: -5 }))).toEqual({
      code: 'invalidRating',
    });
    for (const birthYear of [1800, 2011.5, 3000]) {
      expect(errorOf(execute(state, { type: 'addPlayer', ...kowalski, birthYear }))).toEqual({
        code: 'invalidBirthYear',
      });
    }
  });

  it('updates a player, including clearing the optional fields', () => {
    let [state, id] = withPlayer();
    state = unwrap(execute(state, { type: 'updatePlayer', player: id, ...kowalski, rating: 1500, birthYear: 2010 }));
    state = unwrap(
      execute(state, {
        type: 'updatePlayer',
        player: id,
        firstName: 'Janek',
        lastName: 'Kowalski',
        club: 'AZS',
        rating: null,
        birthYear: null,
      }),
    );

    expect(getPlayers(state)).toEqual([
      { id, firstName: 'Janek', lastName: 'Kowalski', club: 'AZS', rating: null, birthYear: null },
    ]);
  });

  it('validates an update like a registration', () => {
    const [state, id] = withPlayer();
    const result = execute(state, { type: 'updatePlayer', player: id, ...kowalski, lastName: '' });
    expect(errorOf(result)).toEqual({ code: 'required', field: 'lastName' });
  });

  it('reports an unknown player', () => {
    const [state] = withPlayer();
    const result = execute(state, { type: 'updatePlayer', player: 'nope', ...kowalski });
    expect(errorOf(result)).toEqual({ code: 'playerNotFound', player: 'nope' });
  });
});
