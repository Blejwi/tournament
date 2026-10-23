import type { TFunction } from 'i18next';
import type { CompetitionSummaryView, MatchView } from '@/engine';
import { playerName } from '@/ui/format';

/** One line per player of a busy match who is on a table elsewhere: "J. Kowalski is playing on table 3 in U15." */
export function busyLines(t: TFunction, match: MatchView, competitions: CompetitionSummaryView[]): string[] {
  return match.busyWith.map((busy) => {
    const player = match.slots.flatMap((s) => s.entry?.players ?? []).find((p) => p.id === busy.player);
    const name = player ? playerName(player) : '';
    const number = busy.table ?? '?';
    if (busy.competition === match.competition) return t('match.busyOn', { name, number });
    const competition = competitions.find((c) => c.id === busy.competition)?.name ?? '';
    return t('match.busyOnIn', { name, number, competition });
  });
}
