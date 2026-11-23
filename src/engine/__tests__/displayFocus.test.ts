import { describe, expect, it } from 'vitest';
import { getDisplayFocus, getStage, getTables, type GroupsStageView } from '@/engine';
import { drawnGroupsToBracket, playAllGroups, playBracket } from './groupsToBracketScenarios';
import { groupsOf, run } from './scenarios';

const NOW = 1_000_000;
const setup = () => drawnGroupsToBracket(16, 4, { tables: 2 });
const focus = (state: Parameters<typeof getDisplayFocus>[0], competition: string) => getDisplayFocus(state, competition, NOW);

describe('display focus', () => {
  it('lists the stages in order, with every group while nothing has moved on', () => {
    const { state, competition, groupsStage, bracket } = setup();
    const [groups, bracketFocus] = focus(state, competition);
    expect(groups.stage).toBe(groupsStage);
    expect(groups.type).toBe('groups');
    expect(groups.groups.map((g) => g.group)).toEqual(groupsOf(state, groupsStage).map((g) => g.id));
    expect(bracketFocus.stage).toBe(bracket);
    expect(bracketFocus.groups).toEqual([]);
  });

  it('is empty for a competition that does not exist', () => {
    expect(focus(setup().state, 'nope')).toEqual([]);
  });

  it('gives each group its next match, and the match in play before it', () => {
    const { state, competition, groupsStage } = setup();
    const [a] = groupsOf(state, groupsStage);
    const [first] = focus(state, competition)[0].groups;
    expect(first.matches).toEqual([a.matches[0].id]);

    const table = getTables(state)[0].id;
    const playing = run(state, { type: 'assignMatch', match: a.matches[0].id, table, at: NOW - 60_000 });
    const [now] = focus(playing, competition)[0].groups;
    expect(now.matches).toHaveLength(2);
    expect(now.matches[0]).toBe(a.matches[0].id);
    expect(now.matches[1]).not.toBe(a.matches[0].id);
  });

  it('keeps a finished group while the next stage has not started, and has no current match for it', () => {
    const { state, competition, groupsStage } = setup();
    const played = playAllGroups(state, groupsStage, ['A']);
    const groups = focus(played, competition)[0];
    expect(groups.groups).toHaveLength(4);
    expect(groups.groups[0].matches).toEqual([]);
    expect(groups.started).toBe(true);
    expect(groups.finished).toBe(false);
  });

  it('drops the finished groups once the bracket has started', () => {
    const { state, competition, groupsStage, bracket } = setup();
    const played = run(playAllGroups(state, groupsStage), { type: 'confirmStage', stage: bracket });
    const [groups, bracketFocus] = focus(played, competition);
    expect(groups.finished).toBe(true);
    expect(groups.groups).toEqual([]);
    expect(bracketFocus.started).toBe(true);
    expect(bracketFocus.finished).toBe(false);
  });

  it('has not started a bracket whose draw is not confirmed, and finishes it with its last result', () => {
    const { state, competition, groupsStage, bracket } = setup();
    expect(focus(state, competition)[1]).toMatchObject({ started: false, finished: false });
    const confirmed = run(playAllGroups(state, groupsStage), { type: 'confirmStage', stage: bracket });
    const done = playBracket(confirmed, bracket);
    expect(focus(done, competition)[1]).toMatchObject({ started: true, finished: true });
    expect((getStage(done, groupsStage, NOW) as GroupsStageView).groups.every((g) => g.complete)).toBe(true);
  });
});
