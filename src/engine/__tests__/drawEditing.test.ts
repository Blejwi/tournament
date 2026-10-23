import { describe, expect, it } from 'vitest';
import { execute, getCompetition, getStage, type DrawPosition } from '@/engine';
import { errorOf } from './helpers';
import { drawnBracket, drawnGroups, groupNames, groupsOf, roundsOf, run, slotLabel, slotName } from './scenarios';

const allSeeded = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, i + 1]));

/** 8 seeded entries in 2 groups, drawn but not confirmed: A = P1 P4 P5 P8, B = P2 P3 P6 P7. */
const twoGroups = () => drawnGroups(8, { by: 'count', groups: 2 }, { seeds: allSeeded(8), confirm: false });

const at = (group: string, position: number): DrawPosition => ({ kind: 'group', group, position });

const matchNames = (state: Parameters<typeof groupsOf>[0], stage: string) =>
  groupsOf(state, stage).map((g) => g.matches.map((m) => `${slotName(m, 0)}-${slotName(m, 1)}`));

describe('editing a groups draw before confirming', () => {
  it('swaps two entries between groups; standings and matches follow', () => {
    const { state, stage } = twoGroups();
    expect(groupNames(state, stage)).toEqual([
      ['P1', 'P4', 'P5', 'P8'],
      ['P2', 'P3', 'P6', 'P7'],
    ]);
    const [a, b] = groupsOf(state, stage);

    const next = run(state, { type: 'swapSlots', stage, a: at(a.id, 2), b: at(b.id, 3) });

    expect(groupNames(next, stage)).toEqual([
      ['P1', 'P6', 'P5', 'P8'],
      ['P2', 'P3', 'P4', 'P7'],
    ]);
    const matches = matchNames(next, stage);
    expect(matches[0]).toContain('P1-P6');
    expect(matches[0].join()).not.toContain('P4');
    expect(matches[1].join()).toContain('P4');
    expect(matches[1].join()).not.toContain('P6');
    const standings = groupsOf(next, stage).map((g) => g.standings.map((r) => r.entry!.players[0].lastName).sort());
    expect(standings).toEqual([
      ['P1', 'P5', 'P6', 'P8'],
      ['P2', 'P3', 'P4', 'P7'],
    ]);
  });

  it('keeps the matches (same ids, same order) when swapping, only their players change', () => {
    const { state, stage } = twoGroups();
    const [a, b] = groupsOf(state, stage);
    const next = run(state, { type: 'swapSlots', stage, a: at(a.id, 1), b: at(b.id, 1) });
    const ids = (s: typeof state) => groupsOf(s, stage).map((g) => g.matches.map((m) => m.id));
    expect(ids(next)).toEqual(ids(state));
  });
});

describe('moving an entry to another group before confirming', () => {
  it('moves an entry into another group at the chosen position; both groups get new matches', () => {
    const { state, stage } = twoGroups();
    const [a, b] = groupsOf(state, stage);

    const next = run(state, { type: 'movePlayer', stage, from: at(a.id, 4), to: at(b.id, 5) });

    expect(groupNames(next, stage)).toEqual([
      ['P1', 'P4', 'P5'],
      ['P2', 'P3', 'P6', 'P7', 'P8'],
    ]);
    const [ga, gb] = groupsOf(next, stage);
    expect(ga.matches).toHaveLength(3);
    expect(gb.matches).toHaveLength(10);
    expect(matchNames(next, stage)[1].join()).toContain('P8');
    expect(gb.standings).toHaveLength(5);
  });

  it('reorders the draw positions inside a group', () => {
    const { state, stage } = twoGroups();
    const [a] = groupsOf(state, stage);
    const next = run(state, { type: 'movePlayer', stage, from: at(a.id, 4), to: at(a.id, 1) });
    expect(groupNames(next, stage)[0]).toEqual(['P8', 'P1', 'P4', 'P5']);
  });

  it('keeps at least 2 entries in a group', () => {
    const { state, stage } = drawnGroups(5, { by: 'count', groups: 2 }, { seeds: allSeeded(5), confirm: false });
    const [a, b] = groupsOf(state, stage);
    expect(b.entries).toHaveLength(2);
    const result = execute(state, { type: 'movePlayer', stage, from: at(b.id, 1), to: at(a.id, 1) });
    expect(errorOf(result)).toEqual({ code: 'groupTooSmall', min: 2 });
  });

  it('rejects a position that is not in the draw', () => {
    const { state, stage } = twoGroups();
    const [a, b] = groupsOf(state, stage);
    for (const command of [
      { type: 'swapSlots' as const, stage, a: at(a.id, 5), b: at(b.id, 1) },
      { type: 'swapSlots' as const, stage, a: at('nope', 1), b: at(b.id, 1) },
      { type: 'swapSlots' as const, stage, a: { kind: 'bracket' as const, position: 1 }, b: at(b.id, 1) },
      { type: 'movePlayer' as const, stage, from: at(a.id, 1), to: at(b.id, 6) },
      { type: 'movePlayer' as const, stage, from: at(a.id, 1), to: at(a.id, 5) },
    ]) {
      expect(errorOf(execute(state, command))).toEqual({ code: 'drawPositionNotFound' });
    }
  });
});

/** 13 seeded entries in 16, not confirmed: P1 v BYE, P9 v P8, P5 v P12, P13 v P4, P3 v BYE, P11 v P6, P7 v P10, BYE v P2. */
const bracket13 = () => drawnBracket(13, { seeds: allSeeded(13), confirm: false });
const pos = (position: number): DrawPosition => ({ kind: 'bracket', position });
const firstRound = (state: Parameters<typeof roundsOf>[0], stage: string) => roundsOf(state, stage)[0].map((m) => `${slotLabel(m, 0)} v ${slotLabel(m, 1)}`);

describe('editing a bracket draw before confirming', () => {
  it('swaps two bracket positions; the BYE match and the next round follow', () => {
    const { state, stage } = bracket13();
    const next = run(state, { type: 'swapSlots', stage, a: pos(1), b: pos(3) });

    expect(firstRound(next, stage).slice(0, 2)).toEqual(['P9 v BYE', 'P1 v P8']);
    expect(slotLabel(roundsOf(next, stage)[1][0], 0)).toBe('P9');
  });

  it('moves an entry onto a BYE, which takes its old position', () => {
    const { state, stage } = bracket13();
    const next = run(state, { type: 'movePlayer', stage, from: pos(3), to: pos(2) });
    expect(firstRound(next, stage).slice(0, 2)).toEqual(['P1 v P9', 'BYE v P8']);
  });

  it('moves only onto a BYE; onto a player it is a swap', () => {
    const { state, stage } = bracket13();
    expect(errorOf(execute(state, { type: 'movePlayer', stage, from: pos(3), to: pos(4) }))).toEqual({ code: 'positionTaken' });
  });

  it('never puts a BYE on both sides of a first-round match', () => {
    const { state, stage } = bracket13();
    expect(errorOf(execute(state, { type: 'swapSlots', stage, a: pos(1), b: pos(10) }))).toEqual({ code: 'byeAgainstBye' });
  });

  it('rejects positions outside the bracket', () => {
    const { state, stage } = bracket13();
    for (const b of [pos(0), pos(17), at('group-1', 1)]) {
      expect(errorOf(execute(state, { type: 'swapSlots', stage, a: pos(1), b }))).toEqual({ code: 'drawPositionNotFound' });
    }
  });

  it('is locked once the bracket is confirmed', () => {
    const { state, stage } = bracket13();
    const confirmed = run(state, { type: 'confirmStage', stage });
    expect(errorOf(execute(confirmed, { type: 'swapSlots', stage, a: pos(1), b: pos(3) }))).toEqual({ code: 'stageConfirmed' });
    expect(errorOf(execute(confirmed, { type: 'movePlayer', stage, from: pos(3), to: pos(2) }))).toEqual({ code: 'stageConfirmed' });
  });
});

describe('re-drawing before confirming', () => {
  it('gives a new bracket draw for a new random seed; seeded entries stay on their positions', () => {
    const { state, stage } = drawnBracket(16, { seeds: { 1: 1, 2: 2, 3: 3, 4: 4 }, confirm: false, randomSeed: 1 });
    const edited = run(state, { type: 'swapSlots', stage, a: pos(1), b: pos(2) });
    const redrawn = run(edited, { type: 'generateDraw', stage, randomSeed: 2 });

    const positions = (s: typeof state) => roundsOf(s, stage)[0].flatMap((m) => [slotLabel(m, 0), slotLabel(m, 1)]);
    const before = positions(state);
    const after = positions(redrawn);
    for (const [seed, position] of [
      ['P1', 1],
      ['P4', 8],
      ['P3', 9],
      ['P2', 16],
    ] as const) {
      expect(after[position - 1]).toBe(seed);
      expect(before[position - 1]).toBe(seed);
    }
    expect(after).not.toEqual(before);
    expect(getStage(redrawn, stage, 0)!.drawState).toBe('drawn');
  });

  it('gives a new groups draw for a new random seed; seeded entries stay in their groups', () => {
    const { state, stage } = drawnGroups(16, { by: 'count', groups: 4 }, { seeds: { 1: 1, 2: 2, 3: 3, 4: 4 }, confirm: false, randomSeed: 1 });
    const redrawn = run(state, { type: 'generateDraw', stage, randomSeed: 2 });
    expect(groupNames(redrawn, stage).map((g) => g[0])).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(groupNames(redrawn, stage)).not.toEqual(groupNames(state, stage));
  });
});

describe('the draw is locked once confirmed', () => {
  it('rejects swaps and moves after confirmation, and before the draw', () => {
    const drawn = twoGroups();
    const [a, b] = groupsOf(drawn.state, drawn.stage);
    const swap = { type: 'swapSlots' as const, stage: drawn.stage, a: at(a.id, 1), b: at(b.id, 1) };
    const move = { type: 'movePlayer' as const, stage: drawn.stage, from: at(a.id, 1), to: at(b.id, 1) };
    const confirmed = run(drawn.state, { type: 'confirmStage', stage: drawn.stage });
    expect(errorOf(execute(confirmed, swap))).toEqual({ code: 'stageConfirmed' });
    expect(errorOf(execute(confirmed, move))).toEqual({ code: 'stageConfirmed' });

    const notDrawn = run(drawn.state, {
      type: 'configureStages',
      competition: drawn.competition,
      stages: [{ type: 'groups', grouping: { by: 'count', groups: 2 } }],
    });
    const stage = getCompetition(notDrawn, drawn.competition)!.stages[0].id;
    expect(errorOf(execute(notDrawn, { ...swap, stage }))).toEqual({ code: 'stageNotDrawn' });
    expect(errorOf(execute(notDrawn, { ...move, stage }))).toEqual({ code: 'stageNotDrawn' });
  });
});
