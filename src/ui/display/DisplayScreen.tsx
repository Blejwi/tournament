import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Maximize, Minimize, Settings } from 'lucide-react';
import {
  getCompetition,
  getCompetitions,
  getDisplayCycle,
  getDisplayFocus,
  getDisplayNames,
  getStage,
  getTableOverview,
  getTournament,
  getWaitingList,
  type MatchView,
  type TableOverviewRow,
  type TournamentState,
} from '@/engine';
import { loadExcluded, loadUnsplit, saveExcluded, saveUnsplit } from '@/app/displayPrefs';
import { TournamentStateContext, useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { formatClock } from '@/ui/format';
import { matchTitle } from '@/ui/matchLabels';
import { BracketBoard } from '@/ui/play/BracketBoard';
import { DisplayModeContext, useEntryName } from '@/ui/play/displayMode';
import { GroupBox } from '@/ui/play/GroupBox';
import { overdueText } from '@/ui/play/overdueStyle';
import { tableTone } from '@/ui/play/tableTone';
import { useNow } from '@/ui/useNow';
import { FitToScreen } from './FitToScreen';
import { DISPLAY_MIN_SCALE, planCompetitionPages, type DisplayPage, type PageContent } from './pagePlan';
import { useDisplayTournament } from './useDisplayTournament';

/** How long one page (some groups, or part of a bracket) stays on screen before the next one. */
export const PAGE_SECONDS = 12;
/** How long the sidebar shows one view (the tables, then the next matches) before the other. Faster than the pages. */
export const SIDEBAR_CYCLE_SECONDS = 8;
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
  const [unsplit, setUnsplit] = useState(() => loadUnsplit(state.id));
  const competitions = useQuery(getCompetitions) ?? [];
  const cycle = useMemo(() => getDisplayCycle(state, { excluded }), [state, excluded]);
  const tournament = useQuery(getTournament);
  const { visible: controls, bump: showControls } = useTransientVisibility();
  const names = useQuery(getDisplayNames);
  const mode = useMemo(() => ({ names: names ?? {} }), [names]);

  // The pages depend on how much room the content has.
  const [mainRef, size] = useElementSize<HTMLElement>();
  const minScale = DISPLAY_MIN_SCALE * Math.min(1, Math.max(0.85, size.w / 1536));
  const pages =
    useQuery(
      (s) =>
        size.w === 0
          ? []
          : cycle.flatMap((c) =>
              planCompetitionPages(
                t,
                c.id,
                (getCompetition(s, c.id)?.stages ?? []).map((stage) => getStage(s, stage.id, now)),
                getDisplayFocus(s, c.id, now),
                { w: size.w, h: size.h, minScale },
                !unsplit.includes(c.id),
              ),
            ),
      [cycle, now, t, size.w, size.h, minScale, unsplit],
    ) ?? [];
  const { current, index, secondsLeft, goTo } = useCycle(pages, now);
  const competitionIndex = Math.max(0, cycle.findIndex((c) => c.id === current?.competition));
  const sameCompetition = current ? pages.filter((p) => p.competition === current.competition) : [];
  const competition = cycle[competitionIndex];

  const toggleSplit = (id: string) => {
    const next = unsplit.includes(id) ? unsplit.filter((x) => x !== id) : [...unsplit, id];
    setUnsplit(next);
    saveUnsplit(state.id, next);
  };
  const goToCompetition = (id: string) => {
    const first = pages.findIndex((p) => p.competition === id);
    if (first !== -1) goTo(first);
  };
  useStepKeys((delta) => goTo(index + delta));

  const toggle = (id: string) => {
    const next = excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id];
    setExcluded(next);
    saveExcluded(state.id, next);
  };

  return (
    <DisplayModeContext.Provider value={mode}>
      <div className="flex h-dvh flex-col bg-slate-100 text-slate-900" onMouseMove={showControls}>
        <header className="flex shrink-0 items-center gap-6 bg-slate-900 px-6 py-3 text-white">
          <h1 className="min-w-0 truncate text-2xl font-bold">
            {current && competition ? competition.name : tournament?.name}
            {current && sameCompetition.length > 1 && <span className="font-normal text-slate-300"> · {pageLabel(t, current)}</span>}
          </h1>
          {current && <span className="truncate text-lg text-slate-400">{tournament?.name}</span>}
          <div className="ml-auto flex items-center gap-4">
            {secondsLeft !== null && <span className="text-sm text-slate-300 tabular-nums">{t('display.nextIn', { seconds: secondsLeft })}</span>}
            <Controls visible={controls} competitions={competitions} cycle={cycle} excluded={excluded} onToggle={toggle} unsplit={unsplit} onToggleSplit={toggleSplit} />
          </div>
        </header>
        {pages.length > 1 && <NavTabs pages={pages} cycle={cycle} current={current} onGoTo={goTo} onGoToCompetition={goToCompetition} />}
        {secondsLeft !== null && (
          <div className="h-1 shrink-0 bg-slate-800">
            <div className="h-full bg-indigo-500 transition-[width] duration-1000 ease-linear" style={{ width: `${(secondsLeft / PAGE_SECONDS) * 100}%` }} />
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          <main ref={mainRef} className="flex min-w-0 flex-1 flex-col">
            {current ? (
              <PageView key={current.key} page={current} />
            ) : (
              <div className="grid flex-1 place-items-center p-10 text-center text-xl text-slate-400">{t('display.noCompetition')}</div>
            )}
          </main>
          <Sidebar now={now} />
        </div>
      </div>
    </DisplayModeContext.Provider>
  );
}

/** "Drabinka 2/3", or just "Grupy" when the stage is one page. */
function pageLabel(t: TFunction, page: DisplayPage): string {
  const name = t(page.type === 'groups' ? 'display.pageGroups' : 'display.pageBracket');
  return page.of > 1 ? `${name} ${page.n}/${page.of}` : name;
}

/** The size of an element's box, kept up to date as it changes. Zero until measured. */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize((prev) => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * Which page is on screen. Advances every `PAGE_SECONDS`; when the pages change it stays on the page
 * that is on screen if it is still there, otherwise it takes the one now at that place.
 */
function useCycle<P extends { key: string }>(pages: P[], now: number) {
  const [shown, setShown] = useState<{ key: string | null; index: number; since: number }>({ key: null, index: 0, since: now });
  const stillThere = pages.findIndex((p) => p.key === shown.key);
  const index = pages.length === 0 ? -1 : stillThere !== -1 ? stillThere : Math.min(shown.index, pages.length - 1);
  const due = pages.length > 1 && now - shown.since >= PAGE_SECONDS * 1000;
  const target = due ? (index + 1) % pages.length : index;

  const targetKey = pages[target]?.key ?? null;
  useEffect(() => {
    if (targetKey !== shown.key || target !== shown.index) setShown({ key: targetKey, index: Math.max(target, 0), since: due || targetKey !== shown.key ? now : shown.since });
  }, [targetKey, target, due, shown, now]);

  const current = pages[index] ?? null;
  const secondsLeft = pages.length > 1 ? Math.max(0, Math.ceil((PAGE_SECONDS * 1000 - (now - shown.since)) / 1000)) : null;
  /** Shows the page at `to` (wrapping round) at once and restarts the countdown, so the cycle carries on from it. */
  const goTo = (to: number) => {
    if (pages.length < 2) return;
    const next = ((to % pages.length) + pages.length) % pages.length;
    setShown({ key: pages[next].key, index: next, since: now });
  };
  return { current, index, secondsLeft, goTo };
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

/** ←/→ step through the pages. */
function useStepKeys(onStep: (delta: number) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))) return;
      if (e.key === 'ArrowLeft') onStep(-1);
      else if (e.key === 'ArrowRight') onStep(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStep]);
}

/**
 * Always-visible navigation (#0030): a tab per competition, and under it a tab per page of the competition
 * on screen. The current ones are marked, so it is clear where the display is and where it goes next;
 * a click goes there at once and restarts the countdown.
 */
function NavTabs(props: {
  pages: DisplayPage[];
  cycle: { id: string; name: string }[];
  current: DisplayPage | null;
  onGoTo: (index: number) => void;
  onGoToCompetition: (id: string) => void;
}) {
  const { t } = useTranslation();
  const own = props.pages.map((page, index) => ({ page, index })).filter(({ page }) => page.competition === props.current?.competition);
  const tab = (active: boolean) =>
    cn('max-w-64 truncate rounded-t-md px-4 py-1.5 text-base font-semibold', active ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10');
  return (
    <nav className="shrink-0 bg-slate-800 px-6 pt-1.5" aria-label={t('display.competitions')}>
      {props.cycle.length > 1 && (
        <ul className="flex gap-1">
          {props.cycle.map((c) => (
            <li key={c.id} className="min-w-0">
              <button type="button" aria-current={c.id === props.current?.competition ? 'true' : undefined} title={c.name} className={tab(c.id === props.current?.competition)} onClick={() => props.onGoToCompetition(c.id)}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {own.length > 1 && (
        <ul className={cn('flex gap-1 bg-white px-2 pt-1.5', props.cycle.length > 1 && 'rounded-tr-md')} aria-label={t('display.pages')}>
          {own.map(({ page, index }) => (
            <li key={page.key}>
              <button
                type="button"
                aria-current={page === props.current ? 'true' : undefined}
                className={cn('rounded-t-md px-3 py-1 text-sm font-semibold', page === props.current ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                onClick={() => props.onGoTo(index)}
              >
                {pageLabel(t, page)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

/** Full-screen toggle and the cycle settings. Hidden until the mouse moves over the display. */
function Controls(props: {
  visible: boolean;
  competitions: { id: string; name: string }[];
  /** The competitions in the cycle. */
  cycle: { id: string; name: string }[];
  excluded: string[];
  onToggle: (id: string) => void;
  /** Competitions shown whole on one screen, without page splitting. */
  unsplit: string[];
  onToggleSplit: (id: string) => void;
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
        <div className="absolute top-full right-0 z-20 mt-2 w-[26rem] rounded-lg bg-white p-4 text-slate-900 shadow-xl ring-1 ring-slate-200">
          <p className="mb-2 text-sm text-slate-500">{t('display.settingsHint')}</p>
          <ul className="grid gap-1">
            {props.competitions.map((c) => {
              const included = !props.excluded.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex items-center gap-2 rounded p-1 hover:bg-slate-50">
                    <input type="checkbox" className="size-4" checked={included} onChange={() => props.onToggle(c.id)} />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    {included && !props.cycle.some((item) => item.id === c.id) && <span className="text-xs text-slate-400">{t('display.notConfirmed')}</span>}
                  </label>
                  <label className="ml-7 flex items-center gap-2 rounded p-1 text-sm text-slate-600 hover:bg-slate-50">
                    <input type="checkbox" className="size-4" checked={!props.unsplit.includes(c.id)} onChange={() => props.onToggleSplit(c.id)} />
                    {t('display.splitPages')}
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

/**
 * The right sidebar (#0028): the tables and the next matches in turn, each for `SIDEBAR_CYCLE_SECONDS`.
 * Both headings show, the one on screen marked, and a bar runs down to the next switch.
 */
function Sidebar({ now }: { now: number }) {
  const { t } = useTranslation();
  const [since] = useState(now);
  const period = SIDEBAR_CYCLE_SECONDS * 1000;
  const elapsed = Math.max(0, now - since);
  const view = Math.floor(elapsed / period) % 2 === 0 ? 'tables' : 'next';
  const left = period - (elapsed % period);
  const heading = (name: 'tables' | 'next') => (name === 'tables' ? t('tablesPanel.heading') : t('display.next'));
  return (
    <aside aria-label={heading(view)} className="flex w-96 shrink-0 flex-col border-l bg-white max-[1400px]:w-80">
      <div className="flex border-b" role="tablist">
        {(['tables', 'next'] as const).map((name) => (
          <h2
            key={name}
            role="tab"
            aria-selected={view === name}
            className={cn('flex-1 truncate px-2 py-3 text-center text-xl font-bold', view === name ? 'bg-slate-900 text-white' : 'text-slate-400')}
          >
            {heading(name)}
          </h2>
        ))}
      </div>
      <div className="h-1 shrink-0 bg-slate-200">
        <div className="h-full bg-indigo-500 transition-[width] duration-1000 ease-linear" style={{ width: `${(left / period) * 100}%` }} />
      </div>
      {view === 'tables' ? <TablesView now={now} /> : <NextMatches now={now} />}
    </aside>
  );
}

/** Every active table: its number, the match on it and how long it has been playing, or "Free". */
function TablesView({ now }: { now: number }) {
  const { t } = useTranslation();
  const overview = useQuery((s) => getTableOverview(s, now), [now]);
  const tables = (overview?.tables ?? []).filter((r) => r.status !== 'inactive');
  if (tables.length === 0) return <p className="p-4 text-slate-400">{t('display.tablesEmpty')}</p>;
  return (
    <ul className="grid min-h-0 flex-1 content-start gap-2 overflow-hidden p-2">
      {tables.map((row) => (
        <TableTile key={row.id} row={row} />
      ))}
    </ul>
  );
}

function TableTile({ row }: { row: TableOverviewRow }) {
  const { t } = useTranslation();
  const nameOf = useEntryName();
  const m = row.match;
  return (
    <li
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-lg border-2 bg-slate-50 p-2.5 max-[1400px]:gap-2 max-[1400px]:p-1.5',
        row.status === 'overdue' ? (m?.overdue === 'red' ? 'border-red-500' : 'border-amber-500') : row.status === 'playing' ? 'border-sky-300' : 'border-slate-200',
      )}
    >
      <span className={cn('flex size-14 shrink-0 items-center justify-center rounded-lg text-3xl font-bold max-[1400px]:size-10 max-[1400px]:text-xl', tableTone(row))}>{row.number}</span>
      {m ? (
        <>
          <span className="min-w-0 flex-1 text-2xl leading-tight font-semibold max-[1400px]:text-lg">
            <span className="block truncate">{nameOf(m.slots[0].entry)}</span>
            <span className="block truncate">{nameOf(m.slots[1].entry)}</span>
          </span>
          <span className={cn('shrink-0 text-2xl font-bold tabular-nums max-[1400px]:text-lg', overdueText(m))}>{formatClock(row.elapsedMs ?? 0)}</span>
        </>
      ) : (
        <span className="text-2xl font-semibold text-emerald-700">{t('display.freeTable')}</span>
      )}
    </li>
  );
}

/** The next matches that can be called, in the waiting list's order. */
function NextMatches({ now }: { now: number }) {
  const { t } = useTranslation();
  const nameOf = useEntryName();
  const competitions = useQuery(getCompetitions) ?? [];
  const next = (useQuery((s) => getWaitingList(s, now), [now]) ?? []).filter((m) => m.status === 'ready').slice(0, NEXT_MATCHES);
  if (next.length === 0) return <p className="p-4 text-slate-400">{t('display.nextEmpty')}</p>;
  return (
    <ol className="min-h-0 flex-1 overflow-hidden">
      {next.map((m: MatchView, i) => (
        <li key={m.id} className="border-b px-4 py-3">
          <span className="flex items-baseline gap-2 text-base text-slate-500">
            <span className="font-bold text-slate-400">{i + 1}.</span>
            {competitions.length > 1 && <b className="truncate text-slate-700">{competitions.find((c) => c.id === m.competition)?.name}</b>}
            <span className="truncate">{matchTitle(t, m)}</span>
          </span>
          <span className="block text-2xl leading-snug font-semibold max-[1400px]:text-xl">{nameOf(m.slots[0].entry)}</span>
          <span className="block text-2xl leading-snug font-semibold max-[1400px]:text-xl">{nameOf(m.slots[1].entry)}</span>
        </li>
      ))}
    </ol>
  );
}

/** One page of the display: some groups, or some blocks of a bracket, fitted to the space and not interactive. */
function PageView({ page }: { page: DisplayPage }) {
  return (
    <FitToScreen className="flex-1 bg-slate-100">
      <ContentView content={page.content} />
    </FitToScreen>
  );
}

function ContentView({ content }: { content: PageContent }) {
  switch (content.kind) {
    case 'groups':
      return (
        <div className="grid items-start gap-6 p-4" style={{ gridTemplateColumns: `repeat(${content.columns}, auto)` }}>
          {content.groups.map((group) => (
            <GroupBox key={group.id} group={group} selectedMatch={null} shownMatches={content.matches?.[group.id]} />
          ))}
        </div>
      );
    case 'bracket':
      return (
        <div className="flex flex-col items-start gap-10 p-4">
          {content.blocks.map((block, i) => (
            <BracketBoard key={i} sections={block.sections} selectedMatch={null} crop={block.crop} />
          ))}
        </div>
      );
    case 'combined':
      return (
        <div className="flex items-center gap-12">
          {content.parts.map((part, i) => (
            <ContentView key={i} content={part} />
          ))}
        </div>
      );
  }
}
