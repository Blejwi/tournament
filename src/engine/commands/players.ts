import { allocateId } from '../ids';
import { fail, ok, type Result } from '../result';
import type { Player, PlayerId, TournamentState } from '../types';

interface PlayerFields {
  firstName: string;
  lastName: string;
  club: string;
  rating?: number | null;
  birthYear?: number | null;
}

export type PlayerCommand =
  | ({ type: 'addPlayer' } & PlayerFields)
  | ({ type: 'updatePlayer'; player: PlayerId } & PlayerFields);

type Cmd<T extends PlayerCommand['type']> = Extract<PlayerCommand, { type: T }>;

const MIN_BIRTH_YEAR = 1900;
const MAX_BIRTH_YEAR = 2100;

function toPlayer(id: PlayerId, fields: PlayerFields): Result<Player> {
  const firstName = fields.firstName.trim();
  const lastName = fields.lastName.trim();
  const rating = fields.rating ?? null;
  const birthYear = fields.birthYear ?? null;
  if (!firstName) return fail({ code: 'required', field: 'firstName' });
  if (!lastName) return fail({ code: 'required', field: 'lastName' });
  if (rating !== null && !(Number.isFinite(rating) && rating >= 0)) return fail({ code: 'invalidRating' });
  if (
    birthYear !== null &&
    !(Number.isInteger(birthYear) && birthYear >= MIN_BIRTH_YEAR && birthYear <= MAX_BIRTH_YEAR)
  ) {
    return fail({ code: 'invalidBirthYear' });
  }
  return ok({ id, firstName, lastName, club: fields.club.trim(), rating, birthYear });
}

export function addPlayer(state: TournamentState, cmd: Cmd<'addPlayer'>): Result<TournamentState> {
  const [id, next] = allocateId(state, 'player');
  const player = toPlayer(id, cmd);
  if (!player.ok) return player;
  return ok({ ...next, players: [...next.players, player.value] });
}

export function updatePlayer(state: TournamentState, cmd: Cmd<'updatePlayer'>): Result<TournamentState> {
  if (!state.players.some((p) => p.id === cmd.player)) return fail({ code: 'playerNotFound', player: cmd.player });
  const player = toPlayer(cmd.player, cmd);
  if (!player.ok) return player;
  return ok({ ...state, players: state.players.map((p) => (p.id === cmd.player ? player.value : p)) });
}
