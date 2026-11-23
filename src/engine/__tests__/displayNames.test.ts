import { describe, expect, it } from 'vitest';
import { getDisplayNames, getPlayers, type TournamentState } from '@/engine';
import { newTournament } from './helpers';
import { run } from './scenarios';

/** A tournament with the given players, and a lookup from "First Last" to the player's display name. */
function namesFor(...players: [firstName: string, lastName: string][]) {
  let state: TournamentState = newTournament();
  for (const [firstName, lastName] of players) state = run(state, { type: 'addPlayer', firstName, lastName, club: '' });
  const names = getDisplayNames(state);
  const nameOf = (firstName: string, lastName: string) => {
    const player = getPlayers(state).find((p) => p.firstName === firstName && p.lastName === lastName)!;
    return names[player.id];
  };
  return { names, nameOf };
}

describe('display names', () => {
  it('shows the surname and the first initial', () => {
    const { nameOf } = namesFor(['Jan', 'Kowalski'], ['Anna', 'Nowak']);
    expect(nameOf('Jan', 'Kowalski')).toBe('Kowalski J.');
    expect(nameOf('Anna', 'Nowak')).toBe('Nowak A.');
  });

  it('gives players whose short names clash their full first names, and only them', () => {
    const { nameOf } = namesFor(['Jan', 'Kowalski'], ['Jakub', 'Kowalski'], ['Anna', 'Kowalski'], ['Jan', 'Nowak']);
    expect(nameOf('Jan', 'Kowalski')).toBe('Kowalski Jan');
    expect(nameOf('Jakub', 'Kowalski')).toBe('Kowalski Jakub');
    expect(nameOf('Anna', 'Kowalski')).toBe('Kowalski A.');
    expect(nameOf('Jan', 'Nowak')).toBe('Nowak J.');
  });

  it('treats a clash regardless of letter case', () => {
    const { nameOf } = namesFor(['jan', 'KOWALSKI'], ['Jakub', 'Kowalski']);
    expect(nameOf('jan', 'KOWALSKI')).toBe('KOWALSKI jan');
    expect(nameOf('Jakub', 'Kowalski')).toBe('Kowalski Jakub');
  });

  it('gives all three of a three-way clash their full first names', () => {
    const { nameOf } = namesFor(['Jan', 'Kowalski'], ['Jakub', 'Kowalski'], ['Jerzy', 'Kowalski']);
    expect([nameOf('Jan', 'Kowalski'), nameOf('Jakub', 'Kowalski'), nameOf('Jerzy', 'Kowalski')]).toEqual(['Kowalski Jan', 'Kowalski Jakub', 'Kowalski Jerzy']);
  });

  it('has an entry for every player and none for an empty tournament', () => {
    expect(getDisplayNames(newTournament())).toEqual({});
    expect(Object.keys(namesFor(['A', 'B'], ['C', 'D']).names)).toHaveLength(2);
  });
});
