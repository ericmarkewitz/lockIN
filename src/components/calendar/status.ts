import type { DayStatus } from '@/data/types';
import type { Theme } from '@/theme';

export const STATUS_LABEL: Record<DayStatus, string> = {
  none: '', rest: 'Rest', planned: 'Planned', partial: 'In progress', completed: 'Done', missed: 'Missed',
};

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
