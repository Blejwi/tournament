import type { MatchView } from '@/engine';

/** Whether the result has games to show: a played result or a retirement (a walkover or disqualification has none). */
export function hasGames(match: MatchView): boolean {
  const kind = match.result?.kind;
  return kind === 'games' || kind === 'gamesOnly' || kind === 'retirement';
}
