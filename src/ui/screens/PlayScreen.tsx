import type { TFunction } from 'i18next';
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
  type BracketStageView,
  type PlaceRange,
  type StageView,
} from '@/engine';
import { DrawEditor, DrawGroupBox, DrawMatchCard } from '@/ui/play/DrawEditing';
import { useApp, useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/ui/button';
import { Canvas } from '@/ui/play/Canvas';
import { useCanvas, type WorldRect } from '@/ui/play/canvasContext';
import { BracketBoard } from '@/ui/play/BracketBoard';
import type { LayoutSection } from '@/ui/play/bracketLayout';
import { GroupBox } from '@/ui/play/GroupBox';
import { GroupDetail } from '@/ui/play/GroupDetail';
import { doubleEliminationRoundTitle, formatPlace, roundTitle } from '@/ui/matchLabels';
import { MatchPopover } from '@/ui/play/MatchPopover';
import { PlacesPanel } from '@/ui/play/PlacesPanel';
import { StatsDrawer } from '@/ui/play/StatsDrawer';
import { TablesFullScreen, TablesPanel } from '@/ui/play/TablesPanel';
import { WaitingList, type WaitingListScope } from '@/ui/play/WaitingList';
import { useNow } from '@/ui/useNow';
import { usePlayOffLayout, type PlayOffLayout } from '@/ui/usePlayOffLayout';

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

  /** Shows a match on the canvas (switching competition if needed) and opens its popover. */
  const select = (match: Pick<MatchView, 'id' | 'competition'>) => {
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
        <PlacesPanel competition={competitionId} />
      </div>
      <StatsDrawer now={now} onFocus={select} />
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
  const stageIds = (competition?.stages ?? []).map((s) => s.id).join();
  const stages = useQuery((s) => stageIds.split(',').filter(Boolean).map((id) => getStage(s, id, props.now)).filter((v): v is StageView => v !== null), [stageIds, props.now]) ?? [];
  const stage = stages[0];
  // The stages after the first are fed by it; one that is drawn but not confirmed can still be edited (its feeder is being played).
  const editingLater = stages.slice(1).find((s) => s.drawState === 'drawn');
  const [detailGroup, setDetailGroup] = useState<GroupId | null>(null);
  const detailStage = stages.find((s) => s.type === 'groups' && s.groups.some((g) => g.id === detailGroup));
  const [playOffLayout, setPlayOffLayout] = usePlayOffLayout();
  if (!competition) return null;

  if (stage?.drawState === 'drawn') return <DrawEditCanvas stage={stage} later={stages.slice(1)} fitKey={competition.id} />;

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

  const content = (
    <>
      <Canvas
        className="flex-1"
        fitKey={competition.id}
        onBackgroundClick={() => props.onSelect(null)}
        tools={
          stages.some((s) => s.type === 'doubleElimination' || (s.type !== 'groups' && s.playOffs.length > 0)) && (
            <button
              type="button"
              className="h-8 rounded-lg bg-white px-3 text-xs font-semibold shadow ring-1 ring-slate-200 hover:bg-slate-100"
              title={t('play.playOffLayout.hint')}
              aria-pressed={playOffLayout === 'left'}
              onClick={() => setPlayOffLayout(playOffLayout === 'left' ? 'below' : 'left')}
            >
              {t(playOffLayout === 'left' ? 'play.playOffLayout.left' : 'play.playOffLayout.below')}
            </button>
          )
        }
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
        <div className="flex items-start gap-20 p-8">
          {stages.map((s) =>
            s.type === 'groups' ? (
              <div key={s.id} className="grid gap-6" style={{ gridTemplateColumns: `repeat(${groupColumns(s.groups.length)}, auto)` }}>
                {s.groups.map((group) =>
                  s.drawState === 'drawn' ? (
                    <DrawGroupBox key={group.id} group={group} />
                  ) : (
                    <GroupBoxOnCanvas
                      key={group.id}
                      group={group}
                      selection={props.selection}
                      onSelect={props.onSelect}
                      pendingFocus={props.pendingFocus}
                      onFocused={props.onFocused}
                      onOpenDetail={() => setDetailGroup(group.id)}
                    />
                  ),
                )}
              </div>
            ) : (
              <div key={s.id}>
                <BracketOnCanvas
                  stage={s}
                  editing={s.drawState === 'drawn'}
                  selection={props.selection}
                  onSelect={props.onSelect}
                  pendingFocus={props.pendingFocus}
                  onFocused={props.onFocused}
                />
              </div>
            ),
          )}
        </div>
      </Canvas>
      {detailStage?.type === 'groups' && (
        <GroupDetail stage={detailStage.id} group={detailStage.groups.find((g) => g.id === detailGroup) ?? null} onClose={() => setDetailGroup(null)} />
      )}
    </>
  );
  return editingLater ? (
    <DrawEditor stage={editingLater.id} bracket={editingLater.type !== 'groups'}>
      {content}
    </DrawEditor>
  ) : (
    content
  );
}

/**
 * The canvas while the first stage's draw is drawn but not confirmed: drag-and-drop editing, re-draw
 * and confirm. The stages after it (fed by its advancers) are shown as origin-label placeholders.
 */
function DrawEditCanvas({ stage, later, fitKey }: { stage: StageView; later: StageView[]; fitKey: string }) {
  const { t } = useTranslation();
  const [playOffLayout] = usePlayOffLayout();
  const bracket = stage.type !== 'groups';
  return (
    <DrawEditor stage={stage.id} bracket={bracket}>
      <Canvas className="flex-1" fitKey={`${fitKey}:edit`} hint={t('drawEdit.canvasHint')}>
        <div className="flex items-start gap-20 p-8">
          {stage.type === 'groups' ? (
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${groupColumns(stage.groups.length)}, auto)` }}>
              {stage.groups.map((group) => (
                <DrawGroupBox key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <BracketBoard
              sections={bracketLayoutSections(t, stage, playOffLayout)}
              selectedMatch={null}
              onSelectMatch={() => {}}
              renderCard={(match) =>
                match.location.kind === 'bracket' && (match.location.section === 'main' || match.location.section === 'winners') && match.round === 1 ? <DrawMatchCard match={match} /> : null
              }
            />
          )}
          {later.map((s) =>
            s.type === 'groups' ? (
              <div key={s.id} className="grid gap-6" style={{ gridTemplateColumns: `repeat(${groupColumns(s.groups.length)}, auto)` }}>
                {s.groups.map((group) => (
                  <GroupBox key={group.id} group={group} selectedMatch={null} onSelectMatch={() => {}} onOpenDetail={() => {}} />
                ))}
              </div>
            ) : (
              <BracketBoard key={s.id} sections={bracketLayoutSections(t, s, playOffLayout)} selectedMatch={null} onSelectMatch={() => {}} />
            ),
          )}
        </div>
      </Canvas>
    </DrawEditor>
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

/** A bracket stage: single elimination (main tree, 3rd-place match under the final) or double elimination (winners bracket, losers bracket, 2nd final). */
function BracketOnCanvas(props: {
  stage: BracketStageView;
  /** The bracket's draw is not confirmed yet (its groups are being played): round 1 is edited by drag and drop. */
  editing?: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  pendingFocus: MatchId | null;
  onFocused: () => void;
}) {
  const { t } = useTranslation();
  const { stage } = props;
  const canvas = useFocusPending(props, stage.sections.flatMap((s) => s.rounds.flatMap((r) => r.matches.map((m) => m.id))).join());

  const [playOffLayout] = usePlayOffLayout();
  const sections = bracketLayoutSections(t, stage, playOffLayout);
  const dispatch = useApp((s) => s.dispatch);

  return (
    <BracketBoard
      sections={sections}
      selectedMatch={props.selection?.match ?? null}
      onSelectMatch={(match, el) => props.onSelect({ match, rect: canvas.worldRectOf(el) })}
      renderCard={
        props.editing
          ? (match) =>
              match.location.kind === 'bracket' && (match.location.section === 'main' || match.location.section === 'winners') && match.round === 1 ? (
                <DrawMatchCard match={match} />
              ) : null
          : undefined
      }
      onTogglePlayOff={(range, enabled) => dispatch({ type: 'setPlayOff', stage: stage.id, range, enabled, at: Date.now() })}
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

/** The labelled sections of a bracket stage, as the layout wants them. */
function bracketLayoutSections(t: TFunction, stage: BracketStageView, layout: PlayOffLayout): LayoutSection[] {
  return [...bracketMainSections(t, stage, layout), ...playOffSections(t, stage, layout)];
}

/**
 * One block per place play-off the stage can have: its matches once created, otherwise just the
 * title and switch. A play-off and the play-offs of its halves form a tree: the winners' half to
 * the right, the losers' half to the left (or under the winners' with the `below` layout); deeper
 * halves keep to their side.
 */
function playOffSections(t: TFunction, stage: BracketStageView, layout: PlayOffLayout): LayoutSection[] {
  const keyOf = (r: PlaceRange) => `playOff-${r.from}-${r.to}`;
  type Side = 'top' | 'left' | 'right';
  const placed = new Map<string, { tree: string; column: number; side: Side }>();
  return stage.playOffs.map((playOff) => {
    const key = keyOf(playOff.range);
    const parent = playOff.parent ? placed.get(keyOf(playOff.parent)) : undefined;
    const winnersHalf = playOff.parent?.from === playOff.range.from;
    const side: Side = !parent ? 'top' : parent.side !== 'top' ? parent.side : layout === 'left' && !winnersHalf ? 'left' : 'right';
    const at = { tree: parent?.tree ?? key, column: parent ? parent.column + (side === 'left' ? -1 : 1) : 0, side };
    placed.set(key, at);

    const range = formatPlace(playOff.range);
    const created = stage.sections.find((s) => s.playOff?.from === playOff.range.from && s.playOff.to === playOff.range.to);
    const { from, to } = playOff.range;
    const half = (to - from + 1) / 2;
    const halves = { winners: formatPlace({ from, to: from + half - 1 }), losers: formatPlace({ from: from + half, to }) };
    return {
      key,
      title: t('bracket.sections.playOff', { range }),
      subtitle: playOff.enabled
        ? t(half === 1 ? 'bracket.sectionHints.playOffOnPair' : 'bracket.sectionHints.playOffOn', halves)
        : t('bracket.sectionHints.playOffOff', { range }),
      rounds: created?.rounds.map((r) => r.matches) ?? [],
      playOff,
      tree: { key: at.tree, column: at.column, parent: playOff.parent ? keyOf(playOff.parent) : undefined },
    };
  });
}

/**
 * The format's own sections (not the play-offs). In double elimination the `left` layout mirrors
 * the losers bracket: it runs leftwards from beside the winners bracket, the 2nd final left of its final.
 */
function bracketMainSections(t: TFunction, stage: BracketStageView, layout: PlayOffLayout): LayoutSection[] {
  const sections = stage.sections.filter((s) => s.section !== 'playOff');
  if (stage.type === 'doubleElimination') {
    const losers = stage.sections.find((x) => x.section === 'losers');
    const losersRounds = losers?.rounds.length ?? 0;
    const mirrored = layout === 'left' && losersRounds > 0;
    return sections.map((section): LayoutSection => {
      const base = { key: section.section, rounds: section.rounds.map((r) => r.matches) };
      switch (section.section) {
        case 'winners':
          return {
            ...base,
            title: t('bracket.sections.winners'),
            subtitle: t('bracket.size', { size: stage.size }),
            roundTitles: section.rounds.map((r) => doubleEliminationRoundTitle(t, 'winners', r.round, section.rounds.length)),
          };
        case 'losers':
          return {
            ...base,
            title: t('bracket.sections.losers'),
            subtitle: t('bracket.sectionHints.losers'),
            roundTitles: section.rounds.map((r) => doubleEliminationRoundTitle(t, 'losers', r.round, section.rounds.length)),
            ...(mirrored ? { column: -1, flow: 'left' as const, beside: 'winners', linkFrom: 'winners' } : {}),
          };
        default:
          return {
            ...base,
            title: t('bracket.sections.secondFinal'),
            subtitle: t('bracket.sectionHints.secondFinal'),
            ...(mirrored
              ? { column: -losersRounds - 1, level: losers?.rounds.at(-1)?.matches[0]?.id }
              : { column: Math.max(0, losersRounds - 1) }),
          };
      }
    });
  }
  const main = stage.sections.find((s) => s.section === 'main');
  const final = main?.rounds.at(-1)?.matches[0];
  return sections.map((section) =>
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

}
