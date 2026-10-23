import { describe, expect, it } from 'vitest';
import { getFinalPlaces, type MatchView, type TournamentState } from '@/engine';
import { drawnBracket, drawnGroups, groupsOf, roundsOf, run, slotLabel, slotName } from './scenarios';

const allSeeded = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, i + 1]));
const range = (r: { from: number; to: number }) => (r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`);
const number = (label: string) => Number(label.slice(1));

/** "1 P1", "5–8 P8": the final-places rows as text. */
const rowsOf = (state: TournamentState, competition: string) =>
  getFinalPlaces(state, competition)!.rows.map((r) => `${range(r.place)} ${r.entry.players[0].lastName}`);
/** "5–8×3": places still open, with how many entries are still to land in them. */
const openOf = (state: TournamentState, competition: string) =>
  getFinalPlaces(state, competition)!.open.map((o) => `${range(o.place)}×${o.count}`);

const win = (state: TournamentState, match: MatchView, better: 0 | 1) =>
  run(state, { type: 'recordResult', match: match.id, result: { kind: 'gamesOnly', games: better === 0 ? [3, 0] : [0, 3] }, at: 0 });

/** Plays the matches of the given bracket round, the better (lower-numbered) player winning. */
function playRound(state: TournamentState, stage: string, round: number): TournamentState {
  for (const match of roundsOf(state, stage)[round - 1]) {
    const [a, b] = [number(slotLabel(match, 0)), number(slotLabel(match, 1))];
    state = win(state, match, a < b ? 0 : 1);
  }
  return state;
}

/** Plays every match of the given groups (by name), the lower-numbered player winning. */
function playGroups(state: TournamentState, stage: string, names: string[]): TournamentState {
  for (const group of groupsOf(state, stage).filter((g) => names.includes(g.name))) {
    for (const match of group.matches) {
      const better = number(slotName(match, 0)) < number(slotName(match, 1)) ? 0 : 1;
      state = run(state, {
        type: 'recordResult',
        match: match.id,
        result: { kind: 'games', games: Array.from({ length: 3 }, () => (better === 0 ? [11, 5] : [5, 11]) as [number, number]) },
        at: 0,
      });
    }
  }
  return state;
}

describe('final places: single elimination', () => {
  it('a finished 8-entry bracket with a 3rd-place match: 1, 2, 3, 4, then 5–8', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8), thirdPlace: true });
    let played = playRound(playRound(playRound(state, stage, 1), stage, 2), stage, 3);
    const [thirdPlace] = roundsOf(played, stage, 'thirdPlace')[0];
    played = win(played, thirdPlace, number(slotLabel(thirdPlace, 0)) < number(slotLabel(thirdPlace, 1)) ? 0 : 1);
    expect(rowsOf(played, competition)).toEqual(['1 P1', '2 P2', '3 P3', '4 P4', '5–8 P8', '5–8 P5', '5–8 P6', '5–8 P7']);
    expect(getFinalPlaces(played, competition)).toMatchObject({ complete: true, open: [] });
  });

  it('mid-play: only the knocked-out entries are placed, in the right ranges; the rest stay open', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8), thirdPlace: true });
    expect(rowsOf(state, competition)).toEqual([]);
    expect(openOf(state, competition)).toEqual(['1×1', '2×1', '3×1', '4×1', '5–8×4']);

    const quarterFinalsDone = playRound(state, stage, 1);
    expect(rowsOf(quarterFinalsDone, competition)).toEqual(['5–8 P8', '5–8 P5', '5–8 P6', '5–8 P7']);
    expect(openOf(quarterFinalsDone, competition)).toEqual(['1×1', '2×1', '3×1', '4×1']);
    expect(getFinalPlaces(quarterFinalsDone, competition)!.complete).toBe(false);
  });

  it('mid-play with 16 entries: round-of-16 losers share 9–16 while the rest is running', () => {
    const { state, competition, stage } = drawnBracket(16, { seeds: allSeeded(16) });
    const played = playRound(state, stage, 1);
    expect(rowsOf(played, competition).map((r) => r.split(' ')[0])).toEqual(Array(8).fill('9–16'));
    expect(openOf(played, competition)).toEqual(['1×1', '2×1', '3–4×2', '5–8×4']);
  });

  it('a partly decided range lists those placed and keeps the rest open', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const played = win(state, roundsOf(state, stage)[0][0], 0);
    expect(rowsOf(played, competition)).toEqual(['5–8 P8']);
    expect(openOf(played, competition)).toContain('5–8×3');
  });
});

describe('final places: groups only', () => {
  it('a single group gives individual places from the standings', () => {
    const { state, competition, stage } = drawnGroups(4, { by: 'count', groups: 1 }, { seeds: allSeeded(4) });
    expect(rowsOf(state, competition)).toEqual([]);
    expect(openOf(state, competition)).toEqual(['1×1', '2×1', '3×1', '4×1']);
    const played = playGroups(state, stage, ['A']);
    expect(rowsOf(played, competition)).toEqual(['1 P1', '2 P2', '3 P3', '4 P4']);
    expect(getFinalPlaces(played, competition)!.complete).toBe(true);
  });

  it('4 groups: group winners share 1–4, runners-up 5–8, and a group counts once it is complete', () => {
    const { state, competition, stage } = drawnGroups(8, { by: 'count', groups: 4 }, { seeds: allSeeded(8) });
    expect(openOf(state, competition)).toEqual(['1–4×4', '5–8×4']);

    const partly = playGroups(state, stage, ['A', 'C']);
    const rows = rowsOf(partly, competition);
    expect(rows.filter((r) => r.startsWith('1–4 '))).toHaveLength(2);
    expect(rows.filter((r) => r.startsWith('5–8 '))).toHaveLength(2);
    expect(openOf(partly, competition)).toEqual(['1–4×2', '5–8×2']);

    const played = playGroups(partly, stage, ['B', 'D']);
    expect(rowsOf(played, competition).map((r) => r.split(' ')[0])).toEqual([...Array(4).fill('1–4'), ...Array(4).fill('5–8')]);
    expect(getFinalPlaces(played, competition)).toMatchObject({ complete: true, open: [] });
  });

  it('uneven groups: the last position only counts the groups that have it', () => {
    const { state, competition, stage } = drawnGroups(7, { by: 'count', groups: 2 }, { seeds: allSeeded(7) });
    expect(openOf(state, competition)).toEqual(['1–2×2', '3–4×2', '5–6×2', '7×1']);
    const played = playGroups(state, stage, ['A', 'B']);
    expect(getFinalPlaces(played, competition)!.complete).toBe(true);
    expect(rowsOf(played, competition).map((r) => r.split(' ')[0])).toEqual(['1–2', '1–2', '3–4', '3–4', '5–6', '5–6', '7']);
  });
});
