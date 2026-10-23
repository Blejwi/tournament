import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getChangeLog, getStats, type DurationStatsView, type MatchView } from '@/engine';
import { useQuery } from '@/app/useApp';
import { entryName } from '@/ui/format';
import { matchTitle } from '@/ui/matchLabels';
import { entryText, useClockTime } from '@/ui/changeLogText';
import { ChangeLogList } from './ChangeLog';

type Focus = (match: Pick<MatchView, 'id' | 'competition'>) => void;

/** "25 min" or "1 h 05 min", rounded to the minute. */
function formatDuration(t: TFunction, ms: number): string {
  const total = Math.round(ms / 60_000);
  if (total < 60) return t('statsDrawer.minutes', { minutes: total });
  return t('statsDrawer.hoursMinutes', { hours: Math.floor(total / 60), minutes: String(total % 60).padStart(2, '0') });
}

function averageText(t: TFunction, durations: DurationStatsView): string {
  return durations.averageMs === null ? t('statsDrawer.noAverage') : t('statsDrawer.average', { duration: formatDuration(t, durations.averageMs) });
}

const percent = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

function Bar({ done, total }: { done: number; total: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full bg-slate-700" style={{ width: `${percent(done, total)}%` }} />
    </div>
  );
}

/** The collapsible bottom drawer: progress, average durations, longest matches, time left, and the change log. */
export function StatsDrawer(props: { now: number; onFocus: Focus }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const stats = useQuery((s) => getStats(s, props.now), [props.now]);
  const log = useQuery(getChangeLog) ?? [];
  const time = useClockTime();
  if (!stats) return null;
  const { progress } = stats;
  const heading = 'mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase';
  const timeLeft =
    stats.timeLeftMs === null
      ? t('statsDrawer.timeLeftUnknown')
      : stats.timeLeftMs === 0
        ? t('statsDrawer.allDone')
        : t('statsDrawer.timeLeft', { duration: formatDuration(t, stats.timeLeftMs) });
  const last = log[0];

  return (
    <section className="shrink-0 border-t bg-white text-xs" aria-label={t('statsDrawer.heading')}>
      <div className="flex h-8 items-center gap-4 px-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          title={open ? t('statsDrawer.hide') : t('statsDrawer.show')}
          aria-expanded={open}
          className="flex items-center gap-1 font-semibold hover:text-slate-600"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          {t('statsDrawer.heading')}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-32">
            <Bar {...progress} />
          </div>
          <span className="tabular-nums">{t('statsDrawer.progress', { ...progress, percent: percent(progress.done, progress.total) })}</span>
        </div>
        {stats.competitions.length > 1 &&
          stats.competitions
            .filter((c) => c.durations.averageMs !== null)
            .map((c) => (
              <span key={c.competition} className="text-slate-500">
                {t('statsDrawer.competitionAverage', { name: c.name, duration: formatDuration(t, c.durations.averageMs!) })}
              </span>
            ))}
        <span className="text-slate-500" title={t('statsDrawer.timeLeftTitle')}>
          {timeLeft}
        </span>
        <span className="ml-auto max-w-[40%] truncate text-slate-400">
          {last ? t('statsDrawer.lastChange', { time: time(last.at), text: entryText(t, last) }) : t('statsDrawer.noChanges')}
        </span>
      </div>
      {open && (
        <div className="grid h-56 grid-cols-3 gap-6 border-t border-slate-100 px-4 py-3">
          <div className="overflow-auto">
            <div className={heading}>{t('statsDrawer.progressHeading')}</div>
            {stats.competitions.map((c) => (
              <div key={c.competition} className="mb-3">
                <div className="flex items-center gap-2">
                  <b>{c.name}</b>
                  <span className="ml-auto tabular-nums">
                    {c.done}/{c.total}
                  </span>
                </div>
                <div className="my-1">
                  <Bar done={c.done} total={c.total} />
                </div>
                <div className="text-slate-500">
                  {averageText(t, c.durations)}
                  {c.durations.matches > 0 && ` · ${t('statsDrawer.matchesCount', { count: c.durations.matches })}`}
                </div>
                {c.stages.length > 1 &&
                  c.stages.map((s) => (
                    <div key={s.stage} className="flex gap-2 pl-2 text-slate-500">
                      <span>{t('statsDrawer.stage', { number: s.stageIndex + 1, type: t(`statsDrawer.stageType.${s.type}`) })}</span>
                      <span className="tabular-nums">
                        {s.done}/{s.total}
                      </span>
                      <span className="ml-auto">{averageText(t, s.durations)}</span>
                    </div>
                  ))}
              </div>
            ))}
            <div className={heading}>{t('statsDrawer.tablesHeading')}</div>
            {stats.tables.map((table) => (
              <div key={table.table} className="flex gap-2 text-slate-600">
                <span>{t('statsDrawer.tableAverage', { number: table.number })}</span>
                <span className="ml-auto text-slate-500">
                  {averageText(t, table.durations)}
                  {table.durations.matches > 0 && ` · ${t('statsDrawer.matchesCount', { count: table.durations.matches })}`}
                </span>
              </div>
            ))}
          </div>
          <div className="overflow-auto">
            <div className={heading}>{t('statsDrawer.longestHeading')}</div>
            {stats.longest.length === 0 && <p className="text-slate-400">{t('statsDrawer.noLongest')}</p>}
            {stats.longest.map(({ match, durationMs }) => (
              <button
                key={match.id}
                type="button"
                title={t('statsDrawer.longestTitle')}
                onClick={() => props.onFocus(match)}
                className="flex w-full items-center gap-2 py-0.5 text-left hover:bg-slate-50"
              >
                <b className="shrink-0">
                  {stats.competitions.length > 1 && `${stats.competitions.find((c) => c.competition === match.competition)?.name} · `}
                  {matchTitle(t, match)}
                </b>
                <span className="break-words text-slate-500">
                  {entryName(match.slots[0].entry)} – {entryName(match.slots[1].entry)}
                </span>
                <span className="ml-auto shrink-0 tabular-nums">
                  {match.table && `${t('match.table', { number: match.table.number })} · `}
                  {formatDuration(t, durationMs)}
                </span>
              </button>
            ))}
          </div>
          <div className="overflow-auto">
            <div className={heading}>{t('statsDrawer.logHeading')}</div>
            <ChangeLogList entries={log} onFocus={props.onFocus} />
          </div>
        </div>
      )}
    </section>
  );
}
