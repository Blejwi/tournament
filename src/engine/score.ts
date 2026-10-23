import { fail, ok, type Result } from './result';
import type { GameScore, GamesToWin, MatchResult } from './types';

const GAME_POINTS = 11;
const MIN_LEAD = 2;

/** A game goes to 11 with a 2-point lead; past 10–10 it continues until someone leads by exactly 2. */
function isValidGame([a, b]: GameScore): boolean {
  if (![a, b].every((p) => Number.isInteger(p) && p >= 0)) return false;
  const [high, low] = a > b ? [a, b] : [b, a];
  if (high < GAME_POINTS || high - low < MIN_LEAD) return false;
  return high === GAME_POINTS || high - low === MIN_LEAD;
}

/** Checks a result against the table tennis scoring rules for `gamesToWin`. */
export function validateScore(result: MatchResult, gamesToWin: GamesToWin): Result<void> {
  if (result.kind === 'gamesOnly') {
    const [a, b] = result.games;
    const valid = [a, b].every((g) => Number.isInteger(g) && g >= 0) && Math.max(a, b) === gamesToWin && Math.min(a, b) < gamesToWin;
    return valid ? ok(undefined) : fail({ code: 'matchNotDecided', gamesToWin });
  }
  const won = [0, 0];
  for (const [i, game] of result.games.entries()) {
    if (!isValidGame(game)) return fail({ code: 'invalidGame', game: i + 1, a: game[0], b: game[1] });
    if (won[0] === gamesToWin || won[1] === gamesToWin) return fail({ code: 'gamesAfterDecided', game: i + 1 });
    won[game[0] > game[1] ? 0 : 1]++;
  }
  if (won[0] !== gamesToWin && won[1] !== gamesToWin) return fail({ code: 'matchNotDecided', gamesToWin });
  return ok(undefined);
}

/**
 * Parses a typed result: one pair below 11 points ("3:1", "3-1") is games only; anything else is
 * game scores (see parseGames). Only checks the format; whether games only is allowed (brackets,
 * not groups) and the scoring rules are checked when the result is recorded.
 */
export function parseResult(text: string): Result<MatchResult> {
  const games = parseGames(text);
  if (!games.ok) return games;
  if (games.value.length === 1) {
    const [a, b] = games.value[0];
    if (Math.max(a, b) < GAME_POINTS) return ok({ kind: 'gamesOnly', games: [a, b] });
  }
  return ok({ kind: 'games', games: games.value });
}

/**
 * Parses typed game scores, slot A's points first: "11-7 9-11 11-5" (also "11:7, 9:11").
 * Only checks the format; the scoring rules are checked when the result is recorded.
 */
export function parseGames(text: string): Result<GameScore[]> {
  const games: GameScore[] = [];
  for (const token of text.trim().split(/[\s,;]+/).filter(Boolean)) {
    const match = /^(\d{1,2})[-:](\d{1,2})$/.exec(token);
    if (!match) return fail({ code: 'invalidScoreFormat', text: token });
    games.push([Number(match[1]), Number(match[2])]);
  }
  return ok(games);
}
