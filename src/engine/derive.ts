import { groupStandings, type PlayedMatch, type Standings } from './stages/groups';
import type {
  Competition,
  Entry,
  Group,
  GroupsStage,
  Match,
  MatchId,
  MatchResult,
  PlayerId,
  SlotSource,
  Stage,
  Timestamp,
  TournamentState,
} from './types';

/**
 * A match's derived status (from the spec). Never stored: worked out from the draw and the results.
 * - pending: a slot isn't resolved to an entry yet (or the stage isn't confirmed)
 * - ready: both entries known, neither player is playing elsewhere
 * - busy: both known, but a player is in an in-progress match elsewhere
 * - in_progress / overdue: called to a table. `derive` has no clock, so it only says in_progress;
 *   match views (which take `now`) turn it into overdue past the expected duration.
 * - finished: has a result (also a retirement or disqualification), or was decided by a BYE
 * - walkover: a walkover was recorded, or a player of the match withdrew (`withdrawPlayer`)
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
  /** The recorded result, or the walkover a withdrawal gives (see `withdrawal`); null otherwise. */
  result: MatchResult | null;
  /**
   * When it finished: the recorded time, or for a withdrawal walkover the time both the withdrawal
   * and the players were known.
   */
  finishedAt: Timestamp | null;
  /** A player withdrew and no result was recorded: a walkover, or nobody plays it if both withdrew. */
  withdrawal: boolean;
  /** Slot index of the winner, once there is a result (or a BYE or withdrawal decided it). */
  winner: 0 | 1 | null;
  status: MatchStatus;
  /**
   * Since when both players have been known and free: the latest of the results that decided the
   * slots and the players' last finished matches (anywhere in the tournament). null when nothing
   * like that happened yet (e.g. a first-round match). Set for ready and busy matches only.
   */
  waitingSince: Timestamp | null;
  /** For a busy match: each of its players who is on a table elsewhere, with that match. */
  busyWith: { player: PlayerId; match: Match; competition: Competition }[];
}

export interface Derived {
  /** Every match of the tournament: competition order, then stage order, then the stage's own order. */
  matches: DerivedMatch[];
  match(id: MatchId): DerivedMatch | undefined;
  standings(stage: GroupsStage, group: Group): Standings;
  resolve(competition: Competition, source: SlotSource): Entry | null;
}

/** Slot index of the winner of a result. */
export function winnerOf(result: MatchResult | null): 0 | 1 | null {
  if (!result) return null;
  if (result.kind !== 'games' && result.kind !== 'gamesOnly') return result.winner;
  const [a, b] = result.kind === 'games' ? gamesWon(result.games) : result.games;
  return a > b ? 0 : 1;
}

/** Games won by slot A and slot B: none for a walkover or disqualification, the games completed for a retirement. */
export function resultGamesWon(result: MatchResult): [number, number] {
  switch (result.kind) {
    case 'gamesOnly':
      return [...result.games];
    case 'games':
    case 'retirement':
      return gamesWon(result.games);
    default:
      return [0, 0];
  }
}

export function gamesWon(games: [number, number][]): [number, number] {
  return games.reduce<[number, number]>(([a, b], [x, y]) => (x > y ? [a + 1, b] : [a, b + 1]), [0, 0]);
}

/** How a match turned out: from its recorded result, a BYE, or a withdrawal. */
interface Outcome {
  winner: 0 | 1 | null;
  decidedByBye: boolean;
  /** Both slots are BYEs (or both players withdrew): whoever takes its winner or loser gets a BYE too. */
  empty: boolean;
  /** The recorded result, or the walkover a withdrawal gives; null otherwise. */
  result: MatchResult | null;
  /** No result was recorded: a player of the match withdrew, so it is a walkover (or nobody plays it). */
  withdrawal: boolean;
}

const undecided: Outcome = { winner: null, decidedByBye: false, empty: false, result: null, withdrawal: false };

/**
 * A BYE against an entry sends the entry through; a BYE against a BYE passes a BYE on. Once a
 * confirmed match's players are both known, a withdrawn player's match without a result is a
 * walkover for the opponent; if both withdrew, nobody goes through (like a BYE against a BYE).
 */
function outcomeOf(match: Match, stage: Stage, slots: [Resolved, Resolved]): Outcome {
  const recorded = winnerOf(match.result);
  if (recorded !== null) return { ...undecided, winner: recorded, result: match.result };
  const [a, b] = slots;
  if (a === 'bye' && b === 'bye') return { ...undecided, decidedByBye: true, empty: true };
  if (b === 'bye' && a !== null) return { ...undecided, winner: 0, decidedByBye: true };
  if (a === 'bye' && b !== null) return { ...undecided, winner: 1, decidedByBye: true };
  if (!a || !b || a === 'bye' || b === 'bye' || stage.drawState !== 'confirmed') return undecided;
  const withdrawn = [a.withdrawnAt !== null, b.withdrawnAt !== null];
  if (withdrawn[0] && withdrawn[1]) return { ...undecided, empty: true, withdrawal: true };
  if (withdrawn[0] || withdrawn[1]) {
    const winner = withdrawn[0] ? 1 : 0;
    return { ...undecided, winner, result: { kind: 'walkover', winner }, withdrawal: true };
  }
  return undecided;
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
    const { match, stage } = located.get(id)!;
    const result = outcomeOf(match, stage, matchSlots(id));
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
      .map((m) => {
        const { winner, result, withdrawal } = outcome(m.id);
        return { entries: matchEntries(m.id), winner, result, decided: result !== null || withdrawal };
      });
    const result = groupStandings(members, [...played, ...carriedOver(competition, stage, members)], group.tieResolutions);
    // A group with an undecided member (e.g. "1A" not known yet) isn't complete, even if all its pairs were carried over.
    const standings = { ...result, complete: result.complete && members.every((m) => m !== null) };
    standingsMemo.set(group, standings);
    return standings;
  };

  /**
   * Carry-over (groups → groups): the matches of the groups stage before that were played between
   * two members of this group. They count in its standings instead of being played again.
   */
  function carriedOver(competition: Competition, stage: GroupsStage, members: (Entry | null)[]): PlayedMatch[] {
    const previous = competition.stages[competition.stages.indexOf(stage) - 1];
    if (!stage.carryOver || previous?.type !== 'groups') return [];
    const ids = new Set(members.flatMap((m) => (m ? [m.id] : [])));
    return previous.matches.flatMap((m) => {
      const entries = matchEntries(m.id);
      if (!entries[0] || !entries[1] || !ids.has(entries[0].id) || !ids.has(entries[1].id)) return [];
      const { winner, result, withdrawal } = outcome(m.id);
      return [{ entries, winner, result, decided: result !== null || withdrawal }];
    });
  }

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
        const row = table.rows.find((r) => r.place === source.place && !r.tied);
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

  // When each player last finished a match: from then on they are free again.
  const lastFinished = new Map<PlayerId, Timestamp>();
  for (const { match } of located.values()) {
    if (!match.result || match.finishedAt === null) continue;
    for (const entry of matchEntries(match.id)) {
      for (const player of entry?.players ?? []) lastFinished.set(player, Math.max(lastFinished.get(player) ?? -Infinity, match.finishedAt));
    }
  }

  /** When a slot's source got decided: the feeding result, or the last result of the feeding group. */
  const decidedAt = (competition: Competition, source: SlotSource): Timestamp | null => {
    switch (source.kind) {
      case 'matchResult':
        return located.has(source.match) ? finishedAtOf(source.match) : null;
      case 'groupPlace': {
        const stage = competition.stages.find((s) => s.id === source.stage);
        const group = (stage?.matches ?? []).filter((m) => m.location.kind === 'group' && m.location.group === source.group);
        return latest(group.map((m) => finishedAtOf(m.id)));
      }
      default:
        return null;
    }
  };

  /** The recorded finish; a withdrawal walkover finishes once both the withdrawal and the players are known. */
  const finishedAtMemo = new Map<MatchId, Timestamp | null>();
  function finishedAtOf(id: MatchId): Timestamp | null {
    if (finishedAtMemo.has(id)) return finishedAtMemo.get(id)!;
    const { match, competition } = located.get(id)!;
    let finishedAt = match.finishedAt;
    if (outcome(id).withdrawal) {
      const withdrawals = matchEntries(id).map((e) => e?.withdrawnAt ?? null);
      finishedAt = latest([...withdrawals, ...match.slots.map((s) => decidedAt(competition, s))]);
    }
    finishedAtMemo.set(id, finishedAt);
    return finishedAt;
  }

  const matches: DerivedMatch[] = [...located.values()].map(({ match, competition, stage, stageIndex }) => {
    const slots = matchSlots(match.id);
    const entries = matchEntries(match.id);
    const { winner, decidedByBye, result, withdrawal } = outcome(match.id);
    const status = statusOf(match, stage, entries, decidedByBye, withdrawal, playing);
    const players = entries.flatMap((e) => e?.players ?? []);
    const waitingSince =
      status === 'ready' || status === 'busy'
        ? latest([...match.slots.map((s) => decidedAt(competition, s)), ...players.map((p) => lastFinished.get(p) ?? null)])
        : null;
    const busyWith =
      status === 'busy'
        ? players
            .filter((p) => playing.has(p) && playing.get(p) !== match.id)
            .map((player) => {
              const other = located.get(playing.get(player)!)!;
              return { player, match: other.match, competition: other.competition };
            })
        : [];
    return {
      match,
      competition,
      stage,
      stageIndex,
      entries,
      byes: [slots[0] === 'bye', slots[1] === 'bye'],
      decidedByBye,
      result,
      finishedAt: finishedAtOf(match.id),
      withdrawal,
      winner,
      status,
      waitingSince,
      busyWith,
    };
  });
  const byId = new Map(matches.map((m) => [m.match.id, m]));

  return { matches, match: (id) => byId.get(id), standings, resolve };
}

function latest(times: (Timestamp | null)[]): Timestamp | null {
  const known = times.filter((t) => t !== null);
  return known.length ? Math.max(...known) : null;
}

function statusOf(
  match: Match,
  stage: Stage,
  entries: [Entry | null, Entry | null],
  decidedByBye: boolean,
  withdrawal: boolean,
  playing: Map<PlayerId, MatchId>,
): MatchStatus {
  if (match.result) return match.result.kind === 'walkover' ? 'walkover' : 'finished';
  if (match.table !== null) return 'in_progress';
  if (stage.drawState !== 'confirmed') return 'pending';
  if (decidedByBye) return 'finished';
  if (withdrawal) return 'walkover';
  const [a, b] = entries;
  if (!a || !b) return 'pending';
  const elsewhere = [...a.players, ...b.players].some((p) => playing.has(p) && playing.get(p) !== match.id);
  return elsewhere ? 'busy' : 'ready';
}
