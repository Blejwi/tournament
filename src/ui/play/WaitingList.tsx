import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsLeft, ChevronsRight, Pause } from 'lucide-react';
import { getCompetitions, getFreeTables, getWaitingList, type CompetitionId, type MatchId, type MatchView } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { entryName } from '@/ui/format';
import { matchTitle } from '@/ui/matchLabels';
import { busyLines } from './busy';

/** Which matches the waiting list shows: all competitions merged, or the competition on the canvas. */
export type WaitingListScope = 'all' | 'competition';

/** The matches that can be called now, in priority order: ready first, busy last. */
export function WaitingList(props: {
  now: number;
  /** The competition on the canvas. */
  competition: CompetitionId;
  scope: WaitingListScope;
  onScopeChange: (scope: WaitingListScope) => void;
  onSelect: (match: MatchView) => void;
  selectedMatch: MatchId | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const filter = props.scope === 'competition' ? props.competition : undefined;
  const list = useQuery((s) => getWaitingList(s, props.now, { competition: filter }), [props.now, filter]) ?? [];
  const freeTables = useQuery(getFreeTables) ?? [];
  const competitions = useQuery(getCompetitions) ?? [];
  const dispatch = useApp((s) => s.dispatch);
  const ready = list.filter((m) => m.status === 'ready');
  const busy = list.filter((m) => m.status === 'busy');
  const multiple = competitions.length > 1;
  const current = competitions.find((c) => c.id === props.competition);
  const competitionName = (id: string) => (multiple && props.scope === 'all' ? competitions.find((c) => c.id === id)?.name : null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('play.expand')}
        aria-label={t('play.expand')}
        className="flex w-11 shrink-0 flex-col items-center gap-3 border-l bg-white py-2 text-slate-600"
      >
        <ChevronsLeft className="size-4" />
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{ready.length}</span>
      </button>
    );
  }

  const item = (m: MatchView, index: number | null) => {
    const waited = m.readySince !== null ? Math.max(0, Math.round((props.now - m.readySince) / 60_000)) : null;
    return (
      <li key={m.id}>
        <div
          className={cn(
            'flex gap-2 border-b border-slate-100 px-2 py-1.5 hover:bg-slate-50',
            m.status === 'busy' && 'opacity-70',
            props.selectedMatch === m.id && 'bg-slate-100',
          )}
        >
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => props.onSelect(m)}>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              {index !== null && <span className="w-4 text-slate-400">{index + 1}.</span>}
              {competitionName(m.competition) && <b className="text-slate-700">{competitionName(m.competition)}</b>}
              <span className="truncate">{matchTitle(t, m)}</span>
              {waited !== null && (
                <span
                  title={t('play.waitingSince', { minutes: waited })}
                  className={cn('ml-auto shrink-0 tabular-nums', waited > 10 && 'font-semibold text-amber-600')}
                >
                  {t('play.waitingMinutes', { minutes: waited })}
                </span>
              )}
            </span>
            <span className="block truncate text-sm font-medium">
              {entryName(m.slots[0].entry)} <span className="font-normal text-slate-400">–</span> {entryName(m.slots[1].entry)}
            </span>
            {m.status === 'busy' &&
              busyLines(t, m, competitions).map((line) => (
                <span key={line} className="flex items-center gap-1 text-xs text-amber-700">
                  <Pause className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{line}</span>
                </span>
              ))}
          </button>
          {m.status === 'ready' && freeTables[0] && (
            <button
              type="button"
              title={t('play.callTo', { number: freeTables[0].number })}
              onClick={() => dispatch({ type: 'assignMatch', match: m.id, table: freeTables[0].id, at: Date.now() })}
              className="shrink-0 self-center rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white opacity-80 hover:opacity-100"
            >
              → {freeTables[0].number}
            </button>
          )}
        </div>
      </li>
    );
  };

  const segment = (scope: WaitingListScope, label: string) => (
    <button
      type="button"
      aria-pressed={props.scope === scope}
      onClick={() => props.onScopeChange(scope)}
      className={cn(
        'max-w-24 truncate rounded px-2 py-0.5 text-xs font-semibold',
        props.scope === scope ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800',
      )}
    >
      {label}
    </button>
  );

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-white" aria-label={t('play.waitingList')}>
      <div className="flex h-10 items-center gap-2 border-b px-3">
        <span className="font-semibold">{t('play.waitingList')}</span>
        <span className="text-xs text-slate-500">{t('play.readyCount', { count: ready.length })}</span>
        {multiple && current && (
          <div role="group" aria-label={t('play.scope')} className="ml-auto flex rounded bg-slate-100 p-0.5">
            {segment('all', t('play.scopeAll'))}
            {segment('competition', current.name)}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          title={t('play.collapse')}
          aria-label={t('play.collapse')}
          className={cn('rounded p-1 text-slate-600 hover:bg-slate-100', !(multiple && current) && 'ml-auto')}
        >
          <ChevronsRight className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {ready.length ? (
          <ul>{ready.map((m, i) => item(m, i))}</ul>
        ) : (
          <p className="p-4 text-xs text-slate-400">
            {props.scope === 'competition' && multiple && current ? t('play.noReadyIn', { name: current.name }) : t('play.noReady')}
          </p>
        )}
        {busy.length > 0 && (
          <>
            <p className="border-b px-3 pt-3 pb-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">{t('play.busyHeading')}</p>
            <ul>{busy.map((m) => item(m, null))}</ul>
          </>
        )}
      </div>
    </aside>
  );
}
