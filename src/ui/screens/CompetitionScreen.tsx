import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, LogOut, Pencil, Shuffle, UserMinus, UserPlus } from 'lucide-react';
import {
  getCompetition,
  getPlayers,
  getStage,
  type CompetitionView,
  type EngineError,
  type EntryView,
  type PlayerView,
  type Grouping,
  type StageConfig,
  type StageSummaryView,
  type StageType,
} from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { Button } from '@/ui/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { PlayerDialog } from '@/ui/components/PlayerDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/ui/card';
import { Input } from '@/ui/components/ui/input';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { FormError } from '@/ui/components/FormField';
import { entryName, newRandomSeed } from '@/ui/format';
import { slotText } from '@/ui/matchLabels';

/** Setting up one competition: entries and seeds, the groups format, and the draw. */
export function CompetitionScreen() {
  const { t } = useTranslation();
  const { competitionId = '' } = useParams();
  const competition = useQuery((s) => getCompetition(s, competitionId), [competitionId]);
  if (!competition) return null;
  const stage = competition.stages[0] ?? null;
  const locked = stage?.drawState === 'confirmed';

  return (
    <section className="grid gap-6">
      <div className="grid gap-1">
        <Link to=".." relative="path" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" aria-hidden />
          {t('competition.backToList')}
        </Link>
        <h2 className="text-xl font-semibold">{competition.name}</h2>
        <p className="text-muted-foreground text-sm">{t('competitions.gamesToWinOption', { count: competition.gamesToWin, best: 2 * competition.gamesToWin - 1 })}</p>
      </div>
      {locked && <p className="bg-muted rounded-md p-3 text-sm">{t('competition.locked')}</p>}
      <EntriesCard competition={competition} locked={locked} />
      <FormatCard competition={competition} stage={stage} locked={locked} />
      {stage && <DrawCard competition={competition} stage={stage} />}
    </section>
  );
}

function EntriesCard({ competition, locked }: { competition: CompetitionView; locked: boolean }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const players = useQuery(getPlayers) ?? [];
  const [error, setError] = useState<EngineError | null>(null);
  const [dialog, setDialog] = useState<'add' | 'existing' | PlayerView | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('competition.entriesHeading', { count: competition.entries.length })}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={locked} onClick={() => setDialog('add')}>
            <UserPlus />
            {t('players.add')}
          </Button>
          <Button variant="outline" size="sm" disabled={locked} onClick={() => setDialog('existing')}>
            {t('competition.addExisting')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-muted-foreground text-sm">{t(competition.stages[0]?.type !== 'groups' ? 'competition.seedHintBracket' : 'competition.seedHint')}</p>
        {competition.entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('competition.noEntries')}</p>
        ) : (
          <ul className="grid gap-1">
            {competition.entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2">
                <SeedInput key={`${entry.id}:${entry.seed}`} competition={competition.id} entry={entry} disabled={locked} onError={setError} />
                <span className="min-w-0 flex-1 truncate">
                  {entryName(entry)}
                  {entry.players[0]?.club && <span className="text-muted-foreground text-xs"> · {entry.players[0].club}</span>}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.edit')}
                  title={t('common.edit')}
                  onClick={() => {
                    const player = players.find((p) => p.id === entry.players[0]?.id);
                    if (player) setDialog(player);
                  }}
                >
                  <Pencil />
                </Button>
                {entry.withdrawnAt !== null ? (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">{t('competition.withdrawn')}</span>
                ) : locked ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm" className="text-red-600">
                        <LogOut />
                        {t('competition.withdraw')}
                      </Button>
                    }
                    title={t('competition.withdrawTitle', { name: entryName(entry) })}
                    description={t('competition.withdrawBody')}
                    confirmLabel={t('competition.withdraw')}
                    onConfirm={() => setError(dispatch({ type: 'withdrawPlayer', competition: competition.id, entry: entry.id, at: Date.now() }))}
                  />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('competition.removeEntry')}
                    title={t('competition.removeEntry')}
                    onClick={() => setError(dispatch({ type: 'removeEntry', competition: competition.id, entry: entry.id }))}
                  >
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <FormError message={error && errorMessage(t, error)} />
      </CardContent>
      {dialog === 'existing' && <ExistingPlayerDialog competition={competition} onClose={() => setDialog(null)} />}
      {dialog !== null && dialog !== 'existing' && (
        <PlayerDialog competition={competition.id} player={dialog === 'add' ? null : dialog} onClose={() => setDialog(null)} />
      )}
    </Card>
  );
}

/** Seed number of an entry; saved when the field loses focus or on Enter. Empty clears the seed. */
function SeedInput(props: { competition: string; entry: EntryView; disabled: boolean; onError: (e: EngineError | null) => void }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const saved = props.entry.seed?.toString() ?? '';
  const [value, setValue] = useState(saved);
  const [invalid, setInvalid] = useState(false);

  function save() {
    if (value.trim() === saved) return;
    const seed = value.trim() === '' ? null : Number(value);
    const failure = dispatch({ type: 'setSeed', competition: props.competition, entry: props.entry.id, seed });
    setInvalid(failure !== null);
    props.onError(failure);
  }

  return (
    <Input
      className="w-16 tabular-nums"
      type="number"
      min={1}
      placeholder="–"
      value={value}
      disabled={props.disabled}
      aria-invalid={invalid || undefined}
      aria-label={t('competition.seedLabel', { name: entryName(props.entry) })}
      title={t('competition.seed')}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && save()}
    />
  );
}

/** Picks players already registered in other competitions of this tournament (same person, no re-registration). */
function ExistingPlayerDialog({ competition, onClose }: { competition: CompetitionView; onClose: () => void }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const players = useQuery(getPlayers) ?? [];
  const [search, setSearch] = useState('');
  const [error, setError] = useState<EngineError | null>(null);
  const entered = new Set(competition.entries.flatMap((e) => e.players.map((p) => p.id)));
  const needle = search.trim().toLowerCase();
  const available = players.filter(
    (p) => !entered.has(p.id) && `${p.firstName} ${p.lastName} ${p.club}`.toLowerCase().includes(needle),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('competition.addExisting')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input type="search" value={search} placeholder={t('competition.searchPlayers')} aria-label={t('competition.searchPlayers')} onChange={(e) => setSearch(e.target.value)} />
          {available.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('competition.noExisting')}</p>
          ) : (
            <ul className="grid max-h-72 gap-1 overflow-y-auto">
              {available.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {p.firstName} {p.lastName}
                    {p.club && <span className="text-muted-foreground text-xs"> · {p.club}</span>}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const failure = dispatch({ type: 'enterPlayer', competition: competition.id, player: p.id });
                      setError(failure);
                    }}
                  >
                    <UserPlus />
                    {t('competition.enter')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <FormError message={error && errorMessage(t, error)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The formats the operator picks from: a single stage, or groups followed by single elimination. */
type Format = StageType | 'groupsSingleElimination';

const formatLabelKeys = {
  groups: 'competition.formatGroups',
  groupsSingleElimination: 'competition.formatGroupsSingleElimination',
  singleElimination: 'competition.formatSingleElimination',
  doubleElimination: 'competition.formatDoubleElimination',
} as const;

function FormatCard({ competition, stage, locked }: { competition: CompetitionView; stage: StageSummaryView | null; locked: boolean }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const current: Grouping = stage?.type === 'groups' ? stage.grouping : { by: 'count', groups: 2 };
  const second = competition.stages[1];
  const [format, setFormat] = useState<Format>(second?.type === 'singleElimination' ? 'groupsSingleElimination' : (stage?.type ?? 'groups'));
  const [by, setBy] = useState<Grouping['by']>(current.by);
  const [value, setValue] = useState(String(current.by === 'count' ? current.groups : current.size));
  const bracketStage = stage?.type === 'singleElimination' ? stage : second?.type === 'singleElimination' ? second : null;
  const [thirdPlace, setThirdPlace] = useState(bracketStage?.thirdPlace ?? false);
  const [error, setError] = useState<EngineError | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const n = Number(value);
    const grouping: Grouping = by === 'count' ? { by, groups: n } : { by, size: n };
    const stages: StageConfig[] =
      format === 'groups'
        ? [{ type: 'groups', grouping }]
        : format === 'groupsSingleElimination'
          ? [
              { type: 'groups', grouping },
              { type: 'singleElimination', thirdPlace },
            ]
          : format === 'doubleElimination'
            ? [{ type: 'doubleElimination' }]
            : [{ type: 'singleElimination', thirdPlace }];
    const failure = dispatch({ type: 'configureStages', competition: competition.id, stages });
    setError(failure);
    setSaved(!failure);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('competition.formatHeading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="grid gap-3">
          <fieldset disabled={locked} className="flex flex-wrap items-center gap-4">
            <legend className="sr-only">{t('competition.formatHeading')}</legend>
            {(['groups', 'groupsSingleElimination', 'singleElimination', 'doubleElimination'] as const).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm font-medium">
                <input type="radio" name="format" checked={format === option} onChange={() => setFormat(option)} />
                {t(formatLabelKeys[option])}
              </label>
            ))}
          </fieldset>
          <fieldset disabled={locked} className="flex flex-wrap items-center gap-4">
            {format === 'groups' || format === 'groupsSingleElimination' ? (
              <>
                <legend className="sr-only">{t('competition.splitBy')}</legend>
                {(['count', 'size'] as const).map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="splitBy" checked={by === option} onChange={() => setBy(option)} />
                    {option === 'count' ? t('competition.byCount') : t('competition.bySize')}
                  </label>
                ))}
                <Input
                  className="w-20 tabular-nums"
                  type="number"
                  min={1}
                  aria-label={by === 'count' ? t('competition.byCount') : t('competition.bySize')}
                  aria-invalid={error?.code === 'invalidGrouping' || undefined}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                {format === 'groupsSingleElimination' && (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} />
                      {t('competition.thirdPlace')}
                    </label>
                    <span className="text-muted-foreground text-xs">{t('competition.groupsSingleEliminationHint')}</span>
                  </>
                )}
              </>
            ) : format === 'doubleElimination' ? (
              <>
                <legend className="sr-only">{t('competition.formatDoubleElimination')}</legend>
                <span className="text-muted-foreground text-xs">{t('competition.doubleEliminationHint')}</span>
              </>
            ) : (
              <>
                <legend className="sr-only">{t('competition.formatSingleElimination')}</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} />
                  {t('competition.thirdPlace')}
                </label>
                <span className="text-muted-foreground text-xs">{t('competition.bracketHint')}</span>
              </>
            )}
            <Button type="submit">{t('competition.saveFormat')}</Button>
            {saved && !error && <span className="text-muted-foreground text-sm">{t('competition.formatSaved')}</span>}
          </fieldset>
          <FormError message={error && errorMessage(t, error)} />
        </form>
      </CardContent>
    </Card>
  );
}

function DrawCard({ competition, stage }: { competition: CompetitionView; stage: StageSummaryView }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const view = useQuery((s) => getStage(s, stage.id, 0), [stage.id]);
  const [error, setError] = useState<EngineError | null>(null);
  const draw = () => setError(dispatch({ type: 'generateDraw', stage: stage.id, randomSeed: newRandomSeed() }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('competition.drawHeading')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {stage.drawState === 'confirmed' ? (
            <>
              <span className="text-sm">{t('competition.confirmed')}</span>
              <Button asChild size="sm">
                <Link to={`../../play/${competition.id}`} relative="path">
                  {t('competition.openOnCanvas')}
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant={stage.drawState === 'drawn' ? 'outline' : 'default'} onClick={draw}>
                <Shuffle />
                {stage.drawState === 'drawn' ? t('competition.redraw') : t('competition.generateDraw')}
              </Button>
              {stage.drawState === 'drawn' && (
                <ConfirmDialog
                  trigger={<Button>{t('competition.confirmDraw')}</Button>}
                  title={t('competition.confirmTitle')}
                  description={t('competition.confirmBody')}
                  confirmLabel={t('competition.confirmDraw')}
                  onConfirm={() => setError(dispatch({ type: 'confirmStage', stage: stage.id }))}
                />
              )}
              {stage.drawState === 'drawn' && (
                <Button asChild variant="outline">
                  <Link to={`../../play/${competition.id}`} relative="path">
                    {t('competition.editOnCanvas')}
                  </Link>
                </Button>
              )}
              {stage.drawState === 'notDrawn' && <span className="text-muted-foreground text-sm">{t('competition.notDrawn')}</span>}
            </>
          )}
        </div>
        <FormError message={error && errorMessage(t, error)} />
        {(view?.type === 'singleElimination' || view?.type === 'doubleElimination') && view.size > 0 && (
          <div className="grid gap-1">
            <p className="font-medium">{t('competition.firstRound', { size: view.size })}</p>
            <ol className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
              {(view.sections.find((s) => s.section === 'main' || s.section === 'winners')?.rounds[0]?.matches ?? []).map((match, i) => (
                <li key={match.id} className="flex gap-2">
                  <span className="text-muted-foreground w-5 tabular-nums">{i + 1}.</span>
                  {match.slots.map((slot, side) => (
                    <span key={side} className={side === 0 ? 'min-w-0 flex-1 truncate' : 'min-w-0 flex-1 truncate text-right'}>
                      {slot.entry?.seed != null && <span className="text-muted-foreground text-xs">[{slot.entry.seed}] </span>}
                      <span className={slot.entry ? undefined : 'text-muted-foreground italic'}>{slotText(t, slot).text}</span>
                    </span>
                  ))}
                </li>
              ))}
            </ol>
          </div>
        )}
        {view?.type === 'groups' && view.groups.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {view.groups.map((group) => (
              <div key={group.id} className="rounded-md border p-3">
                <p className="mb-1 font-medium">{t('groups.group', { name: group.name })}</p>
                <ol className="grid gap-0.5 text-sm">
                  {group.entries.map((slot, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                      <span className="truncate">{entryName(slot.entry) ?? t('match.unknown')}</span>
                      {slot.entry?.seed != null && <span className="text-muted-foreground ml-auto text-xs">[{slot.entry.seed}]</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
