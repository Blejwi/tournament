import { useTranslation } from 'react-i18next';
import type { ChangeLogEntryView, MatchView } from '@/engine';
import { entryText, linkedMatch, useClockTime } from '@/ui/changeLogText';

/** The read-only change log, newest first; a click on an entry shows its match on the canvas. */
export function ChangeLogList(props: { entries: ChangeLogEntryView[]; onFocus: (match: Pick<MatchView, 'id' | 'competition'>) => void }) {
  const { t } = useTranslation();
  const time = useClockTime();
  if (props.entries.length === 0) return <p className="text-slate-400">{t('statsDrawer.logEmpty')}</p>;
  return (
    <ol>
      {props.entries.map((entry) => {
        const match = linkedMatch(entry);
        return (
          <li key={entry.seq} className="border-b border-slate-50">
            <button
              type="button"
              disabled={!match}
              title={match ? t('changeLog.showMatch') : undefined}
              onClick={() => match && props.onFocus(match)}
              className="flex w-full gap-2 py-0.5 text-left enabled:hover:bg-slate-50"
            >
              <span className="shrink-0 text-slate-400 tabular-nums">{time(entry.at)}</span>
              <span>{entryText(t, entry)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
