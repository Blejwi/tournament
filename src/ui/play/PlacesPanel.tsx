import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getFinalPlaces, type CompetitionId, type FinalPlaceView, type PlaceRange } from '@/engine';
import { useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';
import { entryName } from '@/ui/format';

const STORAGE_KEY = 'tm:placesPanelOpen';

/** Whether the panel is open, kept for the browser session. */
function useRemembered(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  return [
    open,
    (value) => {
      setOpen(value);
      try {
        sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0');
      } catch {
        // storage unavailable: the panel just forgets its state
      }
    },
  ];
}

const placeLabel = (place: PlaceRange) => (place.from === place.to ? `${place.from}` : `${place.from}–${place.to}`);

interface Block {
  place: PlaceRange;
  entries: FinalPlaceView[];
  /** Entries still to land in this place or range. */
  missing: number;
}

/** The final places of the competition on the canvas, live: individual places and shared place ranges. */
export function PlacesPanel(props: { competition: CompetitionId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useRemembered();
  const places = useQuery((s) => getFinalPlaces(s, props.competition), [props.competition]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('places.expand')}
        aria-label={t('places.expand')}
        className="flex w-11 shrink-0 flex-col items-center gap-3 border-l bg-white py-2 text-slate-600"
      >
        <ChevronsLeft className="size-4" />
        <span className="text-xs font-bold [writing-mode:vertical-rl]">{t('places.heading')}</span>
      </button>
    );
  }

  // One block per place or range, in order: the entries placed there, then a line for those still to come.
  const blocks = new Map<string, Block>();
  const blockOf = (place: PlaceRange): Block => {
    const block = blocks.get(placeLabel(place)) ?? { place, entries: [], missing: 0 };
    blocks.set(placeLabel(place), block);
    return block;
  };
  for (const row of places?.rows ?? []) blockOf(row.place).entries.push(row);
  for (const gap of places?.open ?? []) blockOf(gap.place).missing = gap.count;
  const ordered = [...blocks.values()].sort((a, b) => a.place.from - b.place.from);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l bg-white" aria-label={t('places.heading')}>
      <div className="flex h-10 items-center gap-2 border-b px-3">
        <span className="font-semibold">{t('places.heading')}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title={t('places.collapse')}
          aria-label={t('places.collapse')}
          className="ml-auto rounded p-1 text-slate-600 hover:bg-slate-100"
        >
          <ChevronsRight className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {ordered.length === 0 ? (
          <p className="p-4 text-xs text-slate-400">{t('places.empty')}</p>
        ) : (
          <ol>
            {ordered.map((block) => (
              <li key={placeLabel(block.place)} className="flex gap-2 border-b border-slate-100 px-3 py-1.5">
                <span className={cn('w-10 shrink-0 text-sm font-bold tabular-nums', block.entries.length === 0 && 'text-slate-400')}>
                  {placeLabel(block.place)}
                </span>
                <ul className="min-w-0 flex-1">
                  {block.entries.map(({ entry }) => (
                    <li key={entry.id} className="text-sm">
                      <span className="block break-words font-medium">{entryName(entry)}</span>
                      {entry.players.some((p) => p.club) && (
                        <span className="block truncate text-xs text-slate-500">
                          {entry.players
                            .map((p) => p.club)
                            .filter(Boolean)
                            .join(' / ')}
                        </span>
                      )}
                    </li>
                  ))}
                  {block.missing > 0 && <li className="text-xs text-slate-400">{t('places.open', { count: block.missing })}</li>}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
