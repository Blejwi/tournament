import { useTranslation } from 'react-i18next';
import { Pause } from 'lucide-react';
import { getCompetitions, type MatchStatus, type MatchView } from '@/engine';
import { useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { entryName, formatClock } from '@/ui/format';
import { busyLines } from './busy';
import { overdueText } from './overdueStyle';

/** Card frame by derived match status (spec user story 86). */
const STATUS_STYLE: Record<MatchStatus, string> = {
  pending: 'border border-dashed border-slate-300 bg-slate-50 text-slate-400',
  ready: 'border-2 border-indigo-500 bg-indigo-50 shadow-sm',
  busy: 'border-2 border-dashed border-indigo-300 bg-indigo-50/30 opacity-75',
  in_progress: 'border border-sky-400 bg-sky-50',
  overdue: 'border-2 border-amber-500 bg-amber-50',
  finished: 'border border-slate-200 bg-slate-100 text-slate-500',
  walkover: 'border border-slate-200 bg-slate-100 text-slate-500',
  disabled: 'border border-dashed border-slate-300 bg-white opacity-30',
};
/** Past 150% of the expected duration: visually stronger than amber overdue. */
const RED_OVERDUE_STYLE = 'border-2 border-red-500 bg-red-50 overdue-alarm';

export function MatchCard(props: { match: MatchView; selected: boolean; onSelect: (el: HTMLElement) => void }) {
  const { t } = useTranslation();
  const { match } = props;
  const competitions = useQuery(getCompetitions) ?? [];
  const busy = match.status === 'busy' ? busyLines(t, match, competitions).join(' ') : undefined;
  return (
    <button
      type="button"
      data-match-id={match.id}
      title={busy}
      onClick={(e) => props.onSelect(e.currentTarget)}
      className={cn(
        'relative block h-16 w-[212px] overflow-hidden rounded-md text-left text-slate-900 select-none hover:shadow-md',
        match.overdue === 'red' ? RED_OVERDUE_STYLE : STATUS_STYLE[match.status],
        props.selected && 'outline-2 outline-offset-2 outline-slate-900',
      )}
    >
      <span className="flex h-[18px] items-center gap-1 px-1.5 text-[10px] leading-none">
        <b className="text-slate-700">R{match.round}</b>
        <span className="ml-auto shrink-0">
          <StatusChip match={match} />
        </span>
      </span>
      {([0, 1] as const).map((side) => {
        const won = match.result?.winner === side;
        return (
          <span
            key={side}
            className={cn(
              'flex h-[21px] items-center gap-1 border-t border-black/5 px-1.5 text-xs leading-none',
              won && 'font-semibold text-slate-800',
              match.result && !won && 'text-slate-400',
            )}
          >
            <span className={cn('truncate', !match.slots[side].entry && 'italic')}>
              {entryName(match.slots[side].entry) ?? t('match.unknown')}
            </span>
            <span className="ml-auto font-bold tabular-nums">{match.result?.gamesWon[side] ?? ''}</span>
          </span>
        );
      })}
      {match.elapsedMs !== null && (
        <span className="absolute bottom-0 left-0 h-[3px] w-full bg-black/5">
          <span
            className={cn('block h-full', match.overdue === 'red' ? 'bg-red-500' : match.overdue ? 'bg-amber-500' : 'bg-sky-500')}
            style={{ width: `${Math.min(100, (match.elapsedMs / match.expectedMs) * 100)}%` }}
          />
        </span>
      )}
      <span className="sr-only">
        {t(`match.status.${match.status}`)}
        {busy && ` ${busy}`}
      </span>
    </button>
  );
}

function StatusChip({ match }: { match: MatchView }) {
  const { t } = useTranslation();
  switch (match.status) {
    case 'ready':
      return <span className="rounded bg-indigo-500 px-1 font-bold text-white uppercase">{t('match.status.ready')}</span>;
    case 'busy':
      return (
        <span className="flex items-center gap-0.5 font-semibold text-amber-700">
          <Pause className="size-3" aria-hidden />
          {match.busyWith[0]?.table != null ? t('match.busyChip', { number: match.busyWith[0].table }) : t('match.status.busy')}
        </span>
      );
    case 'in_progress':
    case 'overdue':
      return (
        <span className="flex items-center gap-1">
          <span
            className={cn(
              'rounded px-1 font-bold text-white',
              match.overdue === 'red' ? 'bg-red-600' : match.overdue === 'amber' ? 'bg-amber-500' : 'bg-sky-600',
            )}
          >
            {t('match.table', { number: match.table?.number })}
          </span>
          <span className={cn('font-bold tabular-nums', overdueText(match))}>{formatClock(match.elapsedMs ?? 0)}</span>
        </span>
      );
    case 'finished':
    case 'walkover':
      return <span className="text-slate-400">✓</span>;
    default:
      return null;
  }
}
