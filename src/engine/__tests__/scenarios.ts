import {
  execute,
  getCompetition,
  getCompetitions,
  getPlayers,
  getStage,
  getTables,
  type SingleEliminationStageView,
  type Command,
  type Grouping,
  type GroupsStageView,
  type MatchView,
  type TournamentState,
} from '@/engine';
import { newTournament, unwrap } from './helpers';

/** Runs commands in order, failing the test on the first engine error. */
export function run(state: TournamentState, ...commands: Command[]): TournamentState {
  return commands.reduce((s, cmd) => unwrap(execute(s, cmd)), state);
}

/**
 * A tournament with one competition of `count` entries named P1..Pn (last name), with tables 1..`tables`.
 * `seeds` maps a player number to its seed, e.g. { 1: 1, 7: 2 } seeds P1 first and P7 second.
 */
export function competitionWith(
  count: number,
  options: { seeds?: Record<number, number>; tables?: number; gamesToWin?: 2 | 3 | 4 } = {},
) {
  let state = newTournament();
  for (let i = 1; i <= (options.tables ?? 0); i++) state = run(state, { type: 'addTable', number: i });
  for (let i = 1; i <= count; i++) state = run(state, { type: 'addPlayer', firstName: 'Player', lastName: `P${i}`, club: '' });
  state = run(state, { type: 'addCompetition', name: 'Open', gamesToWin: options.gamesToWin });
  const competition = getCompetitions(state)[0].id;
  for (const player of getPlayers(state)) state = run(state, { type: 'enterPlayer', competition, player: player.id });
  for (const [number, seed] of Object.entries(options.seeds ?? {})) {
    const entry = getCompetition(state, competition)!.entries.find((e) => e.players[0].lastName === `P${number}`)!;
    state = run(state, { type: 'setSeed', competition, entry: entry.id, seed });
  }
  return { state, competition };
}

/** Configures a single groups stage, draws it with `randomSeed` and (by default) confirms it. */
export function drawnGroups(
  count: number,
  grouping: Grouping,
  options: Parameters<typeof competitionWith>[1] & { randomSeed?: number; confirm?: boolean } = {},
) {
  const setup = competitionWith(count, options);
  let state = run(setup.state, { type: 'configureStages', competition: setup.competition, stages: [{ type: 'groups', grouping }] });
  const stage = getCompetition(state, setup.competition)!.stages[0].id;
  state = run(state, { type: 'generateDraw', stage, randomSeed: options.randomSeed ?? 42 });
  if (options.confirm ?? true) state = run(state, { type: 'confirmStage', stage });
  return { state, competition: setup.competition, stage };
}

/** Configures a single elimination stage, draws it with `randomSeed` and (by default) confirms it. */
export function drawnBracket(
  count: number,
  options: Parameters<typeof competitionWith>[1] & { randomSeed?: number; confirm?: boolean; thirdPlace?: boolean } = {},
) {
  const setup = competitionWith(count, options);
  let state = run(setup.state, {
    type: 'configureStages',
    competition: setup.competition,
    stages: [{ type: 'singleElimination', thirdPlace: options.thirdPlace ?? false }],
  });
  const stage = getCompetition(state, setup.competition)!.stages[0].id;
  state = run(state, { type: 'generateDraw', stage, randomSeed: options.randomSeed ?? 42 });
  if (options.confirm ?? true) state = run(state, { type: 'confirmStage', stage });
  return { state, competition: setup.competition, stage };
}

export function bracketOf(state: TournamentState, stage: string, now = 0): SingleEliminationStageView {
  const view = getStage(state, stage, now);
  if (view?.type !== 'singleElimination') throw new Error(`Stage ${stage} is not a bracket stage`);
  return view;
}

/** The matches of one bracket section, round by round, each round top to bottom. */
export function roundsOf(state: TournamentState, stage: string, section = 'main', now = 0): MatchView[][] {
  const found = bracketOf(state, stage, now).sections.find((s) => s.section === section);
  if (!found) throw new Error(`No section ${section}`);
  return found.rounds.map((r) => r.matches);
}

/** "P3" for an entry, "BYE" for a BYE, "?" while undecided. */
export const slotLabel = (match: MatchView, slot: 0 | 1) => (match.slots[slot].source.kind === 'bye' ? 'BYE' : slotName(match, slot));

export function groupsOf(state: TournamentState, stage: string, now = 0): GroupsStageView['groups'] {
  const view = getStage(state, stage, now);
  if (view?.type !== 'groups') throw new Error(`Stage ${stage} is not a groups stage`);
  return view.groups;
}

/** The last names of a group's entries, in draw position order. */
export function groupNames(state: TournamentState, stage: string): string[][] {
  return groupsOf(state, stage).map((g) => g.entries.map((slot) => slot.entry?.players[0].lastName ?? '?'));
}

/** Last name of the entry in a match slot. */
export const slotName = (match: MatchView, slot: 0 | 1) => match.slots[slot].entry?.players[0].lastName ?? '?';

export function tableId(state: TournamentState, number: number): string {
  return getTables(state).find((t) => t.number === number)!.id;
}

/** The group matches between two players (by last name), in either slot order. */
export function matchBetween(state: TournamentState, stage: string, a: string, b: string, now = 0): MatchView {
  for (const group of groupsOf(state, stage, now)) {
    const match = group.matches.find((m) => {
      const names = [slotName(m, 0), slotName(m, 1)];
      return names.includes(a) && names.includes(b);
    });
    if (match) return match;
  }
  throw new Error(`No match between ${a} and ${b}`);
}
