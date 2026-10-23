import type { MatchView, SpecialResultKind } from '@/engine';

/** The kind of a special result, or null for a played one. */
export function specialKind(result: { kind: string } | null): SpecialResultKind | null {
  return result?.kind === 'walkover' || result?.kind === 'retirement' || result?.kind === 'disqualification' ? result.kind : null;
}

/** Whether the result has games to show: a played result or a retirement (a walkover or disqualification has none). */
export function hasGames(match: Pick<MatchView, 'result'>): boolean {
  const kind = match.result?.kind;
  return kind === 'games' || kind === 'gamesOnly' || kind === 'retirement';
}
