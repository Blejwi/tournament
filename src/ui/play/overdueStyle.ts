import type { MatchView } from '@/engine';

/** Timer colour of a match on its table: sky while in time, amber past 100%, red past 150%. */
export function overdueText(match: Pick<MatchView, 'overdue'>): string {
  return match.overdue === 'red' ? 'text-red-600' : match.overdue === 'amber' ? 'text-amber-600' : 'text-sky-700';
}
