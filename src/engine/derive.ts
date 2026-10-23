import { groupStandings, type Standings } from './stages/groups';
import type { Competition, Entry, Group, GroupsStage, Match, MatchId, PlayerId, SlotSource, Stage, TournamentState } from './types';

/**
 * A match's derived status (from the spec). Never stored: worked out from the draw and the results.
 * - pending: a slot isn't resolved to an entry yet (or the stage isn't confirmed)
 * - ready: both entries known, neither player is playing elsewhere
 * - busy: both known, but a player is in an in-progress match elsewhere
 * - in_progress / overdue: called to a table (overdue: past its expected duration, #0005)
 * - finished / walkover: has a result (walkover: #0014), or was decided by a BYE
 * - disabled: a place play-off that isn't switched on (#0012)
 */
export type MatchStatus = 'pending' | 'ready' | 'busy' | 'in_progress' | 'overdue' | 'finished' | 'walkover' | 'disabled';

/** What a slot resolves to: an entry, a BYE (nobody, and never will be), or null while undecided. */
type Resolved = Entry | 'bye' | null;

export interface DerivedMatch {
  match: Match;
  competition: Competition;
  stage: Stage;
  stageIndex: number;
  /** The entries resolved from the slots' sources; null while a source isn't decided yet (or a BYE). */
  entries: [Entry | null, Entry | null];
  /** Which slots resolve to a BYE: a BYE position, or the winner/loser of a match that had nobody to give. */
  byes: [boolean, boolean];
  /** A BYE decides the match on its own: no result is entered and the other slot goes through. */
  decidedByBye: boolean;
  /** Slot index of the winner, once there is a result (or a BYE decided it). */
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

/** How a match turned out: from its recorded result, or from a BYE. */
interface Outcome {
  winner: 0 | 1 | null;
  decidedByBye: boolean;
  /** Both slots are BYEs: whoever takes its winner or loser gets a BYE too. */
  empty: boolean;
}

/** A BYE against an entry sends the entry through; a BYE against a BYE passes a BYE on. */
function outcomeOf(match: Match, slots: [Resolved, Resolved]): Outcome {
  const recorded = winnerOf(match);
  if (recorded !== null) return { winner: recorded, decidedByBye: false, empty: false };
  const [a, b] = slots;
  if (a === 'bye' && b === 'bye') return { winner: null, decidedByBye: true, empty: true };
  if (b === 'bye' && a !== null) return { winner: 0, decidedByBye: true, empty: false };
  if (a === 'bye' && b !== null) return { winner: 1, decidedByBye: true, empty: false };
  return { winner: null, decidedByBye: false, empty: false };
}

const asEntry = (resolved: Resolved): Entry | null => (resolved === 'bye' ? null : resolved);

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

  const slotsMemo = new Map<MatchId, [Resolved, Resolved]>();
  const outcomeMemo = new Map<MatchId, Outcome>();
  const standingsMemo = new Map<Group, Standings>();

  const matchSlots = (id: MatchId): [Resolved, Resolved] => {
    const memo = slotsMemo.get(id);
    if (memo) return memo;
    const { match, competition } = located.get(id)!;
    const slots: [Resolved, Resolved] = [resolveSlot(competition, match.slots[0]), resolveSlot(competition, match.slots[1])];
    slotsMemo.set(id, slots);
    return slots;
  };
  const matchEntries = (id: MatchId): [Entry | null, Entry | null] => {
    const [a, b] = matchSlots(id);
    return [asEntry(a), asEntry(b)];
  };
  const outcome = (id: MatchId): Outcome => {
    const memo = outcomeMemo.get(id);
    if (memo) return memo;
    const result = outcomeOf(located.get(id)!.match, matchSlots(id));
    outcomeMemo.set(id, result);
    return result;
  };

  const standings = (stage: GroupsStage, group: Group): Standings => {
    const memo = standingsMemo.get(group);
    if (memo) return memo;
    const competition = competitionOf.get(stage)!;
    const members = group.entries.map((source) => asEntry(resolveSlot(competition, source)));
    const played = stage.matches
      .filter((m) => m.location.kind === 'group' && m.location.group === group.id)
      .map((m) => ({ match: m, entries: matchEntries(m.id), winner: winnerOf(m) }));
    const result = groupStandings(members, played);
    standingsMemo.set(group, result);
    return result;
  };

  function resolveSlot(competition: Competition, source: SlotSource): Resolved {
    switch (source.kind) {
      case 'entry':
        return competition.entries.find((e) => e.id === source.entry) ?? null;
      case 'bye':
        return 'bye';
      case 'matchResult': {
        if (!located.has(source.match)) return null;
        const { winner, empty } = outcome(source.match);
        if (empty) return 'bye';
        if (winner === null) return null;
        return matchSlots(source.match)[source.take === 'winner' ? winner : 1 - winner];
      }
      case 'groupPlace': {
        const stage = competition.stages.find((s) => s.id === source.stage);
        const group = stage?.type === 'groups' ? stage.groups.find((g) => g.id === source.group) : undefined;
        if (!stage || stage.type !== 'groups' || !group) return null;
        const table = standings(stage, group);
        if (!table.complete) return null;
        const row = table.rows.find((r) => r.place === source.place);
        return row?.entry ?? null;
      }
    }
  }

  const resolve = (competition: Competition, source: SlotSource) => asEntry(resolveSlot(competition, source));

  // Players currently on a table, anywhere in the tournament (one player can be in several competitions).
  const playing = new Map<PlayerId, MatchId>();
  for (const { match } of located.values()) {
    if (match.table === null || match.result) continue;
    for (const entry of matchEntries(match.id)) for (const player of entry?.players ?? []) playing.set(player, match.id);
  }

  const matches: DerivedMatch[] = [...located.values()].map(({ match, competition, stage, stageIndex }) => {
    const slots = matchSlots(match.id);
    const entries = matchEntries(match.id);
    const { winner, decidedByBye } = outcome(match.id);
    return {
      match,
      competition,
      stage,
      stageIndex,
      entries,
      byes: [slots[0] === 'bye', slots[1] === 'bye'],
      decidedByBye,
      winner,
      status: statusOf(match, stage, entries, decidedByBye, playing),
    };
  });
  const byId = new Map(matches.map((m) => [m.match.id, m]));

  return { matches, match: (id) => byId.get(id), standings, resolve };
}

function statusOf(
  match: Match,
  stage: Stage,
  entries: [Entry | null, Entry | null],
  decidedByBye: boolean,
  playing: Map<PlayerId, MatchId>,
): MatchStatus {
  if (match.result) return 'finished';
  if (match.table !== null) return 'in_progress';
  if (stage.drawState !== 'confirmed') return 'pending';
  if (decidedByBye) return 'finished';
  const [a, b] = entries;
  if (!a || !b) return 'pending';
  const elsewhere = [...a.players, ...b.players].some((p) => playing.has(p) && playing.get(p) !== match.id);
  return elsewhere ? 'busy' : 'ready';
}
