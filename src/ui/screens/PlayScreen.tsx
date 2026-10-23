import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  getCompetition,
  getCompetitions,
  getMatch,
  getMatchCounts,
  getOverdueMatches,
  getStage,
  getTableOverview,
  type GroupId,
  type MatchCountsView,
  type MatchId,
  type MatchView,
  type SingleEliminationStageView,
} from '@/engine';
import { useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/ui/button';
import { Canvas } from '@/ui/play/Canvas';
import { useCanvas, type WorldRect } from '@/ui/play/canvasContext';
import { BracketBoard } from '@/ui/play/BracketBoard';
import type { LayoutSection } from '@/ui/play/bracketLayout';
import { GroupBox } from '@/ui/play/GroupBox';
import { GroupDetail } from '@/ui/play/GroupDetail';
import { roundTitle } from '@/ui/matchLabels';
import { MatchPopover } from '@/ui/play/MatchPopover';
import { TablesFullScreen, TablesPanel } from '@/ui/play/TablesPanel';
import { WaitingList, type WaitingListScope } from '@/ui/play/WaitingList';
import { useNow } from '@/ui/useNow';

const POPOVER_WIDTH = 350;

interface Selection {
  match: MatchId;
  /** The card's place in world coordinates, so the popover follows pan and zoom. */
  rect: WorldRect;
}

/** The main screen: a pan/zoom canvas of one competition, the tables on the left and the waiting list on the right. */
export function PlayScreen() {
  const { t } = useTranslation();
  const { tournamentId, competitionId } = useParams();
  const base = `/tournaments/${tournamentId}`;
  const competitions = useQuery(getCompetitions) ?? [];
  const now = useNow();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [pendingFocus, setPendingFocus] = useState<MatchId | null>(null);
  const [scope, setScope] = useState<WaitingListScope>('all');
  const counts = useQuery((s) => getMatchCounts(s, now), [now]) ?? [];
  const navigate = useNavigate();
  const selected = useQuery((s) => (selection ? getMatch(s, selection.match, now) : null), [selection, now]);
  const tableOverview = useQuery((s) => getTableOverview(s, now), [now]);
  const overdue = useQuery((s) => getOverdueMatches(s, now), [now]) ?? [];
  const [tablesFull, setTablesFull] = useState(false);
  const [alarmIndex, setAlarmIndex] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSelection(null);
      setTablesFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (competitions.length === 0) {
    return (
      <div className="grid place-items-center gap-3 p-10 text-center">
        <p className="text-muted-foreground">{t('play.noCompetitions')}</p>
        <Button asChild>
          <Link to={`${base}/competitions`}>{t('play.setUpCompetition')}</Link>
        </Button>
      </div>
    );
  }
  if (!competitionId || !competitions.some((c) => c.id === competitionId)) {
    return <Navigate to={`${base}/play/${competitions[0].id}`} replace />;
  }

  const select = (match: MatchView) => {
    if (match.competition !== competitionId) {
      setSelection(null);
      navigate(`${base}/play/${match.competition}`);
    }
    setPendingFocus(match.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex gap-0.5 border-b bg-white px-2">
        {competitions.map((c) => (
          <NavLink
            key={c.id}
            to={`${base}/play/${c.id}`}
            onClick={() => setSelection(null)}
            className={({ isActive }) =>
              cn(
                '-mb-px flex items-center gap-2 border-b-[3px] px-4 py-2 text-sm font-semibold',
                isActive ? 'border-indigo-600 bg-slate-50' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800',
              )
            }
          >
            <span>{c.name}</span>
            <TabCounts counts={counts.find((x) => x.competition === c.id)} />
          </NavLink>
        ))}
        <div className="ml-auto flex items-center gap-2 py-1">
          {overdue.length > 0 && (
            <button
              type="button"
              title={t('alarm.overdueTitle')}
              onClick={() => {
                select(overdue[alarmIndex % overdue.length]);
                setAlarmIndex(alarmIndex + 1);
              }}
              className="overdue-alarm rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
            >
              ⚠ {t('alarm.overdue', { count: overdue.length })}
            </button>
          )}
          {(tableOverview?.idleCount ?? 0) > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {t('alarm.idle', { count: tableOverview?.idleCount })}
            </span>
          )}
        </div>
      </nav>
      <div className="flex min-h-0 flex-1">
        {tableOverview && <TablesPanel overview={tableOverview} onFocus={select} onFullScreen={() => setTablesFull(true)} />}
        <div className="relative flex min-w-0 flex-1">
          <CompetitionCanvas
            competitionId={competitionId}
            now={now}
            selection={selection}
            selected={selected?.competition === competitionId ? selected : null}
            onSelect={setSelection}
            pendingFocus={pendingFocus}
            onFocused={() => setPendingFocus(null)}
          />
          {tablesFull && tableOverview && (
            <TablesFullScreen overview={tableOverview} onFocus={select} onClose={() => setTablesFull(false)} />
          )}
        </div>
        <WaitingList
          now={now}
          competition={competitionId}
          scope={scope}
          onScopeChange={setScope}
          selectedMatch={selection?.match ?? null}
          onSelect={select}
        />
      </div>
    </div>
  );
}

/** A competition tab's badges: ready, live and overdue matches. */
function TabCounts({ counts }: { counts: MatchCountsView | undefined }) {
  const { t } = useTranslation();
  if (!counts) return null;
  const badge = 'rounded px-1.5 text-[10px] font-bold';
  return (
    <>
      {counts.ready > 0 && <span className={cn(badge, 'bg-indigo-600 text-white')}>{t('play.tabReady', { count: counts.ready })}</span>}
      {counts.live > 0 && <span className={cn(badge, 'bg-sky-100 text-sky-700')}>{t('play.tabLive', { count: counts.live })}</span>}
      {counts.overdue > 0 && <span className={cn(badge, 'bg-red-600 text-white')}>{t('play.tabOverdue', { count: counts.overdue })}</span>}
    </>
  );
}

function CompetitionCanvas(props: {
  competitionId: string;
  now: number;
  selection: Selection | null;
  selected: MatchView | null;
  onSelect: (selection: Selection | null) => void;
  pendingFocus: MatchId | null;
  onFocused: () => void;
}) {
  const { t } = useTranslation();
  const competition = useQuery((s) => getCompetition(s, props.competitionId), [props.competitionId]);
  const stageId = competition?.stages[0]?.id;
  const stage = useQuery((s) => (stageId ? getStage(s, stageId, props.now) : null), [stageId, props.now]);
  const [detailGroup, setDetailGroup] = useState<GroupId | null>(null);
  if (!competition) return null;

  if (!stage || stage.drawState !== 'confirmed') {
    return (
      <div className="grid flex-1 place-items-center gap-3 bg-slate-100 p-10 text-center">
        <div className="grid gap-3">
          <p className="text-muted-foreground">{t('play.notConfirmed', { name: competition.name })}</p>
          <Button asChild>
            <Link to={`../../competitions/${competition.id}`} relative="path">
              {t('play.goToDraw')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Canvas
        className="flex-1"
        fitKey={competition.id}
        onBackgroundClick={() => props.onSelect(null)}
        overlay={(view) => {
          if (!props.selection || !props.selected) return null;
          const { rect } = props.selection;
          const left = view.x + (rect.x + rect.w) * view.k + 10;
          const top = Math.max(8, view.y + rect.y * view.k - 10);
          return (
            <MatchPopover
              key={props.selected.id}
              match={props.selected}
              style={{
                left,
                top,
                width: POPOVER_WIDTH - 10,
                maxHeight: `calc(100% - ${top + 8}px)`,
              }}
              onClose={() => props.onSelect(null)}
            />
          );
        }}
      >
        {stage.type === 'groups' ? (
          <div className="grid gap-6 p-8" style={{ gridTemplateColumns: `repeat(${groupColumns(stage.groups.length)}, auto)` }}>
            {stage.groups.map((group) => (
              <GroupBoxOnCanvas
                key={group.id}
                group={group}
                selection={props.selection}
                onSelect={props.onSelect}
                pendingFocus={props.pendingFocus}
                onFocused={props.onFocused}
                onOpenDetail={() => setDetailGroup(group.id)}
              />
            ))}
          </div>
        ) : (
          <div className="p-8">
            <BracketOnCanvas
              stage={stage}
              selection={props.selection}
              onSelect={props.onSelect}
              pendingFocus={props.pendingFocus}
              onFocused={props.onFocused}
            />
          </div>
        )}
      </Canvas>
      {stage.type === 'groups' && (
        <GroupDetail stage={stage.id} group={stage.groups.find((g) => g.id === detailGroup) ?? null} onClose={() => setDetailGroup(null)} />
      )}
    </>
  );
}

/** Groups in a roughly square grid. */
const groupColumns = (count: number) => Math.min(count, Math.max(1, Math.ceil(Math.sqrt(count))));

/** Opens the popover for a match picked elsewhere (the waiting list) once its card is on the canvas. */
function useFocusPending(
  props: { pendingFocus: MatchId | null; onFocused: () => void; onSelect: (selection: Selection | null) => void },
  /** The ids of the matches drawn by the caller, comma-separated (a stable effect dependency). */
  matchIds: string,
) {
  const canvas = useCanvas();
  const { pendingFocus, onFocused, onSelect } = props;
  useEffect(() => {
    if (!pendingFocus || !matchIds.split(',').includes(pendingFocus)) return;
    const el = document.querySelector(`[data-match-id="${pendingFocus}"]`);
    if (!el) return;
    const rect = canvas.worldRectOf(el);
    canvas.reveal(rect);
    onSelect({ match: pendingFocus, rect });
    onFocused();
  }, [pendingFocus, matchIds, canvas, onSelect, onFocused]);
  return canvas;
}

/** A single elimination bracket: the main tree, and the 3rd-place match under the final. */
function BracketOnCanvas(props: {
  stage: SingleEliminationStageView;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  pendingFocus: MatchId | null;
  onFocused: () => void;
}) {
  const { t } = useTranslation();
  const { stage } = props;
  const canvas = useFocusPending(props, stage.sections.flatMap((s) => s.rounds.flatMap((r) => r.matches.map((m) => m.id))).join());

  const main = stage.sections.find((s) => s.section === 'main');
  const final = main?.rounds.at(-1)?.matches[0];
  const sections: LayoutSection[] = stage.sections.map((section) =>
    section.section === 'main'
      ? {
          key: section.section,
          title: t('bracket.sections.main'),
          subtitle: t('bracket.size', { size: stage.size }),
          rounds: section.rounds.map((r) => r.matches),
          roundTitles: section.rounds.map((r) => roundTitle(t, r.matches.length)),
        }
      : {
          key: section.section,
          title: t('bracket.sections.thirdPlace'),
          rounds: section.rounds.map((r) => r.matches),
          column: (main?.rounds.length ?? 1) - 1,
          below: final?.id,
        },
  );

  return (
    <BracketBoard
      sections={sections}
      selectedMatch={props.selection?.match ?? null}
      onSelectMatch={(match, el) => props.onSelect({ match, rect: canvas.worldRectOf(el) })}
    />
  );
}

/** A group box that knows how to place the popover next to a clicked card, or a card picked elsewhere. */
function GroupBoxOnCanvas(props: {
  group: Parameters<typeof GroupBox>[0]['group'];
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  pendingFocus: MatchId | null;
  onFocused: () => void;
  onOpenDetail: () => void;
}) {
  const canvas = useCanvas();
  const { pendingFocus, onFocused, onSelect, group } = props;

  useEffect(() => {
    if (!pendingFocus || !group.matches.some((m) => m.id === pendingFocus)) return;
    const el = document.querySelector(`[data-match-id="${pendingFocus}"]`);
    if (!el) return;
    const rect = canvas.worldRectOf(el);
    canvas.reveal(rect);
    onSelect({ match: pendingFocus, rect });
    onFocused();
  }, [pendingFocus, group, canvas, onSelect, onFocused]);

  return (
    <GroupBox
      group={group}
      selectedMatch={props.selection?.match ?? null}
      onSelectMatch={(match, el) => onSelect({ match, rect: canvas.worldRectOf(el) })}
      onOpenDetail={props.onOpenDetail}
    />
  );
}
