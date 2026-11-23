import type { TFunction } from 'i18next';
import type { BracketStageView, CompetitionId, DisplayStageFocus, GroupId, GroupView, MatchId, MatchView, StageId, StageView } from '@/engine';
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
export const GROUP_BOX_H = 330;
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
  | { kind: 'groups'; groups: GroupView[]; columns: number; matches: Record<GroupId, MatchId[]> }
  | { kind: 'bracket'; blocks: BracketBlock[] };

export interface DisplayPage {
  /** Stable while the page keeps existing, so the cycle can stay on it. */
  key: string;
  competition: CompetitionId;
  stage: StageId;
  type: 'groups' | 'bracket';
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

function bracketPages(t: TFunction, stage: BracketStageView, focus: DisplayStageFocus, space: PageSpace): BracketBlock[][] {
  const options: PagePlanOptions = { pageW: space.w - PAGE_MARGIN, pageH: space.h - PAGE_MARGIN, minScale: space.minScale, cardW: DISPLAY_CARD_W, maxScale: MAX_SCALE };
  const blocks = blocksOf(stage, bracketLayoutSections(t, stage, 'below'))
    .map((sections) => ({ sections, layout: layoutBracket(sections, DISPLAY_CARD_W) }))
    .filter((b) => b.layout.cards.some((c) => c.match.status !== 'disabled'));
  const open = blocks.filter((b) => b.layout.cards.some((c) => isOpen(c.match)));
  // Current blocks only; a finished bracket keeps its main block so it doesn't vanish.
  const shown = open.length > 0 ? open : blocks.slice(0, 1);
  const parts = shown.flatMap((b) => {
    const sections = currentSections(b.sections, open.length === 0 || focus.finished);
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

function groupPages(stage: Extract<StageView, { type: 'groups' }>, focus: DisplayStageFocus, space: PageSpace) {
  const byId = new Map(stage.groups.map((g) => [g.id, g]));
  const groups = focus.groups.flatMap((g) => byId.get(g.group) ?? []);
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

/** All the pages of one competition, stage by stage. */
export function planCompetitionPages(
  t: TFunction,
  competition: CompetitionId,
  stages: (StageView | null)[],
  focus: DisplayStageFocus[],
  space: PageSpace,
): DisplayPage[] {
  return stages.flatMap((stage, i) => {
    const f = focus[i];
    if (!stage || !f || stage.drawState === 'notDrawn') return [];
    const contents: PageContent[] =
      stage.type === 'groups' ? groupPages(stage, f, space) : bracketPages(t, stage, f, space).map((blocks): PageContent => ({ kind: 'bracket', blocks }));
    return contents.map((content, n) => ({
      key: `${competition}:${stage.id}:${n + 1}`,
      competition,
      stage: stage.id,
      type: content.kind,
      n: n + 1,
      of: contents.length,
      content,
    }));
  });
}
