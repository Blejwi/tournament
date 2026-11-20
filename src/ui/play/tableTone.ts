import type { TableOverviewRow, TableStatus } from '@/engine';

/** The table number tile, coloured by status (red overdue pulses; an idle table while matches wait glows amber). */
export function tableTone(row: TableOverviewRow): string {
  const tones: Record<TableStatus, string> = {
    playing: 'bg-sky-600 text-white',
    overdue: row.match?.overdue === 'red' ? 'bg-red-600 text-white overdue-alarm' : 'bg-amber-500 text-white',
    free: row.idleAlert ? 'bg-amber-400 text-white idle-alarm' : 'bg-emerald-500 text-white',
    inactive: 'bg-slate-200 text-slate-400',
  };
  return tones[row.status];
}
