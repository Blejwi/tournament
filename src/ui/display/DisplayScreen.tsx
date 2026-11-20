import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Maximize, Minimize, Settings } from 'lucide-react';
import {
  getCompetition,
  getCompetitions,
  getDisplayCycle,
  getStage,
  getTableOverview,
  getTournament,
  getWaitingList,
  type MatchView,
  type StageView,
  type TableOverviewRow,
  type TournamentState,
} from '@/engine';
import { loadExcluded, saveExcluded } from '@/app/displayPrefs';
import { TournamentStateContext, useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { entryName, formatClock } from '@/ui/format';
import { matchTitle } from '@/ui/matchLabels';
import { BracketBoard } from '@/ui/play/BracketBoard';
import { GroupBox } from '@/ui/play/GroupBox';
import { overdueText } from '@/ui/play/overdueStyle';
import { bracketLayoutSections, groupColumns } from '@/ui/play/bracketSections';
import { tableTone } from '@/ui/play/tableTone';
import { useNow } from '@/ui/useNow';
import { usePlayOffLayout } from '@/ui/usePlayOffLayout';
import { FitToScreen } from './FitToScreen';
import { useDisplayTournament } from './useDisplayTournament';

/** How long one competition stays on screen before the next one. */
export const CYCLE_SECONDS = 20;
/** How many waiting matches the "next" list shows. */
const NEXT_MATCHES = 5;
/** The settings hide again this long after the mouse stopped moving. */
const CONTROLS_HIDE_MS = 3_000;

/**
 * The players' screen (#0026): which match is on each table, the next matches to be called, and one
 * competition at a time. Read-only: it only loads the tournament and runs queries, so it can't change anything.
 */
export function DisplayScreen() {
  const { tournamentId = '' } = useParams();
  const { t } = useTranslation();
  const state = useDisplayTournament(tournamentId);

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-10 text-center text-2xl text-slate-600">
        <div className="grid gap-4">
          <p>{t('display.notFound')}</p>
          <Link to="/" className="text-base text-indigo-600 underline">
            {t('tournaments.backToList')}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <TournamentStateContext.Provider value={state}>
      <Display state={state} />
    </TournamentStateContext.Provider>
  );
}

function Display({ state }: { state: TournamentState }) {
  const { t } = useTranslation();
  const now = useNow();
  const [excluded, setExcluded] = useState(() => loadExcluded(state.id));
  const competitions = useQuery(getCompetitions) ?? [];
  const cycle = useMemo(() => getDisplayCycle(state, { excluded }), [state, excluded]);
  const tournament = useQuery(getTournament);
  const { current, secondsLeft } = useCycle(cycle, now);
  const { visible: controls, bump: showControls } = useTransientVisibility();

  const toggle = (id: string) => {
    const next = excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id];
    setExcluded(next);
    saveExcluded(state.id, next);
  };

  return (
    <div className="flex h-dvh flex-col bg-slate-100 text-slate-900" onMouseMove={showControls}>
      <header className="flex shrink-0 items-center gap-6 bg-slate-900 px-6 py-3 text-white">
        <h1 className="min-w-0 truncate text-2xl font-bold">{current ? current.name : tournament?.name}</h1>
        {current && <span className="truncate text-lg text-slate-400">{tournament?.name}</span>}
        <div className="ml-auto flex items-center gap-4">
          {secondsLeft !== null && <span className="text-sm text-slate-300 tabular-nums">{t('display.nextIn', { seconds: secondsLeft })}</span>}
          <Controls visible={controls} competitions={competitions} cycleIds={cycle.map((c) => c.id)} excluded={excluded} onToggle={toggle} />
        </div>
      </header>
      {secondsLeft !== null && (
        <div className="h-1 shrink-0 bg-slate-800">
          <div className="h-full bg-indigo-500 transition-[width] duration-1000 ease-linear" style={{ width: `${(secondsLeft / CYCLE_SECONDS) * 100}%` }} />
        </div>
      )}
      <TablesStrip now={now} />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {current ? (
            <CompetitionView key={current.id} competitionId={current.id} now={now} />
          ) : (
            <div className="grid flex-1 place-items-center p-10 text-center text-xl text-slate-400">{t('display.noCompetition')}</div>
          )}
        </main>
        <NextMatches now={now} />
      </div>
    </div>
  );
}

/**
 * Which cycle item is on screen. Advances every `CYCLE_SECONDS`; when the list changes it stays on the
 * competition that is on screen if it is still in the list, otherwise it takes the one now at that place.
 */
function useCycle(cycle: { id: string; name: string }[], now: number) {
  const [shown, setShown] = useState<{ id: string | null; index: number; since: number }>({ id: null, index: 0, since: now });
  const stillThere = cycle.findIndex((c) => c.id === shown.id);
  const index = cycle.length === 0 ? -1 : stillThere !== -1 ? stillThere : Math.min(shown.index, cycle.length - 1);
  const due = cycle.length > 1 && now - shown.since >= CYCLE_SECONDS * 1000;
  const target = due ? (index + 1) % cycle.length : index;

  const targetId = cycle[target]?.id ?? null;
  useEffect(() => {
    if (targetId !== shown.id || target !== shown.index) setShown({ id: targetId, index: Math.max(target, 0), since: due || targetId !== shown.id ? now : shown.since });
  }, [targetId, target, due, shown, now]);

  const current = cycle[index] ?? null;
  const secondsLeft = cycle.length > 1 ? Math.max(0, Math.ceil((CYCLE_SECONDS * 1000 - (now - shown.since)) / 1000)) : null;
  return { current, secondsLeft };
}

/** True while the mouse moves, and for a moment after. */
function useTransientVisibility() {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bump = useCallback(() => {
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), CONTROLS_HIDE_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { visible, bump };
}

/** Full-screen toggle and the cycle settings. Hidden until the mouse moves over the display. */
function Controls(props: {
  visible: boolean;
  competitions: { id: string; name: string }[];
  cycleIds: string[];
  excluded: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(() => document.fullscreenElement !== null);
  useEffect(() => {
    const onChange = () => setFullScreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const button = 'flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20';

  return (
    <div className={cn('relative flex items-center gap-2 transition-opacity', props.visible || open ? 'opacity-100' : 'pointer-events-none opacity-0')}>
      <button type="button" className={button} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Settings className="size-4" aria-hidden />
        {t('display.settings')}
      </button>
      <button
        type="button"
        className={button}
        onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
      >
        {fullScreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
        {t(fullScreen ? 'display.exitFullScreen' : 'display.fullScreen')}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-20 mt-2 w-80 rounded-lg bg-white p-4 text-slate-900 shadow-xl ring-1 ring-slate-200">
          <p className="mb-2 text-sm text-slate-500">{t('display.settingsHint')}</p>
          <ul className="grid gap-1">
            {props.competitions.map((c) => {
              const included = !props.excluded.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex items-center gap-2 rounded p-1 hover:bg-slate-50">
                    <input type="checkbox" className="size-4" checked={included} onChange={() => props.onToggle(c.id)} />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    {included && !props.cycleIds.includes(c.id) && <span className="text-xs text-slate-400">{t('display.notConfirmed')}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One tile per active table: its number, the match on it and how long it has been playing. */
function TablesStrip({ now }: { now: number }) {
  const { t } = useTranslation();
  const overview = useQuery((s) => getTableOverview(s, now), [now]);
  const tables = (overview?.tables ?? []).filter((r) => r.status !== 'inactive');
  if (tables.length === 0) return null;
  return (
    <section aria-label={t('tablesPanel.heading')} className="shrink-0 border-b bg-white px-4 py-3">
      <ul className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${tables.length > 8 ? '14rem' : '17rem'}, 1fr))` }}>
        {tables.map((row) => (
          <TableTile key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

function TableTile({ row }: { row: TableOverviewRow }) {
  const { t } = useTranslation();
  const m = row.match;
  return (
    <li
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-lg border-2 bg-slate-50 p-2',
        row.status === 'overdue' ? (m?.overdue === 'red' ? 'border-red-500' : 'border-amber-500') : row.status === 'playing' ? 'border-sky-300' : 'border-slate-200',
      )}
    >
      <span className={cn('flex size-14 shrink-0 items-center justify-center rounded-lg text-3xl font-bold', tableTone(row))}>{row.number}</span>
      {m ? (
        <>
          <span className="min-w-0 flex-1 text-lg leading-tight font-semibold">
            <span className="block truncate">{entryName(m.slots[0].entry)}</span>
            <span className="block truncate">{entryName(m.slots[1].entry)}</span>
          </span>
          <span className={cn('shrink-0 text-2xl font-bold tabular-nums', overdueText(m))}>{formatClock(row.elapsedMs ?? 0)}</span>
        </>
      ) : (
        <span className="text-lg font-semibold text-emerald-700">{t('display.freeTable')}</span>
      )}
    </li>
  );
}

/** The next matches that can be called, in the waiting list's order. */
function NextMatches({ now }: { now: number }) {
  const { t } = useTranslation();
  const competitions = useQuery(getCompetitions) ?? [];
  const next = (useQuery((s) => getWaitingList(s, now), [now]) ?? []).filter((m) => m.status === 'ready').slice(0, NEXT_MATCHES);
  return (
    <aside aria-label={t('display.next')} className="flex w-96 shrink-0 flex-col border-l bg-white max-[1400px]:w-80">
      <h2 className="border-b px-4 py-3 text-xl font-bold">{t('display.next')}</h2>
      {next.length === 0 ? (
        <p className="p-4 text-slate-400">{t('display.nextEmpty')}</p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-hidden">
          {next.map((m: MatchView, i) => (
            <li key={m.id} className="border-b px-4 py-3">
              <span className="flex items-baseline gap-2 text-sm text-slate-500">
                <span className="font-bold text-slate-400">{i + 1}.</span>
                {competitions.length > 1 && <b className="truncate text-slate-700">{competitions.find((c) => c.id === m.competition)?.name}</b>}
                <span className="truncate">{matchTitle(t, m)}</span>
              </span>
              <span className="block text-xl leading-snug font-semibold">{entryName(m.slots[0].entry)}</span>
              <span className="block text-xl leading-snug font-semibold">{entryName(m.slots[1].entry)}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

/** One competition's groups and brackets, fitted to the space and not interactive. */
function CompetitionView({ competitionId, now }: { competitionId: string; now: number }) {
  const { t } = useTranslation();
  const [playOffLayout] = usePlayOffLayout();
  const competition = useQuery((s) => getCompetition(s, competitionId), [competitionId]);
  const stageIds = (competition?.stages ?? []).map((s) => s.id).join();
  const stages =
    useQuery(
      (s) =>
        stageIds
          .split(',')
          .filter(Boolean)
          .map((id) => getStage(s, id, now))
          .filter((v): v is StageView => v !== null),
      [stageIds, now],
    ) ?? [];
  return (
    <FitToScreen className="flex-1 bg-slate-100">
      <div className="flex flex-col items-center gap-12 p-8">
        {stages.map((s) =>
          s.type === 'groups' ? (
            <div key={s.id} className="grid gap-6" style={{ gridTemplateColumns: `repeat(${groupColumns(s.groups.length)}, auto)` }}>
              {s.groups.map((group) => (
                <GroupBox key={group.id} group={group} selectedMatch={null} />
              ))}
            </div>
          ) : (
            <BracketBoard key={s.id} sections={bracketLayoutSections(t, s, playOffLayout)} selectedMatch={null} />
          ),
        )}
      </div>
    </FitToScreen>
  );
}
