import { createContext, useContext } from 'react';
import type { EntryView, PlayerId } from '@/engine';
import { entryName } from '@/ui/format';

/**
 * Set only by the read-only display screen (#0028), next to the `print` mode: the canvas components
 * draw narrower cards and use the short player names (`getDisplayNames`). Without it (the play
 * screen) everything keeps its full size and full names.
 */
export interface DisplayMode {
  names: Record<PlayerId, string>;
}

export const DisplayModeContext = createContext<DisplayMode | null>(null);

export const useDisplayMode = () => useContext(DisplayModeContext);

/** An entry's name for the screen being drawn: short on the display, full elsewhere. */
export function useEntryName(): (entry: EntryView | null) => string | null {
  const mode = useDisplayMode();
  return (entry) => entryName(entry, mode?.names);
}
