import { groupStandings, type Standings } from './stages/groups';
import type { Competition, Entry, Group, GroupsStage, Match, MatchId, PlayerId, SlotSource, Stage, TournamentState } from './types';

/**
 * A match's derived status (from the spec). Never stored: worked out from the draw and the results.
 * - pending: a slot isn't resolved to an entry yet (or the stage isn't confirmed)
 * - ready: both entries known, neither player is playing elsewhere
 * - busy: both known, but a player is in an in-progress match elsewhere
 * - in_progress / overdue: called to a table (overdue: past its expected duration, #0005)
 * - finished / walkover: has a result (walkover: #0014)
 * - disabled: a place play-off that isn't switched on (#0012)
 */
export type MatchStatus = 'pending' | 'ready' | 'busy' | 'in_progress' | 'overdue' | 'finished' | 'walkover' | 'disabled';

export interface DerivedMatch {
  match: Match;
  competition: Competition;
  stage: Stage;
  stageIndex: number;
  /** The entries resolved from the slots' sources; null while a source isn't decided yet (or a BYE). */
  entries: [Entry | null, Entry | null];
  /** Slot index of the winner, once there is a result. */
  winner: 0 | 1 | null;
  status: MatchStatus;
}

export interface Derived {
  /** Every match of the tournament: competition order, then stage order, then the stage's own order. */
  matches: DerivedMatch[];
  match(id: MatchId): DerivedMatch | undefined;
  standings(stage: GroupsStage, group: Group): Standings;
  resolve(competition: Competition, source: SlotSource): Entry | null;
}

/** Slot index of the winner of a recorded result. */
export function winnerOf(match: Match): 0 | 1 | null {
  const { result } = match;
  if (!result) return null;
  const [a, b] = result.kind === 'games' ? gamesWon(result.games) : result.games;
  return a > b ? 0 : 1;
}

export function gamesWon(games: [number, number][]): [number, number] {
  return games.reduce<[number, number]>(([a, b], [x, y]) => (x > y ? [a + 1, b] : [a, b + 1]), [0, 0]);
}

/** Resolves every slot through its source (ADR 0003) and derives each match's status. */
export function derive(state: TournamentState): Derived {
  const located = new Map<MatchId, { match: Match; competition: Competition; stage: Stage; stageIndex: number }>();
  const competitionOf = new Map<Stage, Competition>();
  for (const competition of state.competitions) {
    competition.stages.forEach((stage, stageIndex) => {
      competitionOf.set(stage, competition);
      for (const match of stage.matches) located.set(match.id, { match, competition, stage, stageIndex });
    });
  }

  const entriesMemo = new Map<MatchId, [Entry | null, Entry | null]>();
  const standingsMemo = new Map<Group, Standings>();

  const matchEntries = (id: MatchId): [Entry | null, Entry | null] => {
    const memo = entriesMemo.get(id);
    if (memo) return memo;
    const { match, competition } = located.get(id)!;
    const entries: [Entry | null, Entry | null] = [resolve(competition, match.slots[0]), resolve(competition, match.slots[1])];
    entriesMemo.set(id, entries);
    return entries;
  };

  const standings = (stage: GroupsStage, group: Group): Standings => {
    const memo = standingsMemo.get(group);
    if (memo) return memo;
    const competition = competitionOf.get(stage)!;
    const members = group.entries.map((source) => resolve(competition, source));
    const played = stage.matches
      .filter((m) => m.location.kind === 'group' && m.location.group === group.id)
      .map((m) => ({ match: m, entries: matchEntries(m.id), winner: winnerOf(m) }));
    const result = groupStandings(members, played, group.tieResolutions);
    standingsMemo.set(group, result);
    return result;
  };

  function resolve(competition: Competition, source: SlotSource): Entry | null {
    switch (source.kind) {
      case 'entry':
        return competition.entries.find((e) => e.id === source.entry) ?? null;
      case 'bye':
        return null;
      case 'matchResult': {
        const feeder = located.get(source.match);
        const winner = feeder ? winnerOf(feeder.match) : null;
        if (winner === null) return null;
        return matchEntries(source.match)[source.take === 'winner' ? winner : 1 - winner];
      }
      case 'groupPlace': {
        const stage = competition.stages.find((s) => s.id === source.stage);
        const group = stage?.type === 'groups' ? stage.groups.find((g) => g.id === source.group) : undefined;
        if (!stage || stage.type !== 'groups' || !group) return null;
        const table = standings(stage, group);
        if (!table.complete) return null;
        const row = table.rows.find((r) => r.place === source.place && !r.tied);
        return row?.entry ?? null;
      }
    }
  }

  // Players currently on a table, anywhere in the tournament (one player can be in several competitions).
  const playing = new Map<PlayerId, MatchId>();
  for (const { match } of located.values()) {
    if (match.table === null || match.result) continue;
    for (const entry of matchEntries(match.id)) for (const player of entry?.players ?? []) playing.set(player, match.id);
  }

  const matches: DerivedMatch[] = [...located.values()].map(({ match, competition, stage, stageIndex }) => {
    const entries = matchEntries(match.id);
    return { match, competition, stage, stageIndex, entries, winner: winnerOf(match), status: statusOf(match, stage, entries, playing) };
  });
  const byId = new Map(matches.map((m) => [m.match.id, m]));

  return { matches, match: (id) => byId.get(id), standings, resolve };
}

function statusOf(
  match: Match,
  stage: Stage,
  entries: [Entry | null, Entry | null],
  playing: Map<PlayerId, MatchId>,
): MatchStatus {
  if (match.result) return 'finished';
  if (match.table !== null) return 'in_progress';
  if (stage.drawState !== 'confirmed') return 'pending';
  const [a, b] = entries;
  if (!a || !b) return 'pending';
  const elsewhere = [...a.players, ...b.players].some((p) => playing.has(p) && playing.get(p) !== match.id);
  return elsewhere ? 'busy' : 'ready';
}
