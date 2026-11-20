import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Printer } from 'lucide-react';
import {
  getCompetition,
  getFinalPlaces,
  getStage,
  getTournament,
  getTournamentProgress,
  type CompetitionId,
  type FinalPlaceView,
  type GroupView,
  type PlaceRange,
  type StageView,
  type TournamentState,
} from '@/engine';
import { TournamentStateContext, useQuery } from '@/app/useApp';
import { Button } from '@/ui/components/ui/button';
import { formatDate, entryName } from '@/ui/format';
import { useDisplayTournament } from '@/ui/display/useDisplayTournament';
import { BracketBoard } from '@/ui/play/BracketBoard';
import { layoutBracket, type LayoutSection } from '@/ui/play/bracketLayout';
import { bracketLayoutSections } from '@/ui/play/bracketSections';
import { CrossTable, Standings, Trace } from '@/ui/play/GroupTables';
import { formatPlace } from '@/ui/matchLabels';
import { planBracketPages, type PagePart } from './printPlan';
import './print.css';

/**
 * The printout of a finished tournament (#0027): every competition on its own pages, laid out for
 * A4 by print CSS and printed (or saved as a PDF) with the browser's own dialog. Read-only: it
 * loads the tournament like the display screen does and only runs queries.
 */
export function PrintScreen() {
  const { tournamentId = '' } = useParams();
  const { t } = useTranslation();
  const state = useDisplayTournament(tournamentId);
  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center p-10 text-center text-slate-600">
        <div className="grid gap-4">
          <p>{t('display.notFound')}</p>
          <Link to="/" className="text-indigo-600 underline">
            {t('tournaments.backToList')}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <TournamentStateContext.Provider value={state}>
      <Printout state={state} />
    </TournamentStateContext.Provider>
  );
}

function Printout({ state }: { state: TournamentState }) {
  const { t } = useTranslation();
  const progress = useQuery(getTournamentProgress);
  const back = `/tournaments/${state.id}/play`;

  const toolbar = (
    <div className="print-toolbar flex flex-wrap items-center gap-3 border-b bg-white px-4 py-2 print:hidden">
      <Link to={back} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden />
        {t('print.back')}
      </Link>
      <h1 className="font-semibold">{t('print.heading')}</h1>
      {progress?.finished && (
        <>
          <p className="text-muted-foreground max-w-xl text-xs">{t('print.hint')}</p>
          <Button className="ml-auto" onClick={() => window.print()}>
            <Printer />
            {t('print.print')}
          </Button>
        </>
      )}
    </div>
  );

  if (!progress?.finished) {
    const inPlay = (progress?.competitions ?? []).filter((c) => !c.finished).map((c) => c.name);
    return (
      <div className="min-h-screen bg-slate-100">
        {toolbar}
        <div className="mx-auto grid max-w-xl gap-2 p-8">
          <h2 className="text-xl font-semibold">{t('print.notFinished')}</h2>
          <p className="text-slate-600">{inPlay.length > 0 ? t('print.unavailable', { names: inPlay.join(', ') }) : t('print.noneToPrint')}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="print-root min-h-screen bg-slate-200">
      {toolbar}
      {progress.competitions.map((c) => (
        <CompetitionPrintout key={c.id} competition={c.id} />
      ))}
    </div>
  );
}

/** One competition: its final places and groups on portrait pages, then each bracket on landscape pages. */
function CompetitionPrintout({ competition: id }: { competition: CompetitionId }) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());
  const competition = useQuery((s) => getCompetition(s, id), [id]);
  const stageIds = (competition?.stages ?? []).map((s) => s.id).join();
  const stages =
    useQuery(
      (s) =>
        stageIds
          .split(',')
          .filter(Boolean)
          .map((stage) => getStage(s, stage, now))
          .filter((v): v is StageView => v !== null),
      [stageIds, now],
    ) ?? [];
  if (!competition) return null;

  const groupStages = stages.filter((s) => s.type === 'groups');
  const brackets = stages.flatMap((s) => (s.type === 'groups' ? [] : [s]));
  return (
    <>
      <article className="print-sheet print-portrait" aria-label={competition.name}>
        <PrintHeader competitionName={competition.name} large />
        <FinalPlaces competition={id} />
        {groupStages.length > 0 && (
          <section className="mt-6">
            <h3 className="print-h3">{t('print.groups')}</h3>
            {groupStages.map((stage) => (
              <Fragment key={stage.id}>
                {stage.type === 'groups' &&
                  stage.groups.map((group) => (
                    <div key={group.id} className="print-avoid-break mt-4">
                      <GroupPrintout group={group} />
                    </div>
                  ))}
              </Fragment>
            ))}
          </section>
        )}
      </article>
      {brackets.map((stage) => (
        <BracketPrintout key={stage.id} stage={stage} competitionName={competition.name} />
      ))}
    </>
  );
}

/** Tournament name, date and venue, and the competition name: on the first page of each competition. */
function PrintHeader(props: { competitionName: string; large?: boolean; caption?: string }) {
  const { i18n } = useTranslation();
  const tournament = useQuery(getTournament);
  if (!tournament) return null;
  const line = [formatDate(tournament.date, i18n.language), tournament.venue].filter(Boolean).join(' · ');
  return (
    <header className="print-header">
      {props.large ? (
        <>
          <p className="text-sm text-slate-600">
            <b>{tournament.name}</b> · {line}
          </p>
          <h2 className="text-2xl font-bold">{props.competitionName}</h2>
        </>
      ) : (
        <p className="flex items-baseline gap-2 text-sm text-slate-600">
          <b className="text-base text-slate-900">{props.competitionName}</b>
          {props.caption && <span>· {props.caption}</span>}
          <span className="ml-auto">
            {tournament.name} · {line}
          </span>
        </p>
      )}
    </header>
  );
}

interface PlaceBlock {
  place: PlaceRange;
  rows: FinalPlaceView[];
}

function FinalPlaces({ competition }: { competition: CompetitionId }) {
  const { t } = useTranslation();
  const places = useQuery((s) => getFinalPlaces(s, competition), [competition]);
  const blocks: PlaceBlock[] = [];
  for (const row of places?.rows ?? []) {
    const last = blocks.at(-1);
    if (last && last.place.from === row.place.from && last.place.to === row.place.to) last.rows.push(row);
    else blocks.push({ place: row.place, rows: [row] });
  }
  return (
    <section className="mt-4">
      <h3 className="print-h3">{t('places.heading')}</h3>
      <table className="mt-1 w-full text-sm">
        <tbody>
          {blocks.map((block) =>
            block.rows.map(({ entry }, i) => (
              <tr key={entry.id} className={i === 0 ? 'border-t border-slate-300' : undefined}>
                <td className="w-16 py-0.5 pr-2 align-top font-bold tabular-nums">{i === 0 ? formatPlace(block.place) : ''}</td>
                <td className="py-0.5 font-medium">
                  {entryName(entry)}
                  {entry.withdrawnAt !== null && <span className="ml-2 text-xs font-normal text-slate-500 italic">({t('print.withdrew')})</span>}
                </td>
                <td className="py-0.5 text-right text-xs text-slate-600">
                  {entry.players
                    .map((p) => p.club)
                    .filter(Boolean)
                    .join(' / ')}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </section>
  );
}

/** A group: its cross table, its standings, and how any ties were settled. */
function GroupPrintout({ group }: { group: GroupView }) {
  const { t } = useTranslation();
  const settled = group.ties.filter((tie) => tie.entries.length > 1 && tie.resolution !== null);
  return (
    <section className="grid gap-3">
      <h4 className="text-base font-bold">{t('groupDetail.title', { name: group.name })}</h4>
      <CrossTable group={group} print />
      <Standings group={group} />
      <Trace group={group} />
      {settled.map((tie) => (
        <p key={tie.entries.map((e) => e.id).join()} className="text-sm">
          {tie.entries.map((e) => entryName(e)).join(', ')}:{' '}
          {t('groupDetail.settled', { how: t(tie.resolution === 'lot' ? 'groupDetail.settledLot' : 'groupDetail.settledDecision') })}
        </p>
      ))}
    </section>
  );
}

/** A block of a bracket stage that prints on its own pages: the main bracket, one section, or one play-off tree. */
interface BracketBlock {
  key: string;
  title: string;
  sections: LayoutSection[];
}

/** Stand-alone sections: no offsets, mirroring or links to sections that are on other pages. */
const standAlone = (section: LayoutSection): LayoutSection => ({
  ...section,
  column: 0,
  below: undefined,
  beside: undefined,
  level: undefined,
  linkFrom: undefined,
  flow: undefined,
});

function bracketBlocks(t: ReturnType<typeof useTranslation>['t'], stage: Exclude<StageView, { type: 'groups' }>): BracketBlock[] {
  const sections = bracketLayoutSections(t, stage, 'below').filter((s) => s.rounds.length > 0);
  const own = sections.filter((s) => !s.playOff);
  const trees = new Map<string, LayoutSection[]>();
  for (const section of sections.filter((s) => s.playOff)) trees.set(section.tree!.key, [...(trees.get(section.tree!.key) ?? []), section]);

  const blocks: BracketBlock[] =
    stage.type === 'doubleElimination'
      ? own.map((s) => ({ key: s.key, title: s.title, sections: [standAlone(s)] }))
      : own.length > 0
        ? [{ key: 'main', title: own[0].title, sections: own }]
        : [];
  for (const [key, members] of trees) blocks.push({ key: `playOff-${key}`, title: t('print.playOffs'), sections: members });
  return blocks;
}

function BracketPrintout({ stage, competitionName }: { stage: Exclude<StageView, { type: 'groups' }>; competitionName: string }) {
  const { t } = useTranslation();
  return (
    <>
      {bracketBlocks(t, stage).map((block) => (
        <BracketBlockPages key={block.key} block={block} competitionName={competitionName} />
      ))}
    </>
  );
}

function partCaption(t: ReturnType<typeof useTranslation>['t'], part: PagePart): string | null {
  switch (part.kind) {
    case 'whole':
      return null;
    case 'rounds':
      return `${t('print.part.rounds', { from: part.from, to: part.to })}`;
    default:
      return t(`print.part.${part.kind}`);
  }
}

/** The landscape pages of one block: scaled to the page when readable, otherwise split and captioned. */
function BracketBlockPages({ block, competitionName }: { block: BracketBlock; competitionName: string }) {
  const { t } = useTranslation();
  const layout = layoutBracket(block.sections);
  return (
    <>
      {planBracketPages(layout).map((page, i) => {
        const part = partCaption(t, page.part);
        return (
          <article key={i} className="print-sheet print-landscape" aria-label={`${competitionName}: ${block.title}`}>
            <PrintHeader competitionName={competitionName} caption={part ? `${block.title}, ${part}` : block.title} />
            {/* Only the part of the bracket that is on this page is rendered, scaled to fit. */}
            <div className="mx-auto mt-2" style={{ width: page.w * page.scale, height: page.h * page.scale }}>
              <div className="origin-top-left" style={{ width: page.w, height: page.h, transform: `scale(${page.scale})` }}>
                <BracketBoard sections={block.sections} selectedMatch={null} print crop={page} />
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}
