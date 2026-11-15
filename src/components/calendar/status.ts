import type { DayStatus } from '@/data/types';
import type { Theme } from '@/theme';

export const STATUS_LABEL: Record<DayStatus, string> = {
  none: '', rest: 'Rest', planned: 'Planned', partial: 'Partially done', completed: 'Done', missed: 'Missed',
};

/** The label for one day: a partial workout is still "In progress" until the day is over. */
export function statusLabel(status: DayStatus, date: string, today: string): string {
  return status === 'partial' && date >= today ? 'In progress' : STATUS_LABEL[status];
}

export function statusColor(s: DayStatus, t: Theme): string {
  switch (s) {
    case 'completed': return t.success;
    case 'partial': return t.warn;
    case 'planned': return t.primary;
    case 'rest': return t.rest;
    case 'missed': return t.danger;
    default: return t.border;
  }
}
