import { describe, expect, it } from 'vitest';
import { execute, getCompetition, getFinalPlaces, type MatchView, type PlaceRange, type SlotView, type TournamentState } from '@/engine';
import { errorOf } from './helpers';
import { bracketOf, competitionWith, drawnDoubleElimination, run, slotLabel } from './scenarios';

/** Seeds 1..n given to P1..Pn. */
const allSeeded = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, i + 1]));

/** The matches of a section, round by round, each round top to bottom. */
function sectionRounds(state: TournamentState, stage: string, section: string): MatchView[][] {
  return bracketOf(state, stage).sections.find((s) => s.section === section)?.rounds.map((r) => r.matches) ?? [];
}

/**
 * The paper sheet's match codes: winners round 1 is M1, M2, ...; the later winners matches are
 * lettered A, B, C, ... round by round; losers matches are numbered L1, L2, ...; "2F" is the 2nd final.
 */
function sheetCodes(state: TournamentState, stage: string): Map<string, string> {
  const codes = new Map<string, string>();
  const [first, ...later] = sectionRounds(state, stage, 'winners');
  first.forEach((m) => codes.set(m.id, `M${m.order}`));
  later.flat().forEach((m, i) => codes.set(m.id, String.fromCharCode(65 + i)));
  sectionRounds(state, stage, 'losers')
    .flat()
    .forEach((m, i) => codes.set(m.id, `L${i + 1}`));
  sectionRounds(state, stage, 'secondFinal')
    .flat()
    .forEach((m) => codes.set(m.id, '2F'));
  return codes;
}

const range = (r: PlaceRange) => (r.from === r.to ? String(r.from) : `${r.from}–${r.to}`);

/** "L5: W L1 v L D · loser 9–12": the match code, its two slot sources and the places it decides. */
function sheet(state: TournamentState, stage: string): string[] {
  const codes = sheetCodes(state, stage);
  const source = (slot: SlotView) => {
    if (slot.source.kind === 'matchResult') return `${slot.source.take === 'winner' ? 'W' : 'L'} ${codes.get(slot.source.match)}`;
    if (slot.source.kind === 'bye') return 'BYE';
    return slot.entry?.players[0].lastName ?? '?';
  };
  return bracketOf(state, stage)
    .sections.flatMap((s) => s.rounds.flatMap((r) => r.matches))
    .map((m) => {
      const places = [m.places?.winner && `winner ${range(m.places.winner)}`, m.places?.loser && `loser ${range(m.places.loser)}`].filter(Boolean);
      return `${codes.get(m.id)}: ${source(m.slots[0])} v ${source(m.slots[1])}${places.length ? ` · ${places.join(', ')}` : ''}`;
    });
}

describe('double elimination: the 16-player paper sheet (golden)', () => {
  it('builds every match with the sheet’s slot sources and place ranges', () => {
    const { state, stage } = drawnDoubleElimination(16, { seeds: allSeeded(16) });
    expect(bracketOf(state, stage).sections.map((s) => s.section)).toEqual(['winners', 'losers', 'secondFinal']);
    expect(sheet(state, stage)).toEqual([
      // Winners bracket: seed positions 1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2.
      'M1: P1 v P16',
      'M2: P9 v P8',
      'M3: P5 v P12',
      'M4: P13 v P4',
      'M5: P3 v P14',
      'M6: P11 v P6',
      'M7: P7 v P10',
      'M8: P15 v P2',
      'A: W M1 v W M2',
      'B: W M3 v W M4',
      'C: W M5 v W M6',
      'D: W M7 v W M8',
      'E: W A v W B',
      'F: W C v W D',
      'G: W E v W F · winner 1',
      // LR1: round-1 losers in pairs.
      'L1: L M1 v L M2 · loser 13–16',
      'L2: L M3 v L M4 · loser 13–16',
      'L3: L M5 v L M6 · loser 13–16',
      'L4: L M7 v L M8 · loser 13–16',
      // LR2: drop-ins from D, C, B, A (crossed).
      'L5: W L1 v L D · loser 9–12',
      'L6: W L2 v L C · loser 9–12',
      'L7: W L3 v L B · loser 9–12',
      'L8: W L4 v L A · loser 9–12',
      // LR3
      'L9: W L5 v W L6 · loser 7–8',
      'L10: W L7 v W L8 · loser 7–8',
      // LR4: drop-ins from F and E (crossed: F into the top half).
      'L11: W L9 v L F · loser 5–6',
      'L12: W L10 v L E · loser 5–6',
      // LR5
      'L13: W L11 v W L12 · loser 4',
      // 2nd final: the WB final loser v the losers-bracket winner.
      '2F: L G v W L13 · winner 2, loser 3',
    ]);
  });

  it('has no places yet before anything is played', () => {
    const { state, competition } = drawnDoubleElimination(16);
    expect(getFinalPlaces(state, competition)).toMatchObject({ rows: [], complete: false });
  });
});

/** For each losers round: the order, within its winners round, of the matches its drop-ins come from (null: none). */
function dropIns(state: TournamentState, stage: string): ({ winnersRound: number; from: number[] } | null)[] {
  const winners = new Map(
    sectionRounds(state, stage, 'winners')
      .flat()
      .map((m) => [m.id, m]),
  );
  return sectionRounds(state, stage, 'losers').map((round) => {
    if (round[0].round === 1) return null; // LR1 pairs the round-1 losers
    const feeders = round.flatMap((m) => m.slots.flatMap((s) => (s.source.kind === 'matchResult' && winners.has(s.source.match) ? [winners.get(s.source.match)!] : [])));
    if (feeders.length === 0) return null;
    return { winnersRound: feeders[0].round, from: feeders.map((m) => m.order) };
  });
}

const losersPlaces = (state: TournamentState, stage: string) =>
  sectionRounds(state, stage, 'losers').map((round) => [...new Set(round.map((m) => range(m.places!.loser!)))].join(' | '));

const roundSizes = (state: TournamentState, stage: string, section: string) => sectionRounds(state, stage, section).map((r) => r.length);

describe('double elimination: structure for 8, 32 and 64', () => {
  it('8: winners 4-2-1, losers 2-2-1, drop-ins from round 2 crossed, places 7–8, 5–6, 4', () => {
    const { state, stage } = drawnDoubleElimination(8);
    expect(bracketOf(state, stage).size).toBe(8);
    expect(roundSizes(state, stage, 'winners')).toEqual([4, 2, 1]);
    expect(roundSizes(state, stage, 'losers')).toEqual([2, 2, 1]);
    expect(roundSizes(state, stage, 'secondFinal')).toEqual([1]);
    expect(dropIns(state, stage)).toEqual([null, { winnersRound: 2, from: [2, 1] }, null]);
    expect(losersPlaces(state, stage)).toEqual(['7–8', '5–6', '4']);
  });

  it('32: winners 16-8-4-2-1, losers 8-8-4-4-2-2-1, drop-ins crossed in every drop-in round', () => {
    const { state, stage } = drawnDoubleElimination(32);
    expect(roundSizes(state, stage, 'winners')).toEqual([16, 8, 4, 2, 1]);
    expect(roundSizes(state, stage, 'losers')).toEqual([8, 8, 4, 4, 2, 2, 1]);
    expect(dropIns(state, stage)).toEqual([
      null,
      { winnersRound: 2, from: [8, 7, 6, 5, 4, 3, 2, 1] },
      null,
      { winnersRound: 3, from: [4, 3, 2, 1] },
      null,
      { winnersRound: 4, from: [2, 1] },
      null,
    ]);
    expect(losersPlaces(state, stage)).toEqual(['25–32', '17–24', '13–16', '9–12', '7–8', '5–6', '4']);
  });

  it('64: 125 matches (63 winners, 61 losers, the 2nd final), shared ranges down to 49–64', () => {
    const { state, stage } = drawnDoubleElimination(64);
    expect(bracketOf(state, stage).sections.flatMap((s) => s.rounds.flatMap((r) => r.matches))).toHaveLength(125);
    expect(roundSizes(state, stage, 'winners')).toEqual([32, 16, 8, 4, 2, 1]);
    expect(roundSizes(state, stage, 'losers')).toEqual([16, 16, 8, 8, 4, 4, 2, 2, 1]);
    expect(dropIns(state, stage).filter(Boolean)).toEqual([
      { winnersRound: 2, from: [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] },
      { winnersRound: 3, from: [8, 7, 6, 5, 4, 3, 2, 1] },
      { winnersRound: 4, from: [4, 3, 2, 1] },
      { winnersRound: 5, from: [2, 1] },
    ]);
    expect(losersPlaces(state, stage)).toEqual(['49–64', '33–48', '25–32', '17–24', '13–16', '9–12', '7–8', '5–6', '4']);
  });

  it('uses the smallest bracket that holds the entries', () => {
    const size = (count: number) => {
      const { state, stage } = drawnDoubleElimination(count);
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
      const configured = run(state, { type: 'configureStages', competition, stages: [{ type: 'doubleElimination' }] });
      const stage = getCompetition(configured, competition)!.stages[0].id;
      expect(errorOf(execute(configured, { type: 'generateDraw', stage, randomSeed: 1 }))).toEqual(error);
    }
  });

  it('is configured as a stage with no options', () => {
    const { state, competition } = drawnDoubleElimination(8, { confirm: false });
    expect(getCompetition(state, competition)!.stages).toEqual([{ id: expect.any(String), drawState: 'drawn', type: 'doubleElimination' }]);
  });
});

/** Slot A wins 3:1, or slot B when `winner` is 1. */
const quick = (winner: 0 | 1) => ({ kind: 'gamesOnly' as const, games: (winner === 0 ? [3, 1] : [1, 3]) as [number, number] });

/** Plays every playable match: the better seed (lower P number) wins, unless `upset(match)` says otherwise. */
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
  getFinalPlaces(state, competition)!.rows.map((r) => `${range(r.place)} ${r.entry.players[0].lastName}`);

const isSecondFinal = (m: MatchView) => m.location.kind === 'bracket' && m.location.section === 'secondFinal';

describe('double elimination: playing a 16-entry event through', () => {
  it('makes the WB final winner champion; the 2nd final decides 2nd and 3rd; losers rounds share their ranges', () => {
    const { state, competition, stage } = drawnDoubleElimination(16, { seeds: allSeeded(16) });
    const played = playOut(state, stage);
    const [secondFinal] = sectionRounds(played, stage, 'secondFinal')[0];
    expect([slotLabel(secondFinal, 0), slotLabel(secondFinal, 1)]).toEqual(['P2', 'P3']); // G's loser v the LR5 winner
    expect(places(played, competition)).toEqual([
      '1 P1',
      '2 P2',
      '3 P3',
      '4 P4',
      '5–6 P6',
      '5–6 P5',
      '7–8 P7',
      '7–8 P8',
      '9–12 P9',
      '9–12 P12',
      '9–12 P11',
      '9–12 P10',
      '13–16 P16',
      '13–16 P13',
      '13–16 P14',
      '13–16 P15',
    ]);
    expect(getFinalPlaces(played, competition)!.complete).toBe(true);
  });

  it('gives 2nd to the losers-bracket winner when it wins the 2nd final, and 3rd to the WB final loser', () => {
    const { state, competition, stage } = drawnDoubleElimination(16, { seeds: allSeeded(16) });
    const played = playOut(state, stage, isSecondFinal);
    expect(places(played, competition).slice(0, 3)).toEqual(['1 P1', '2 P3', '3 P2']);
  });
});

describe('double elimination: BYEs', () => {
  it('sends a BYE into the losers bracket: the opponent of a missing drop-in goes through without playing', () => {
    const { state, stage } = drawnDoubleElimination(13, { seeds: allSeeded(13) });
    const [lr1] = sectionRounds(state, stage, 'losers');
    // M1 is P1 v BYE, so the loser of M1 is a BYE; L1 only waits for the loser of M2 (P9 v P8).
    expect(lr1[0].slots.map((s) => s.bye)).toEqual([true, false]);
    expect(lr1[0].status).toBe('pending');

    const m2 = sectionRounds(state, stage, 'winners')[0][1];
    const next = run(state, { type: 'recordResult', match: m2.id, result: quick(1), at: 0 }); // P8 beats P9
    const [l1] = sectionRounds(next, stage, 'losers')[0];
    expect(l1.decidedByBye).toBe(true);
    expect(l1.status).toBe('finished');
    expect(slotLabel(sectionRounds(next, stage, 'losers')[1][0], 0)).toBe('P9');
  });

  it('passes a BYE on when both round-1 losers are missing, so the next drop-in goes through', () => {
    const { state, stage } = drawnDoubleElimination(9, { seeds: allSeeded(9) });
    const [lr1, lr2] = sectionRounds(state, stage, 'losers');
    expect(lr1.map((m) => m.slots.every((s) => s.bye))).toEqual([false, true, true, true]);
    expect(lr2.map((m) => m.slots[0].bye)).toEqual([false, true, true, true]);
  });

  it('shares only the places of entries that played: 9 in 16 → a single 9th place, every entry placed', () => {
    const { state, competition, stage } = drawnDoubleElimination(9, { seeds: allSeeded(9) });
    const played = playOut(state, stage);
    expect(places(played, competition)).toEqual(['1 P1', '2 P2', '3 P3', '4 P4', '5–6 P6', '5–6 P5', '7–8 P7', '7–8 P8', '9 P9']);
    expect(getFinalPlaces(played, competition)!.complete).toBe(true);
  });

  it('13 in 16 → the one round-1 loser who loses again is 13th', () => {
    const { state, competition, stage } = drawnDoubleElimination(13, { seeds: allSeeded(13) });
    const played = playOut(state, stage);
    expect(places(played, competition).slice(8)).toEqual(['9–12 P9', '9–12 P12', '9–12 P11', '9–12 P10', '13 P13']);
    expect(getFinalPlaces(played, competition)!.complete).toBe(true);
  });
});
