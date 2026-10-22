import { describe, expect, it } from 'vitest';
import { execute, getCompetition, getPlayers, getStage, type Command, type TournamentState } from '@/engine';
import { errorOf } from './helpers';
import { competitionWith, drawnGroups, groupNames, groupsOf, run, slotName } from './scenarios';

const allSeeded = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, i + 1]));

describe('configuring a groups stage', () => {
  it('shows the configured stage, not yet drawn', () => {
    const { state, competition } = competitionWith(8);
    const next = run(state, { type: 'configureStages', competition, stages: [{ type: 'groups', grouping: { by: 'count', groups: 2 } }] });

    expect(getCompetition(next, competition)!.stages).toEqual([
      { id: expect.any(String), type: 'groups', drawState: 'notDrawn', grouping: { by: 'count', groups: 2 } },
    ]);
  });

  it('rejects a number of groups or a group size below the minimum', () => {
    const { state, competition } = competitionWith(8);
    for (const grouping of [
      { by: 'count', groups: 0 },
      { by: 'count', groups: 1.5 },
      { by: 'size', size: 1 },
    ] as const) {
      const result = execute(state, { type: 'configureStages', competition, stages: [{ type: 'groups', grouping }] });
      expect(errorOf(result)).toEqual({ code: 'invalidGrouping' });
    }
  });

  it('supports only a single groups stage for now', () => {
    const { state, competition } = competitionWith(8);
    const groups = { type: 'groups', grouping: { by: 'count', groups: 2 } } as const;
    for (const stages of [[], [groups, groups]]) {
      expect(errorOf(execute(state, { type: 'configureStages', competition, stages }))).toEqual({
        code: 'unsupportedStageChain',
      });
    }
  });
});

describe('drawing groups', () => {
  it('places seeded entries snake-style: 1 → A, 2 → B, then back again', () => {
    const { state, stage } = drawnGroups(8, { by: 'count', groups: 4 }, { seeds: allSeeded(8) });
    expect(groupNames(state, stage)).toEqual([
      ['P1', 'P8'],
      ['P2', 'P7'],
      ['P3', 'P6'],
      ['P4', 'P5'],
    ]);
  });

  it('places the unseeded entries at random after the seeded ones, each exactly once', () => {
    const { state, stage } = drawnGroups(12, { by: 'count', groups: 3 }, { seeds: { 1: 1, 2: 2, 3: 3 } });
    const groups = groupNames(state, stage);

    expect(groups.map((g) => g[0])).toEqual(['P1', 'P2', 'P3']);
    expect(groups.map((g) => g.length)).toEqual([4, 4, 4]);
    expect(groups.flat().sort()).toEqual(Array.from({ length: 12 }, (_, i) => `P${i + 1}`).sort());
  });

  it('makes uneven groups when the entries do not divide evenly, the first groups one larger', () => {
    const { state, stage } = drawnGroups(10, { by: 'count', groups: 3 }, { seeds: allSeeded(10) });
    expect(groupNames(state, stage)).toEqual([
      ['P1', 'P6', 'P7', 'P10'],
      ['P2', 'P5', 'P8'],
      ['P3', 'P4', 'P9'],
    ]);
  });

  it('works out the number of groups from a group size', () => {
    const bySize = drawnGroups(10, { by: 'size', size: 3 }, { seeds: allSeeded(10) });
    expect(groupNames(bySize.state, bySize.stage).map((g) => g.length)).toEqual([3, 3, 2, 2]);
    expect(groupsOf(bySize.state, bySize.stage).map((g) => g.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('gives the same draw for the same random seed, and a different one for another seed', () => {
    const draw = (randomSeed: number) => {
      const { state, stage } = drawnGroups(16, { by: 'count', groups: 4 }, { seeds: { 1: 1, 2: 2 }, randomSeed });
      return groupNames(state, stage);
    };
    expect(draw(7)).toEqual(draw(7));
    expect([draw(8), draw(9), draw(10)].some((d) => JSON.stringify(d) !== JSON.stringify(draw(7)))).toBe(true);
  });

  it('needs at least 2 entries in every group', () => {
    const { state, competition } = competitionWith(5);
    const configured = run(state, { type: 'configureStages', competition, stages: [{ type: 'groups', grouping: { by: 'count', groups: 3 } }] });
    const stage = getCompetition(configured, competition)!.stages[0].id;
    expect(errorOf(execute(configured, { type: 'generateDraw', stage, randomSeed: 1 }))).toEqual({
      code: 'notEnoughEntries',
      needed: 6,
    });
  });

  it('reports an unknown stage', () => {
    const { state } = competitionWith(4);
    expect(errorOf(execute(state, { type: 'generateDraw', stage: 'nope', randomSeed: 1 }))).toEqual({
      code: 'stageNotFound',
      stage: 'nope',
    });
  });
});

describe('confirming the draw', () => {
  const unconfirmed = () => drawnGroups(6, { by: 'count', groups: 2 }, { confirm: false });
  const statuses = (state: TournamentState, stage: string) => groupsOf(state, stage).flatMap((g) => g.matches.map((m) => m.status));

  it('keeps matches pending until the draw is confirmed, then they are ready', () => {
    const { state, stage } = unconfirmed();
    expect(new Set(statuses(state, stage))).toEqual(new Set(['pending']));

    const confirmed = run(state, { type: 'confirmStage', stage });
    expect(new Set(statuses(confirmed, stage))).toEqual(new Set(['ready']));
    expect(getStage(confirmed, stage, 0)!.drawState).toBe('confirmed');
  });

  it('can re-draw before confirming, but not after', () => {
    const { state, stage } = unconfirmed();
    const redrawn = run(state, { type: 'generateDraw', stage, randomSeed: 99 });
    expect(getStage(redrawn, stage, 0)!.drawState).toBe('drawn');

    const confirmed = run(redrawn, { type: 'confirmStage', stage });
    expect(errorOf(execute(confirmed, { type: 'generateDraw', stage, randomSeed: 1 }))).toEqual({ code: 'stageConfirmed' });
    expect(errorOf(execute(confirmed, { type: 'confirmStage', stage }))).toEqual({ code: 'stageConfirmed' });
  });

  it('cannot confirm a stage that has not been drawn', () => {
    const { state, competition } = competitionWith(4);
    const configured = run(state, { type: 'configureStages', competition, stages: [{ type: 'groups', grouping: { by: 'count', groups: 1 } }] });
    const stage = getCompetition(configured, competition)!.stages[0].id;
    expect(errorOf(execute(configured, { type: 'confirmStage', stage }))).toEqual({ code: 'stageNotDrawn' });
  });

  it('discards an unconfirmed draw when the entries or seeds change', () => {
    const { state, competition, stage } = unconfirmed();
    const entry = getCompetition(state, competition)!.entries[0].id;
    for (const cmd of [
      { type: 'setSeed', competition, entry, seed: 1 },
      { type: 'removeEntry', competition, entry },
    ] as const) {
      const next = run(state, cmd);
      expect(getStage(next, stage, 0)).toMatchObject({ drawState: 'notDrawn', groups: [] });
    }
  });

  it('locks the entries, seeds and stage chain once the first stage is confirmed', () => {
    const { state, competition } = drawnGroups(6, { by: 'count', groups: 2 });
    const entry = getCompetition(state, competition)!.entries[0].id;
    const extra = run(state, { type: 'addPlayer', firstName: 'Late', lastName: 'Comer', club: '' });
    const player = getPlayers(extra).find((p) => p.lastName === 'Comer')!.id;
    const cases: [TournamentState, Command][] = [
      [extra, { type: 'enterPlayer', competition, player }],
      [state, { type: 'removeEntry', competition, entry }],
      [state, { type: 'setSeed', competition, entry, seed: 3 }],
      [state, { type: 'configureStages', competition, stages: [{ type: 'groups', grouping: { by: 'count', groups: 3 } }] }],
    ];
    for (const [s, cmd] of cases) {
      expect(errorOf(execute(s, cmd))).toEqual({ code: 'stageConfirmed' });
    }
  });
});

describe('Berger round robin order', () => {
  /** Each round's matches as "position-position", from the draw positions of the entries. */
  function bergerOrder(count: number): string[][] {
    const { state, stage } = drawnGroups(count, { by: 'count', groups: 1 }, { seeds: allSeeded(count) });
    const [group] = groupsOf(state, stage);
    const position = (name: string) => group.entries.findIndex((s) => s.entry?.players[0].lastName === name) + 1;
    const rounds: string[][] = [];
    for (const m of group.matches) {
      (rounds[m.round - 1] ??= [])[m.order - 1] = `${position(slotName(m, 0))}-${position(slotName(m, 1))}`;
    }
    return rounds;
  }

  it('orders a group of 4 by the Berger table', () => {
    expect(bergerOrder(4)).toEqual([
      ['1-4', '2-3'],
      ['4-3', '1-2'],
      ['2-4', '3-1'],
    ]);
  });

  it('gives one entry a rest each round in an odd group', () => {
    expect(bergerOrder(3)).toEqual([['2-3'], ['1-2'], ['3-1']]);
    expect(bergerOrder(5)).toEqual([
      ['2-5', '3-4'],
      ['5-3', '1-2'],
      ['3-1', '4-5'],
      ['1-4', '2-3'],
      ['4-2', '5-1'],
    ]);
  });

  it('orders a group of 6 by the Berger table', () => {
    expect(bergerOrder(6)).toEqual([
      ['1-6', '2-5', '3-4'],
      ['6-4', '5-3', '1-2'],
      ['2-6', '3-1', '4-5'],
      ['6-5', '1-4', '2-3'],
      ['3-6', '4-2', '5-1'],
    ]);
  });

  it('creates every pairing of an uneven draw exactly once per group', () => {
    const { state, stage } = drawnGroups(7, { by: 'count', groups: 2 });
    expect(groupsOf(state, stage).map((g) => g.matches.length)).toEqual([6, 3]);
  });
});
