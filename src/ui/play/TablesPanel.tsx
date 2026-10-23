import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsLeft, ChevronsRight, Maximize2, X } from 'lucide-react';
import { getWaitingList, type MatchView, type TableOverview, type TableOverviewRow, type TableStatus } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/ui/button';
import { entryName, formatClock } from '@/ui/format';
import { overdueText } from './overdueStyle';

/** How many ready matches a free table offers to call. */
const CALL_CHOICES = 5;

/** The table number tile, coloured by status (red overdue pulses; an idle table while matches wait glows amber). */
function tableTone(row: TableOverviewRow): string {
  const tones: Record<TableStatus, string> = {
    playing: 'bg-sky-600 text-white',
    overdue: row.match?.overdue === 'red' ? 'bg-red-600 text-white overdue-alarm' : 'bg-amber-500 text-white',
    free: row.idleAlert ? 'bg-amber-400 text-white idle-alarm' : 'bg-emerald-500 text-white',
    inactive: 'bg-slate-200 text-slate-400',
  };
  return tones[row.status];
}

function useIdleText() {
  const { t } = useTranslation();
  return (row: TableOverviewRow) =>
    row.idleMs === null ? t('tablesPanel.notUsedYet') : t('tablesPanel.idle', { minutes: Math.floor(row.idleMs / 60_000) });
}

/**
 * The left panel: every table with its status, current match and timer, or how long it has been idle.
 * Collapsed, it shows badges with the overdue and idle counts. A free table offers the ready matches to call.
 */
export function TablesPanel(props: { overview: TableOverview; onFocus: (match: MatchView) => void; onFullScreen: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [callFor, setCallFor] = useState<string | null>(null);
  const idleText = useIdleText();
  const { tables, overdueCount, idleCount } = props.overview;
  const playing = tables.filter((r) => r.status === 'playing' || r.status === 'overdue').length;
  const free = tables.filter((r) => r.status === 'free').length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('tablesPanel.expand')}
        aria-label={t('tablesPanel.expand')}
        className="flex w-11 shrink-0 flex-col items-center gap-3 border-r bg-white py-2 text-slate-600"
      >
        <ChevronsRight className="size-4" />
        <span className="text-[11px] font-bold tracking-widest text-slate-500 uppercase [writing-mode:vertical-rl] rotate-180">
          {t('tablesPanel.heading')}
        </span>
        {overdueCount > 0 && (
          <span className="flex flex-col items-center" title={t('tablesPanel.overdueCount', { count: overdueCount })}>
            <span className="overdue-alarm flex size-7 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {overdueCount}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold text-red-600 uppercase">{t('tablesPanel.overdueBadge')}</span>
          </span>
        )}
        {idleCount > 0 && (
          <span className="flex flex-col items-center" title={t('tablesPanel.idleCount', { count: idleCount })}>
            <span className="idle-alarm flex size-7 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">
              {idleCount}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold text-amber-600 uppercase">{t('tablesPanel.idleBadge')}</span>
          </span>
        )}
      </button>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-white" aria-label={t('tablesPanel.heading')}>
      <div className="flex h-10 items-center gap-2 border-b px-3">
        <span className="font-semibold">{t('tablesPanel.heading')}</span>
        <span className="truncate text-xs text-slate-500">{t('tablesPanel.summary', { playing, free })}</span>
        <button
          type="button"
          onClick={props.onFullScreen}
          title={t('tablesPanel.fullScreen')}
          aria-label={t('tablesPanel.fullScreen')}
          className="ml-auto rounded p-1 text-slate-600 hover:bg-slate-100"
        >
          <Maximize2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title={t('play.collapse')}
          aria-label={t('play.collapse')}
          className="rounded p-1 text-slate-600 hover:bg-slate-100"
        >
          <ChevronsLeft className="size-4" />
        </button>
      </div>
      {tables.length === 0 ? (
        <p className="p-4 text-xs text-slate-400">{t('tables.empty')}</p>
      ) : (
        <ul className="flex-1 overflow-auto">
          {tables.map((row) => {
            const m = row.match;
            const calling = callFor === row.id && row.status === 'free';
            return (
              <li
                key={row.id}
                className={cn(
                  'border-b border-slate-100',
                  row.status === 'overdue' && (m?.overdue === 'red' ? 'bg-red-50' : 'bg-amber-50'),
                  row.idleAlert && 'bg-amber-50/50',
                )}
              >
                <button
                  type="button"
                  disabled={row.status === 'inactive'}
                  aria-expanded={row.status === 'free' ? calling : undefined}
                  onClick={() => (m ? props.onFocus(m) : setCallFor(calling ? null : row.id))}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-black/[.03] disabled:cursor-default"
                >
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md text-[15px] font-bold', tableTone(row))}>
                    {row.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    {m ? (
                      <>
                        <span className="block truncate text-[11px] text-slate-500">
                          {t('match.where', { group: m.location.groupName, round: m.round })}
                          {row.name && ` · ${row.name}`}
                        </span>
                        <span className="block truncate text-xs font-medium">
                          {entryName(m.slots[0].entry)} – {entryName(m.slots[1].entry)}
                        </span>
                      </>
                    ) : row.status === 'free' ? (
                      <>
                        <span className={cn('block text-xs font-semibold', row.idleAlert ? 'text-amber-700' : 'text-emerald-700')}>
                          {t('tablesPanel.status.free')}
                          {row.name && ` · ${row.name}`}
                          {row.idleAlert && ` · ${t('tablesPanel.callPrompt')}`}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {idleText(row)} · {t('tablesPanel.played', { count: row.matchesPlayed })}
                        </span>
                      </>
                    ) : (
                      <span className="block text-xs text-slate-400">
                        {t('tablesPanel.status.inactive')}
                        {row.name && ` · ${row.name}`}
                      </span>
                    )}
                  </span>
                  {m && (
                    <span className="shrink-0 text-right">
                      <span className={cn('block font-bold tabular-nums', overdueText(m))}>{formatClock(row.elapsedMs ?? 0)}</span>
                      <span className="block text-[10px] text-slate-400">
                        {t('tablesPanel.expected', { minutes: Math.round(m.expectedMs / 60_000) })}
                      </span>
                    </span>
                  )}
                </button>
                {calling && <CallFromTable table={row} onDone={() => setCallFor(null)} />}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

/** The ready matches a free table can take, with a one-click call. */
function CallFromTable(props: { table: TableOverviewRow; onDone?: () => void }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const [error, setError] = useState<string | null>(null);
  // Ready matches don't depend on the time, so `now` is irrelevant here.
  const ready = (useQuery((s) => getWaitingList(s, 0)) ?? []).filter((m) => m.status === 'ready').slice(0, CALL_CHOICES);

  if (ready.length === 0) return <p className="px-2 pb-2 text-[11px] text-slate-400">{t('play.noReady')}</p>;
  return (
    <div className="grid gap-0.5 px-2 pb-2">
      {ready.map((m) => (
        <button
          key={m.id}
          type="button"
          title={t('play.callTo', { number: props.table.number })}
          onClick={() => {
            const failure = dispatch({ type: 'assignMatch', match: m.id, table: props.table.id, at: Date.now() });
            if (failure) setError(errorMessage(t, failure));
            else props.onDone?.();
          }}
          className="flex w-full items-center gap-1.5 rounded border border-slate-200 bg-white px-1.5 py-1 text-left text-[11.5px] hover:border-slate-500"
        >
          <b className="shrink-0">{t('match.where', { group: m.location.groupName, round: m.round })}</b>
          <span className="truncate">
            {entryName(m.slots[0].entry)} – {entryName(m.slots[1].entry)}
          </span>
          <span className="ml-auto shrink-0 text-slate-400">→ {props.table.number}</span>
        </button>
      ))}
      {error && (
        <p role="alert" className="text-destructive text-[11px]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Full-screen tiles of every table. Clicking a playing table jumps to its match. */
export function TablesFullScreen(props: { overview: TableOverview; onFocus: (match: MatchView) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const idleText = useIdleText();
  const dispatch = useApp((s) => s.dispatch);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-50 p-5" role="dialog" aria-label={t('tablesPanel.fullHeading')}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">{t('tablesPanel.fullHeading')}</h2>
        <span className="text-xs text-slate-500">{t('tablesPanel.fullHint')}</span>
        <Button size="sm" className="ml-auto" onClick={props.onClose}>
          <X />
          {t('tablesPanel.backToCanvas')}
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
        {props.overview.tables.map((row) => {
          const m = row.match;
          const pct = m ? Math.min(100, ((row.elapsedMs ?? 0) / m.expectedMs) * 100) : 0;
          const frame = {
            overdue: m?.overdue === 'red' ? 'border-red-500 overdue-alarm' : 'border-amber-500',
            playing: 'border-sky-400',
            free: row.idleAlert ? 'border-amber-400 idle-alarm' : 'border-emerald-400',
            inactive: 'border-slate-200 opacity-60',
          }[row.status];
          const header = (
            <div className="flex items-center gap-2">
              <span className={cn('flex size-10 items-center justify-center rounded-lg text-xl font-bold', tableTone(row))}>{row.number}</span>
              <span className="min-w-0 text-[11px] text-slate-500">
                <span className="block truncate">{row.name || ' '}</span>
                <span className="block font-semibold uppercase">{t(`tablesPanel.status.${row.status}`)}</span>
              </span>
              {m && <span className={cn('ml-auto text-xl font-bold tabular-nums', overdueText(m))}>{formatClock(row.elapsedMs ?? 0)}</span>}
            </div>
          );
          if (m) {
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  props.onClose();
                  props.onFocus(m);
                }}
                className={cn('flex h-44 flex-col rounded-xl border-2 bg-white p-3 text-left hover:shadow-lg', frame)}
              >
                {header}
                <span className="mt-2 truncate text-[11px] text-slate-500">{t('match.where', { group: m.location.groupName, round: m.round })}</span>
                <span className="truncate text-[13px] font-semibold">{entryName(m.slots[0].entry)}</span>
                <span className="truncate text-[13px] font-semibold">{entryName(m.slots[1].entry)}</span>
                <span className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={cn('block h-full', m.overdue === 'red' ? 'bg-red-500' : m.overdue ? 'bg-amber-500' : 'bg-sky-500')}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </button>
            );
          }
          return (
            <div key={row.id} className={cn('flex h-44 flex-col rounded-xl border-2 bg-white p-3', frame)}>
              {header}
              {row.status === 'free' ? (
                <>
                  <p className="mt-1 text-[11px] text-slate-500">{idleText(row)}</p>
                  <div className="-mx-2 min-h-0 flex-1 overflow-auto">
                    <CallFromTable table={row} />
                  </div>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto"
                  onClick={() => dispatch({ type: 'setTableActive', table: row.id, active: true })}
                >
                  {t('tablesPanel.activate')}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
