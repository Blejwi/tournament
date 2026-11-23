import { useTranslation } from 'react-i18next';
import { Pause } from 'lucide-react';
import { getCompetitions, type MatchStatus, type MatchView } from '@/engine';
import { useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { formatClock } from '@/ui/format';
import { matchCode, slotText } from '@/ui/matchLabels';
import { busyLines } from './busy';
import { overdueText } from './overdueStyle';
import { ResultBadge } from './ResultBadge';
import { useDisplayMode } from './displayMode';
import { hasGames } from './specialResults';

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

/** Card frame on paper: results only, no status colours. */
const PRINT_STYLE = 'border border-slate-400 bg-white';
const PRINT_PENDING_STYLE = 'border border-dashed border-slate-300 bg-white text-slate-400';

/**
 * A match on the canvas. Without `onSelect` it is a plain, non-interactive card (the display screen).
 * `print` draws it for paper (#0027): larger text, no status, timer or hover text, only the result.
 */
export function MatchCard(props: { match: MatchView; selected: boolean; onSelect?: (el: HTMLElement) => void; print?: boolean }) {
  const { t } = useTranslation();
  const { match } = props;
  const competitions = useQuery(getCompetitions) ?? [];
  const { print = false } = props;
  const display = useDisplayMode();
  const busy = !print && match.status === 'busy' ? busyLines(t, match, competitions).join(' ') : undefined;
  const Frame = props.onSelect ? 'button' : 'div';
  return (
    <Frame
      type={props.onSelect ? 'button' : undefined}
      data-match-id={match.id}
      title={busy}
      onClick={props.onSelect ? (e) => props.onSelect!(e.currentTarget) : undefined}
      className={cn(
        'relative block h-16 overflow-hidden rounded-md text-left text-slate-900 select-none',
        'w-full',
        props.onSelect && 'hover:shadow-md',
        print ? (match.result || match.decidedByBye ? PRINT_STYLE : PRINT_PENDING_STYLE) : match.overdue === 'red' ? RED_OVERDUE_STYLE : STATUS_STYLE[match.status],
        props.selected && 'outline-2 outline-offset-2 outline-slate-900',
      )}
    >
      <span className={cn('flex h-[18px] items-center gap-1 px-1.5 leading-none', print ? 'text-[12px]' : display ? 'text-[11px]' : 'text-[10px]')}>
        <b className="text-slate-700">{matchCode(t, match.location, match.round, match.order)}</b>
        <span className="ml-auto shrink-0">
          {print ? match.decidedByBye && <span className="text-slate-500">{t('bracket.bye')}</span> : <StatusChip match={match} />}
        </span>
      </span>
      {([0, 1] as const).map((side) => {
        const won = match.result?.winner === side;
        const slot = slotText(t, match.slots[side], display?.names);
        return (
          <span
            key={side}
            className={cn(
              'flex h-[21px] items-center gap-1 border-t border-black/5 px-1.5',
              print ? 'text-[14px] leading-[14px]' : display ? 'text-[13px] leading-[13px] font-medium' : 'text-[11px] leading-[10px]',
              won && 'font-semibold text-slate-800',
              match.result && !won && 'text-slate-400',
            )}
          >
            <span title={slot.text} className={cn('min-w-0 truncate', slot.placeholder && 'text-slate-400 italic')}>{slot.text}</span>
            <ResultBadge match={match} side={side} />
            <span className="ml-auto font-bold tabular-nums">{hasGames(match) ? match.result!.gamesWon[side] : ''}</span>
          </span>
        );
      })}
      {!print && match.elapsedMs !== null && (
        <span className="absolute bottom-0 left-0 h-[3px] w-full bg-black/5">
          <span
            className={cn('block h-full', match.overdue === 'red' ? 'bg-red-500' : match.overdue ? 'bg-amber-500' : 'bg-sky-500')}
            style={{ width: `${Math.min(100, (match.elapsedMs / match.expectedMs) * 100)}%` }}
          />
        </span>
      )}
      {!print && (
        <span className="sr-only">
          {t(`match.status.${match.status}`)}
          {busy && ` ${busy}`}
        </span>
      )}
    </Frame>
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
      return match.decidedByBye ? <span className="text-slate-400">{t('bracket.bye')}</span> : <span className="text-slate-400">✓</span>;
    default:
      return null;
  }
}
