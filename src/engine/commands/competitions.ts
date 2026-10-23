import { allocateId } from '../ids';
import { replaceCompetition } from '../locate';
import { appendLog } from '../log';
import { fail, ok, type Result } from '../result';
import { handlerFor } from '../stages';
import { derive } from '../derive';
import { addPlayer, type PlayerFields } from './players';
import type { Competition, CompetitionId, EntryId, GamesToWin, PlayerId, Timestamp, TournamentState } from '../types';

export type CompetitionCommand =
  | { type: 'addCompetition'; name: string; gamesToWin?: GamesToWin }
  /** Registers a new player and enters them into the competition in one step. */
  | ({ type: 'registerPlayer'; competition: CompetitionId } & PlayerFields)
  | { type: 'enterPlayer'; competition: CompetitionId; player: PlayerId }
  | { type: 'removeEntry'; competition: CompetitionId; entry: EntryId }
  /** `seed: null` clears the seed. */
  | { type: 'setSeed'; competition: CompetitionId; entry: EntryId; seed: number | null }
  /** The player leaves the competition at `at`: their remaining matches become walkovers. */
  | { type: 'withdrawPlayer'; competition: CompetitionId; entry: EntryId; at: Timestamp };

type Cmd<T extends CompetitionCommand['type']> = Extract<CompetitionCommand, { type: T }>;

const GAMES_TO_WIN: readonly number[] = [2, 3, 4];

export function addCompetition(state: TournamentState, cmd: Cmd<'addCompetition'>): Result<TournamentState> {
  const name = cmd.name.trim();
  const gamesToWin = cmd.gamesToWin ?? 3;
  if (!name) return fail({ code: 'required', field: 'name' });
  if (!GAMES_TO_WIN.includes(gamesToWin)) return fail({ code: 'invalidGamesToWin' });
  const [id, next] = allocateId(state, 'competition');
  const competition: Competition = { id, name, gamesToWin, entries: [], stages: [] };
  return ok({ ...next, competitions: [...next.competitions, competition] });
}

export function registerPlayer(state: TournamentState, cmd: Cmd<'registerPlayer'>): Result<TournamentState> {
  const competition = findCompetition(state, cmd.competition);
  if (!competition.ok) return competition;
  const registered = addPlayer(state, {
    type: 'addPlayer',
    firstName: cmd.firstName,
    lastName: cmd.lastName,
    club: cmd.club,
    rating: cmd.rating,
    birthYear: cmd.birthYear,
  });
  if (!registered.ok) return registered;
  const player = registered.value.players[registered.value.players.length - 1].id;
  return enterPlayer(registered.value, { type: 'enterPlayer', competition: cmd.competition, player });
}

export function enterPlayer(state: TournamentState, cmd: Cmd<'enterPlayer'>): Result<TournamentState> {
  const competition = findCompetition(state, cmd.competition);
  if (!competition.ok) return competition;
  if (!state.players.some((p) => p.id === cmd.player)) return fail({ code: 'playerNotFound', player: cmd.player });
  if (competition.value.entries.some((e) => e.players.includes(cmd.player))) {
    return fail({ code: 'alreadyEntered', player: cmd.player });
  }
  const [id, next] = allocateId(state, 'entry');
  return changeEntries(next, competition.value, (entries) => ok([...entries, { id, players: [cmd.player], seed: null, withdrawnAt: null }]));
}

export function removeEntry(state: TournamentState, cmd: Cmd<'removeEntry'>): Result<TournamentState> {
  const competition = findCompetition(state, cmd.competition);
  if (!competition.ok) return competition;
  const removed = competition.value.entries.find((e) => e.id === cmd.entry);
  const result = changeEntries(state, competition.value, (entries) => {
    if (!removed) return fail({ code: 'entryNotFound', entry: cmd.entry });
    return ok(entries.filter((e) => e.id !== cmd.entry));
  });
  if (!result.ok || !removed) return result;
  // A player exists through their entries: the last entry removed takes the player record with it.
  const orphans = removed.players.filter((id) => !result.value.competitions.some((c) => c.entries.some((e) => e.players.includes(id))));
  if (orphans.length === 0) return result;
  return ok({ ...result.value, players: result.value.players.filter((p) => !orphans.includes(p.id)) });
}

export function setSeed(state: TournamentState, cmd: Cmd<'setSeed'>): Result<TournamentState> {
  const competition = findCompetition(state, cmd.competition);
  if (!competition.ok) return competition;
  const { seed } = cmd;
  return changeEntries(state, competition.value, (entries) => {
    if (!entries.some((e) => e.id === cmd.entry)) return fail({ code: 'entryNotFound', entry: cmd.entry });
    if (seed !== null) {
      if (!Number.isInteger(seed) || seed < 1) return fail({ code: 'invalidSeed' });
      if (entries.some((e) => e.seed === seed && e.id !== cmd.entry)) return fail({ code: 'seedTaken', seed });
    }
    return ok(entries.map((e) => (e.id === cmd.entry ? { ...e, seed } : e)));
  });
}

/**
 * A player leaves the competition part-way through. Their results so far are kept; every match of
 * theirs without a result, now or once its players are known, is a walkover for the opponent
 * (derived from `withdrawnAt`, see `derive`). A match they are playing on a table needs its result first.
 */
export function withdrawPlayer(state: TournamentState, cmd: Cmd<'withdrawPlayer'>): Result<TournamentState> {
  const found = findCompetition(state, cmd.competition);
  if (!found.ok) return found;
  const competition = found.value;
  const entry = competition.entries.find((e) => e.id === cmd.entry);
  if (!entry) return fail({ code: 'entryNotFound', entry: cmd.entry });
  if (competition.stages[0]?.drawState !== 'confirmed') return fail({ code: 'competitionNotStarted' });
  if (entry.withdrawnAt !== null) return fail({ code: 'alreadyWithdrawn' });
  const onTable = derive(state).matches.find(
    (m) => m.competition.id === competition.id && m.match.table !== null && !m.match.result && m.entries.some((e) => e?.id === entry.id),
  );
  if (onTable) {
    const number = state.tables.find((t) => t.id === onTable.match.table)?.number ?? 0;
    return fail({ code: 'withdrawalWhilePlaying', number });
  }
  const entries = competition.entries.map((e) => (e.id === entry.id ? { ...e, withdrawnAt: cmd.at } : e));
  const next = replaceCompetition(state, { ...competition, entries });
  return ok(appendLog(next, { type: 'playerWithdrew', at: cmd.at, competition: competition.id, players: [...entry.players] }));
}

export function findCompetition(state: TournamentState, id: CompetitionId): Result<Competition> {
  const competition = state.competitions.find((c) => c.id === id);
  return competition ? ok(competition) : fail({ code: 'competitionNotFound', competition: id });
}

/**
 * Changes a competition's entries. Entries are locked once the first stage is confirmed;
 * before that, a change discards the first stage's draw, which no longer matches the entries.
 */
function changeEntries(
  state: TournamentState,
  competition: Competition,
  change: (entries: Competition['entries']) => Result<Competition['entries']>,
): Result<TournamentState> {
  const [first] = competition.stages;
  if (first?.drawState === 'confirmed') return fail({ code: 'stageConfirmed' });
  const entries = change(competition.entries);
  if (!entries.ok) return entries;
  const stages = competition.stages.map((s) => handlerFor(s).clearDraw(s));
  return ok(replaceCompetition(state, { ...competition, entries: entries.value, stages }));
}
