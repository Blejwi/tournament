import { allocateId } from '../ids';
import { fail, ok, type Result } from '../result';
import type { Competition, CompetitionId, EntryId, GamesToWin, PlayerId, TournamentState } from '../types';

export type CompetitionCommand =
  | { type: 'addCompetition'; name: string; gamesToWin?: GamesToWin }
  | { type: 'enterPlayer'; competition: CompetitionId; player: PlayerId }
  | { type: 'removeEntry'; competition: CompetitionId; entry: EntryId }
  /** `seed: null` clears the seed. */
  | { type: 'setSeed'; competition: CompetitionId; entry: EntryId; seed: number | null };

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

export function enterPlayer(state: TournamentState, cmd: Cmd<'enterPlayer'>): Result<TournamentState> {
  const competition = findCompetition(state, cmd.competition);
  if (!competition.ok) return competition;
  if (!state.players.some((p) => p.id === cmd.player)) return fail({ code: 'playerNotFound', player: cmd.player });
  if (competition.value.entries.some((e) => e.players.includes(cmd.player))) {
    return fail({ code: 'alreadyEntered', player: cmd.player });
  }
  const [id, next] = allocateId(state, 'entry');
  return changeEntries(next, competition.value, (entries) => ok([...entries, { id, players: [cmd.player], seed: null }]));
}

export function removeEntry(state: TournamentState, cmd: Cmd<'removeEntry'>): Result<TournamentState> {
  const competition = findCompetition(state, cmd.competition);
  if (!competition.ok) return competition;
  return changeEntries(state, competition.value, (entries) => {
    if (!entries.some((e) => e.id === cmd.entry)) return fail({ code: 'entryNotFound', entry: cmd.entry });
    return ok(entries.filter((e) => e.id !== cmd.entry));
  });
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

export function findCompetition(state: TournamentState, id: CompetitionId): Result<Competition> {
  const competition = state.competitions.find((c) => c.id === id);
  return competition ? ok(competition) : fail({ code: 'competitionNotFound', competition: id });
}

export function replaceCompetition(state: TournamentState, competition: Competition): TournamentState {
  return { ...state, competitions: state.competitions.map((c) => (c.id === competition.id ? competition : c)) };
}

/** Changes a competition's entries. */
function changeEntries(
  state: TournamentState,
  competition: Competition,
  change: (entries: Competition['entries']) => Result<Competition['entries']>,
): Result<TournamentState> {
  const entries = change(competition.entries);
  if (!entries.ok) return entries;
  return ok(replaceCompetition(state, { ...competition, entries: entries.value }));
}
