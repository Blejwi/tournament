import type { TFunction } from 'i18next';
import type { BracketStageView, CompetitionId, DisplayStageFocus, EntryView, FinalPlacesView, GroupId, GroupView, MatchId, MatchView, StageId, StageView } from '@/engine';
import { bracketLayoutSections } from '@/ui/play/bracketSections';
import { DISPLAY_CARD_W, layoutBracket, type LayoutSection } from '@/ui/play/bracketLayout';
import { planBracketPages, type PagePlanOptions } from '@/ui/print/printPlan';

/**
 * Pages of the second screen (#0030): a competition's current groups and bracket, cut into pages that
 * can each be drawn at a readable scale (never below `DISPLAY_MIN_SCALE`) instead of shrunk to fit.
 * Pure geometry, no DOM: the size of the content area comes in as an argument.
 */

/** Card text is 15 px on the display; at this scale it is about 20 px on a 1920×1080 screen. */
export const DISPLAY_MIN_SCALE = 1.3;
/** FitToScreen never scales content up beyond this. */
export const MAX_SCALE = 2;
/** Room FitToScreen keeps free around the content (its margin and the padding around a page). */
export const PAGE_MARGIN = 56;
/** A group box on the display: its width, and about how tall it is (standings and two matches). */
export const GROUP_BOX_W = 388;
export const GROUP_BOX_H = 290;
const GROUP_GAP = 24;
/** Space between two blocks on one page. */
export const BLOCK_GAP = 40;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A part of a bracket on a page: the sections to lay out and the rectangle of that layout to draw. */
export interface BracketBlock {
  sections: LayoutSection[];
  crop: Rect;
}

export type PageContent =
  /** `matches` limits a box to those matches (the one in play and the next); without it a box shows them all. */
  | { kind: 'groups'; groups: GroupView[]; columns: number; matches?: Record<GroupId, MatchId[]> }
  | { kind: 'bracket'; blocks: BracketBlock[] }
  /** A whole competition on one page (page splitting is off): its parts in columns, side by side. */
  | { kind: 'columns'; columns: PageContent[][] }
  /** The final places decided so far, and how many entries are still to land in each place. */
  | { kind: 'places'; places: FinalPlacesView; entries: EntryView[] };

export interface DisplayPage {
  /** Stable while the page keeps existing, so the cycle can stay on it. */
  key: string;
  competition: CompetitionId;
  stage: StageId;
  type: PageContent['kind'];
  /** What the page is called in the header and the tabs. */
  label: 'groups' | 'bracket' | 'all' | 'places';
  /** This page among the stage's pages (1-based). */
  n: number;
  of: number;
  content: PageContent;
}

/** The space for page content, in pixels, and the smallest scale a page may be drawn at. */
export interface PageSpace {
  w: number;
  h: number;
  minScale: number;
}

const isOpen = (m: MatchView) => !m.result && !m.decidedByBye && m.status !== 'disabled';

/** A bracket's sections cut into blocks that are planned apart: each play-off tree, and each part of a double elimination. */
function blocksOf(stage: BracketStageView, sections: LayoutSection[]): LayoutSection[][] {
  const trees = new Map<string, LayoutSection[]>();
  const plain: LayoutSection[] = [];
  for (const s of sections) {
    if (s.tree) trees.set(s.tree.key, [...(trees.get(s.tree.key) ?? []), s]);
    else plain.push(s);
  }
  return [...(stage.type === 'doubleElimination' ? plain.map((s) => [s]) : plain.length ? [plain] : []), ...trees.values()];
}

/**
 * The current part of a block: its leading rounds are left out while they are all finished and a later
 * round still has an open match; a block that is all finished keeps its last two rounds. The rest is
 * laid out again, so the first round that is left stacks compactly instead of keeping the spacing of
 * the rounds that were dropped.
 */
function currentSections(sections: LayoutSection[], finished: boolean): LayoutSection[] {
  let dropped = 0;
  const cut = sections.map((s) => {
    if (s.tree || s.rounds.length < 2) return s;
    const from = finished ? s.rounds.length - 2 : Math.max(0, s.rounds.findIndex((r) => r.some(isOpen)));
    if (from <= 0) return s;
    if (s.key === 'main') dropped = from;
    return { ...s, rounds: s.rounds.slice(from), roundTitles: s.roundTitles?.slice(from) };
  });
  // A section hung under the main one (the 3rd place match) sits in the column of the final.
  return cut.map((s) => (s.below && s.column !== undefined ? { ...s, column: Math.max(0, s.column - dropped) } : s));
}

function bracketPages(t: TFunction, stage: BracketStageView, focus: DisplayStageFocus, space: PageSpace, hideFinished: boolean): BracketBlock[][] {
  const options: PagePlanOptions = { pageW: space.w - PAGE_MARGIN, pageH: space.h - PAGE_MARGIN, minScale: space.minScale, cardW: DISPLAY_CARD_W, maxScale: MAX_SCALE };
  const blocks = blocksOf(stage, bracketLayoutSections(t, stage, 'below'))
    .map((sections) => ({ sections, layout: layoutBracket(sections, DISPLAY_CARD_W) }))
    .filter((b) => b.layout.cards.some((c) => c.match.status !== 'disabled'));
  const open = blocks.filter((b) => b.layout.cards.some((c) => isOpen(c.match)));
  // Hiding what is finished: current blocks only, a finished bracket keeps its main block so it doesn't vanish.
  const shown = !hideFinished ? blocks : open.length > 0 ? open : blocks.slice(0, 1);
  const parts = shown.flatMap((b) => {
    const sections = hideFinished ? currentSections(b.sections, open.length === 0 || focus.finished) : b.sections;
    return planBracketPages(layoutBracket(sections, DISPLAY_CARD_W), options).map((p) => ({ sections, crop: { x: p.x, y: p.y, w: p.w, h: p.h } }));
  });
  // Parts that fit one above the other share a page (a small block after the last page of a long one).
  const pages: { parts: typeof parts }[] = [];
  for (const part of parts) {
    const last = pages.at(-1);
    if (last) {
      const w = Math.max(...last.parts.map((p) => p.crop.w), part.crop.w);
      const h = last.parts.reduce((sum, p) => sum + p.crop.h + BLOCK_GAP, 0) + part.crop.h;
      if (Math.min(MAX_SCALE, options.pageW / w, options.pageH / h) >= space.minScale) {
        last.parts.push(part);
        continue;
      }
    }
    pages.push({ parts: [part] });
  }
  return pages.map((p) => p.parts.map(({ sections, crop }) => ({ sections, crop })));
}

function groupPages(stage: Extract<StageView, { type: 'groups' }>, focus: DisplayStageFocus, space: PageSpace, hideFinished: boolean) {
  const byId = new Map(stage.groups.map((g) => [g.id, g]));
  // The focus has left out the finished groups once the next stage has started; they are only dropped on request.
  const groups = hideFinished ? focus.groups.flatMap((g) => byId.get(g.group) ?? []) : stage.groups;
  const matches = Object.fromEntries(focus.groups.map((g) => [g.group, g.matches]));
  const columns = Math.max(1, Math.floor((( space.w - PAGE_MARGIN) / space.minScale + GROUP_GAP) / (GROUP_BOX_W + GROUP_GAP)));
  const rows = Math.max(1, Math.floor(((space.h - PAGE_MARGIN) / space.minScale + GROUP_GAP) / (GROUP_BOX_H + GROUP_GAP)));
  const pageCount = Math.ceil(groups.length / (columns * rows));
  const per = Math.ceil(groups.length / Math.max(1, pageCount));
  return Array.from({ length: pageCount }, (_, i): PageContent => {
    const chunk = groups.slice(i * per, (i + 1) * per);
    return { kind: 'groups', groups: chunk, columns: Math.min(columns, Math.ceil(chunk.length / rows)), matches };
  });
}

/** A piece of a whole competition, with its size in layout pixels (padding included). */
interface Item {
  content: PageContent;
  w: number;
  h: number;
}
const ITEM_PAD = 32;
const COLUMN_GAP = 48;

/** A competition in full as pieces: all the groups with all their matches, the main bracket, each play-off tree. */
function wholeItems(t: TFunction, stages: (StageView | null)[]): Item[] {
  return stages.flatMap((stage): Item[] => {
    if (!stage || stage.drawState === 'notDrawn') return [];
    if (stage.type === 'groups') {
      const n = stage.groups.length;
      if (n === 0) return [];
      const columns = Math.max(1, Math.ceil(Math.sqrt(n)));
      const rows = Math.ceil(n / columns);
      const tallest = Math.max(...stage.groups.map((g) => 28 + (g.standings.length + 1) * 26 + Math.ceil(g.matches.length / 2) * 72 + 36));
      return [
        {
          content: { kind: 'groups', groups: stage.groups, columns },
          w: columns * GROUP_BOX_W + (columns - 1) * GROUP_GAP + ITEM_PAD,
          h: rows * tallest + (rows - 1) * GROUP_GAP + ITEM_PAD,
        },
      ];
    }
    return blocksOf(stage, bracketLayoutSections(t, stage, 'below')).flatMap((sections): Item[] => {
      const layout = layoutBracket(sections, DISPLAY_CARD_W);
      // A play-off that was never switched on is just a title and a switch: nothing to show.
      if (!layout.cards.some((c) => c.match.status !== 'disabled')) return [];
      return [{ content: { kind: 'bracket', blocks: [{ sections, crop: { x: 0, y: 0, w: layout.width, h: layout.height } }] }, w: layout.width + ITEM_PAD, h: layout.height + ITEM_PAD }];
    });
  });
}

/**
 * Places the pieces in 1 to 4 columns (each next piece goes under the shortest column) and keeps the
 * number of columns that lets the whole be drawn largest in the space, so a wide screen is used on its sides.
 */
function arrange(items: Item[], space: PageSpace): PageContent | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0].content;
  let best: { scale: number; columns: Item[][] } | null = null;
  for (let count = 1; count <= Math.min(items.length, 4); count++) {
    const columns: Item[][] = Array.from({ length: count }, () => []);
    const heights = Array.from({ length: count }, () => 0);
    for (const item of items) {
      const k = heights.indexOf(Math.min(...heights));
      columns[k].push(item);
      heights[k] += item.h + BLOCK_GAP;
    }
    const used = columns.filter((c) => c.length > 0);
    const w = used.reduce((sum, c) => sum + Math.max(...c.map((i) => i.w)), 0) + (used.length - 1) * COLUMN_GAP;
    const h = Math.max(...used.map((c) => c.reduce((sum, i) => sum + i.h, 0) + (c.length - 1) * BLOCK_GAP));
    const scale = Math.min(MAX_SCALE, (space.w - 24) / w, (space.h - 24) / h);
    if (!best || scale > best.scale + 0.01) best = { scale, columns: used };
  }
  return { kind: 'columns', columns: best!.columns.map((c) => c.map((i) => i.content)) };
}

/**
 * All the pages of one competition, stage by stage. With `split` off the whole competition is one page,
 * fitted to the screen at whatever scale that gives.
 */
export function planCompetitionPages(
  t: TFunction,
  competition: CompetitionId,
  stages: (StageView | null)[],
  focus: DisplayStageFocus[],
  space: PageSpace,
  places: FinalPlacesView | null,
  entries: EntryView[],
  split = true,
  /** Leave out what is finished: groups once the next stage has started, early bracket rounds, finished blocks. */
  hideFinished = false,
): DisplayPage[] {
  // Last page of every competition: its final places, once any place is decided.
  const placesPage: DisplayPage[] =
    places && places.rows.length > 0
      ? [{ key: `${competition}:places`, competition, stage: stages.filter((s) => s).at(-1)?.id ?? competition, type: 'places', label: 'places', n: 1, of: 1, content: { kind: 'places', places, entries } }]
      : [];
  if (!split) {
    const content = arrange(wholeItems(t, stages), space);
    if (!content) return placesPage;
    return [{ key: `${competition}:all`, competition, stage: stages.find((s) => s)?.id ?? competition, type: content.kind, label: 'all', n: 1, of: 1, content }, ...placesPage];
  }
  const stagePages = stages.flatMap((stage, i) => {
    const f = focus[i];
    if (!stage || !f || stage.drawState === 'notDrawn') return [];
    const contents: PageContent[] =
      stage.type === 'groups' ? groupPages(stage, f, space, hideFinished) : bracketPages(t, stage, f, space, hideFinished).map((blocks): PageContent => ({ kind: 'bracket', blocks }));
    return contents.map((content, n) => ({
      key: `${competition}:${stage.id}:${n + 1}`,
      competition,
      stage: stage.id,
      type: content.kind,
      label: stage.type === 'groups' ? ('groups' as const) : ('bracket' as const),
      n: n + 1,
      of: contents.length,
      content,
    }));
  });
  return [...stagePages, ...placesPage];
}
