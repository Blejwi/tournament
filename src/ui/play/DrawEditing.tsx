import { createContext, useContext, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Shuffle, X } from 'lucide-react';
import type { DrawPosition, EngineError, GroupView, MatchView, SlotView, StageId } from '@/engine';
import { useApp } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/components/ui/button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { newRandomSeed } from '@/ui/format';
import { matchCode, slotText } from '@/ui/matchLabels';
import { MatchCard } from './MatchCard';

/**
 * Draw editing on the canvas, before the stage is confirmed (spec user stories 17–19): drag a
 * player onto another to swap them, onto a group's drop area (or a BYE) to move them. Clicking a
 * player and then a target does the same without dragging (keyboard and touch).
 */

/** What a drop does: swap with the player (or BYE) on a position, or move into a free place. */
type DropTarget = { kind: 'swap'; at: DrawPosition } | { kind: 'move'; at: DrawPosition };

interface DrawEditApi {
  picked: DrawPosition | null;
  pick(at: DrawPosition | null): void;
  drop(target: DropTarget, from?: DrawPosition): void;
}

const DrawEditContext = createContext<DrawEditApi | null>(null);

function useDrawEdit(): DrawEditApi {
  const api = useContext(DrawEditContext);
  if (!api) throw new Error('useDrawEdit outside <DrawEditor>');
  return api;
}

const DRAG_TYPE = 'application/x-draw-position';
const samePosition = (a: DrawPosition, b: DrawPosition) =>
  a.kind === b.kind && a.position === b.position && (a.kind !== 'group' || (b.kind === 'group' && a.group === b.group));

/** The editing toolbar over the canvas (re-draw, confirm, errors) and the drag-and-drop state. */
export function DrawEditor(props: { stage: StageId; bracket: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const [picked, setPicked] = useState<DrawPosition | null>(null);
  const [error, setError] = useState<EngineError | null>(null);

  const run = (failure: EngineError | null) => {
    setError(failure);
    setPicked(null);
  };
  const api: DrawEditApi = {
    picked,
    pick: (at) => {
      setError(null);
      setPicked(at);
    },
    drop(target, from = picked ?? undefined) {
      if (!from || samePosition(from, target.at)) return setPicked(null);
      run(
        target.kind === 'swap'
          ? dispatch({ type: 'swapSlots', at: Date.now(), stage: props.stage, a: from, b: target.at })
          : dispatch({ type: 'movePlayer', at: Date.now(), stage: props.stage, from, to: target.at }),
      );
    },
  };

  return (
    <DrawEditContext.Provider value={api}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm">
          <span className="font-semibold text-amber-900">{t('drawEdit.title')}</span>
          <span className="text-amber-800">{t(props.bracket ? 'drawEdit.hintBracket' : 'drawEdit.hintGroups')}</span>
          <div className="ml-auto flex items-center gap-2">
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Shuffle />
                  {t('competition.redraw')}
                </Button>
              }
              title={t('drawEdit.redrawTitle')}
              description={t('drawEdit.redrawBody')}
              confirmLabel={t('competition.redraw')}
              onConfirm={() => run(dispatch({ type: 'generateDraw', stage: props.stage, randomSeed: newRandomSeed() }))}
            />
            <ConfirmDialog
              trigger={
                <Button size="sm">
                  <Lock />
                  {t('competition.confirmDraw')}
                </Button>
              }
              title={t('competition.confirmTitle')}
              description={t('competition.confirmBody')}
              confirmLabel={t('competition.confirmDraw')}
              onConfirm={() => run(dispatch({ type: 'confirmStage', stage: props.stage }))}
            />
          </div>
          {(error || picked) && (
            <div className="flex w-full items-center gap-2">
              {error ? (
                <span role="alert" className="text-destructive">
                  {errorMessage(t, error)}
                </span>
              ) : (
                <span className="text-amber-900">{t('drawEdit.picked')}</span>
              )}
              {picked && (
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                  <X />
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          )}
        </div>
        {props.children}
      </div>
    </DrawEditContext.Provider>
  );
}

/** Drop-target behaviour shared by draw slots and group drop areas. */
function useDropTarget(target: DropTarget) {
  const api = useDrawEdit();
  const [over, setOver] = useState(false);
  return {
    over,
    handlers: {
      onDragOver: (e: DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const data = e.dataTransfer.getData(DRAG_TYPE);
        if (data) api.drop(target, JSON.parse(data) as DrawPosition);
      },
    },
  };
}

const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  fn();
};

/**
 * One draw position: draggable when it holds an entrant, and a drop target. Dropping a player
 * swaps them; in a bracket, dropping onto a BYE moves the player there.
 */
function DrawSlot(props: { at: DrawPosition; slot: SlotView; label?: string; className?: string }) {
  const { t } = useTranslation();
  const api = useDrawEdit();
  const { slot, at } = props;
  const moveOntoBye = at.kind === 'bracket' && slot.bye;
  const target: DropTarget = { kind: moveOntoBye ? 'move' : 'swap', at };
  const drop = useDropTarget(target);
  const picked = api.picked !== null && samePosition(api.picked, at);
  const text = slotText(t, slot, true);
  const draggable = !slot.bye;
  const name = text.text;

  const click = () => {
    if (api.picked) api.drop(target);
    else if (draggable) api.pick(at);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-nopan
      draggable={draggable}
      aria-pressed={picked}
      aria-label={t('drawEdit.slot', { name, position: props.label ?? at.position })}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(at));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={click}
      onKeyDown={activate(click)}
      {...drop.handlers}
      className={cn(
        'flex items-center gap-1 rounded px-1.5 text-xs leading-none select-none',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        'hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-500',
        picked && 'bg-amber-200 ring-2 ring-amber-500',
        drop.over && 'bg-indigo-100 ring-2 ring-indigo-400',
        props.className,
      )}
    >
      {props.label && <span className="w-4 shrink-0 text-[10px] text-slate-400 tabular-nums">{props.label}</span>}
      <span className={cn('truncate', text.placeholder && 'text-slate-400 italic')}>{name}</span>
      {slot.entry?.players[0]?.club && <span className="truncate text-[10px] text-slate-400">{slot.entry.players[0].club}</span>}
      {slot.entry?.seed != null && <span className="ml-auto shrink-0 text-[10px] font-semibold text-slate-500">[{slot.entry.seed}]</span>}
    </div>
  );
}

/** A group while its draw is edited: its entries in draw position order, a drop area, and its matches. */
export function DrawGroupBox({ group }: { group: GroupView }) {
  const { t } = useTranslation();
  const api = useDrawEdit();
  const end: DrawPosition = { kind: 'group', group: group.id, position: group.entries.length + 1 };
  const drop = useDropTarget({ kind: 'move', at: end });
  const moveHere = () => api.picked && api.drop({ kind: 'move', at: end });

  return (
    <div className="w-[458px] rounded-lg border-2 border-dashed border-amber-300 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded bg-indigo-600 font-bold text-white">{group.name}</span>
        <span className="font-semibold">{t('groups.group', { name: group.name })}</span>
        <span className="text-xs text-slate-500">{t('drawEdit.entries', { count: group.entries.length })}</span>
      </div>
      <div className="grid gap-0.5">
        {group.entries.map((slot, i) => (
          <DrawSlot
            key={i}
            at={{ kind: 'group', group: group.id, position: i + 1 }}
            slot={slot}
            label={String(i + 1)}
            className="h-7 border border-slate-100"
          />
        ))}
      </div>
      <div
        role="button"
        tabIndex={0}
        data-nopan
        onClick={moveHere}
        onKeyDown={activate(moveHere)}
        {...drop.handlers}
        className={cn(
          'mt-1 mb-3 rounded border border-dashed border-slate-300 py-1.5 text-center text-[11px] text-slate-400',
          api.picked && 'cursor-pointer border-amber-400 text-amber-700 hover:bg-amber-50',
          drop.over && 'border-indigo-400 bg-indigo-50 text-indigo-700',
        )}
      >
        {t('drawEdit.moveHere', { name: group.name })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {group.matches.map((match) => (
          <MatchCard key={match.id} match={match} selected={false} onSelect={() => {}} />
        ))}
      </div>
    </div>
  );
}

/** A first-round bracket match while the draw is edited: its two positions are draggable. */
export function DrawMatchCard({ match }: { match: MatchView }) {
  const { t } = useTranslation();
  const first = 2 * (match.order - 1) + 1;
  return (
    <div className="h-16 w-[212px] overflow-hidden rounded-md border-2 border-dashed border-amber-300 bg-white text-slate-900">
      <span className="flex h-[18px] items-center px-1.5 text-[10px] leading-none">
        <b className="text-slate-700">{matchCode(t, match.location, match.round, match.order)}</b>
      </span>
      {([0, 1] as const).map((side) => (
        <DrawSlot
          key={side}
          at={{ kind: 'bracket', position: first + side }}
          slot={match.slots[side]}
          className="h-[21px] rounded-none border-t border-black/5"
        />
      ))}
    </div>
  );
}
