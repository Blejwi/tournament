import { describe, expect, it } from 'vitest';
import {
  execute,
  getCompetition,
  getFinalPlaces,
  getMatch,
  getWaitingList,
  parseResult,
  type MatchView,
  type TournamentState,
} from '@/engine';
import { errorOf } from './helpers';
import { bracketOf, competitionWith, drawnBracket, roundsOf, run, slotLabel, tableId } from './scenarios';

/** Seeds 1..n given to P1..Pn. */
const allSeeded = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, i + 1]));

/** The seed numbers of round 1, top to bottom (P7 holds seed 7). */
function firstRoundSeeds(count: number): number[] {
  const { state, stage } = drawnBracket(count, { seeds: allSeeded(count) });
  return roundsOf(state, stage)[0].flatMap((m) => [0, 1].map((slot) => Number(slotLabel(m, slot as 0 | 1).slice(1))));
}

describe('single elimination: seed positions', () => {
  it('places 8 seeds top to bottom as 1, 8, 5, 4, 3, 6, 7, 2', () => {
    expect(firstRoundSeeds(8)).toEqual([1, 8, 5, 4, 3, 6, 7, 2]);
  });

  it('places 16 seeds top to bottom as 1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2', () => {
    expect(firstRoundSeeds(16)).toEqual([1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2]);
  });

  it('places 32 seeds in the standard order', () => {
    expect(firstRoundSeeds(32)).toEqual([
      1, 32, 17, 16, 9, 24, 25, 8, 5, 28, 21, 12, 13, 20, 29, 4, 3, 30, 19, 14, 11, 22, 27, 6, 7, 26, 23, 10, 15, 18, 31, 2,
    ]);
  });

  it('places 64 seeds in the standard order', () => {
    expect(firstRoundSeeds(64)).toEqual([
      1, 64, 33, 32, 17, 48, 49, 16, 9, 56, 41, 24, 25, 40, 57, 8, 5, 60, 37, 28, 21, 44, 53, 12, 13, 52, 45, 20, 29, 36, 61, 4,
      3, 62, 35, 30, 19, 46, 51, 14, 11, 54, 43, 22, 27, 38, 59, 6, 7, 58, 39, 26, 23, 42, 55, 10, 15, 50, 47, 18, 31, 34, 63, 2,
    ]);
  });

  it('gives unseeded entries random numbers below the seeds, the same for the same random seed', () => {
    const draw = (randomSeed: number) => {
      const { state, stage } = drawnBracket(8, { seeds: { 5: 1, 6: 2 }, randomSeed });
      return roundsOf(state, stage)[0].flatMap((m) => [slotLabel(m, 0), slotLabel(m, 1)]);
    };
    const first = draw(1);
    expect([first[0], first[7]]).toEqual(['P5', 'P6']);
    expect(draw(1)).toEqual(first);
    expect([1, 2, 3, 4, 5, 6].map(draw).some((d) => d.join() !== first.join())).toBe(true);
  });

  it('configures a single elimination stage, optionally with a 3rd-place match', () => {
    const { state, competition } = drawnBracket(8, { thirdPlace: true, confirm: false });
    expect(getCompetition(state, competition)!.stages).toEqual([
      { id: expect.any(String), drawState: 'drawn', type: 'singleElimination', thirdPlace: true },
    ]);
  });
});

describe('single elimination: bracket size and BYEs', () => {
  it('uses the smallest bracket of 8, 16, 32 or 64 that holds the entries', () => {
    const size = (count: number) => {
      const { state, stage } = drawnBracket(count);
      return bracketOf(state, stage).size;
    };
    expect([8, 9, 16, 17, 33, 64].map(size)).toEqual([8, 16, 16, 32, 64, 64]);
  });

  it('needs at least 8 and at most 64 entries', () => {
    for (const [count, error] of [
      [7, { code: 'notEnoughEntries', needed: 8 }],
      [65, { code: 'tooManyEntries', max: 64 }],
    ] as const) {
      const { state, competition } = competitionWith(count);
      const configured = run(state, { type: 'configureStages', competition, stages: [{ type: 'singleElimination', thirdPlace: false }] });
      const stage = getCompetition(configured, competition)!.stages[0].id;
      expect(errorOf(execute(configured, { type: 'generateDraw', stage, randomSeed: 1 }))).toEqual(error);
    }
  });

  it('gives the BYEs the highest numbers: 13 entries in 16 → 14, 15 and 16 are BYEs, and seeds 1–3 go through', () => {
    const { state, stage } = drawnBracket(13, { seeds: allSeeded(13) });
    const [first, second] = roundsOf(state, stage);

    expect(first.map((m) => `${slotLabel(m, 0)} v ${slotLabel(m, 1)}`)).toEqual([
      'P1 v BYE',
      'P9 v P8',
      'P5 v P12',
      'P13 v P4',
      'P3 v BYE',
      'P11 v P6',
      'P7 v P10',
      'BYE v P2',
    ]);
    const byeMatches = first.filter((m) => m.decidedByBye);
    expect(byeMatches.map((m) => m.status)).toEqual(['finished', 'finished', 'finished']);
    expect(byeMatches.map((m) => m.result)).toEqual([null, null, null]);
    expect(second.map((m) => [slotLabel(m, 0), slotLabel(m, 1)])).toEqual([
      ['P1', '?'],
      ['?', '?'],
      ['P3', '?'],
      ['?', 'P2'],
    ]);
    expect(getWaitingList(state, 0).some((m) => m.decidedByBye)).toBe(false);
  });

  it('cannot call or score a match decided by a BYE', () => {
    const { state, stage } = drawnBracket(13, { tables: 1 });
    const bye = roundsOf(state, stage)[0].find((m) => m.decidedByBye)!;
    expect(errorOf(execute(state, { type: 'assignMatch', match: bye.id, table: tableId(state, 1), at: 0 }))).toEqual({
      code: 'matchNotReady',
      status: 'finished',
    });
    expect(errorOf(execute(state, { type: 'recordResult', match: bye.id, result: { kind: 'gamesOnly', games: [3, 0] }, at: 0 }))).toEqual({
      code: 'matchFinished',
    });
  });

  it('shows pending slots by their source: the winner of an earlier match', () => {
    const { state, stage } = drawnBracket(8);
    const [quarterFinals, semiFinals] = roundsOf(state, stage);
    expect(semiFinals[1].slots.map((s) => s.feeder)).toEqual([
      { match: quarterFinals[2].id, take: 'winner', location: { kind: 'bracket', section: 'main', roundMatches: 4, rounds: 3 }, round: 1, order: 3 },
      { match: quarterFinals[3].id, take: 'winner', location: { kind: 'bracket', section: 'main', roundMatches: 4, rounds: 3 }, round: 1, order: 4 },
    ]);
    expect(semiFinals[1].status).toBe('pending');
  });
});

/** Slot A wins 3:1, or slot B when `winner` is 1. */
const quick = (winner: 0 | 1 = 0) => ({ kind: 'gamesOnly' as const, games: (winner === 0 ? [3, 1] : [1, 3]) as [number, number] });

/**
 * Plays every playable match of the bracket, round by round: the better seed (lower P number)
 * wins, unless `upset(match)` says otherwise.
 */
function playOut(state: TournamentState, stage: string, upset: (m: MatchView) => boolean = () => false): TournamentState {
  for (;;) {
    const next = bracketOf(state, stage)
      .sections.flatMap((s) => s.rounds.flatMap((r) => r.matches))
      .find((m) => m.status === 'ready');
    if (!next) return state;
    const [a, b] = [0, 1].map((slot) => Number(slotLabel(next, slot as 0 | 1).slice(1)));
    const better = a < b ? 0 : 1;
    state = run(state, { type: 'recordResult', match: next.id, result: quick(upset(next) ? ((1 - better) as 0 | 1) : better), at: 0 });
  }
}

const places = (state: TournamentState, competition: string) =>
  getFinalPlaces(state, competition)!.rows.map((r) => `${r.place.from === r.place.to ? r.place.from : `${r.place.from}–${r.place.to}`} ${r.entry.players[0].lastName}`);

describe('single elimination: advancing and final places', () => {
  it('advances the winner of a match into the next match', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const [quarterFinals] = roundsOf(state, stage);
    const next = run(
      state,
      { type: 'recordResult', match: quarterFinals[0].id, result: quick(1), at: 0 },
      { type: 'recordResult', match: quarterFinals[1].id, result: quick(0), at: 0 },
    );
    const semiFinal = roundsOf(next, stage)[1][0];
    expect([slotLabel(semiFinal, 0), slotLabel(semiFinal, 1)]).toEqual(['P8', 'P5']);
    expect(semiFinal.status).toBe('ready');
  });

  it('puts the semi-final losers into the 3rd-place match', () => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8), thirdPlace: true });
    const played = playOut(state, stage, (m) => m.round === 2);
    const [thirdPlace] = roundsOf(played, stage, 'thirdPlace');
    expect(thirdPlace.map((m) => [slotLabel(m, 0), slotLabel(m, 1)])).toEqual([['P1', 'P2']]);
    expect(thirdPlace[0].slots.map((s) => s.feeder?.take)).toEqual(['loser', 'loser']);
  });

  it('derives 1st, 2nd, a shared 3–4 without a 3rd-place match, then shared ranges', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    expect(getFinalPlaces(state, competition)).toMatchObject({ rows: [], complete: false });

    const played = playOut(state, stage, (m) => m.round === 1 && m.order === 2); // P5 beats P4
    // Within a shared range, top to bottom of the bracket.
    expect(places(played, competition)).toEqual(['1 P1', '2 P2', '3–4 P5', '3–4 P3', '5–8 P8', '5–8 P4', '5–8 P6', '5–8 P7']);
    expect(getFinalPlaces(played, competition)!.complete).toBe(true);
  });

  it('decides 3rd and 4th with the 3rd-place match', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8), thirdPlace: true });
    const played = playOut(state, stage, (m) => m.location.kind === 'bracket' && m.location.section === 'thirdPlace');
    expect(places(played, competition).slice(0, 4)).toEqual(['1 P1', '2 P2', '3 P4', '4 P3']);
  });

  it('shares only the places of entries that played: 13 in 16 → round-1 losers share 9–13', () => {
    const { state, competition, stage } = drawnBracket(13, { seeds: allSeeded(13) });
    const played = playOut(state, stage);
    expect(places(played, competition).slice(8)).toEqual(['9–13 P9', '9–13 P12', '9–13 P13', '9–13 P11', '9–13 P10']);
    expect(getFinalPlaces(played, competition)!.complete).toBe(true);
  });
});

describe('single elimination: quick results', () => {
  it('accepts a games-only result such as 3:1 for a bracket match', () => {
    const { state, stage } = drawnBracket(8);
    const match = roundsOf(state, stage)[0][0];
    expect(match.gamesOnlyAllowed).toBe(true);
    const next = run(state, { type: 'recordResult', match: match.id, result: { kind: 'gamesOnly', games: [1, 3] }, at: 0 });
    expect(getMatch(next, match.id, 0)!.result).toEqual({ kind: 'gamesOnly', winner: 1, gamesWon: [1, 3], games: null });
  });

  it('parses "3:1" as games only and game scores as games', () => {
    expect(parseResult('3:1')).toEqual({ ok: true, value: { kind: 'gamesOnly', games: [3, 1] } });
    expect(parseResult(' 0-3 ')).toEqual({ ok: true, value: { kind: 'gamesOnly', games: [0, 3] } });
    expect(parseResult('11-7 3-11')).toEqual({ ok: true, value: { kind: 'games', games: [[11, 7], [3, 11]] } });
    expect(parseResult('11-9')).toEqual({ ok: true, value: { kind: 'games', games: [[11, 9]] } });
  });
});
