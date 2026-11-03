import type { ViewStyle } from 'react-native';

import { durationSeconds, formatDuration, minutesFromParts, partsFromMinutes } from '@/lib/duration';
import { MAX_DURATION_HOURS, wheelRange } from '@/lib/wheel';
import { WheelButton } from './WheelSheet';

/**
 * A duration field with hours, minutes and seconds wheels. Values are minutes.
 * Opens on `value`, or `target` so a planned duration takes one tap to log.
 */
export function DurationButton({
  label, title, value, target = null, onChange, style,
}: {
  label: string; title: string; value: number | null; target?: number | null;
  onChange: (minutes: number | null) => void; style?: ViewStyle;
}) {
  const start = value ?? target;
  const [hours, minutes, seconds] = partsFromMinutes(start);
  const unset = target === null ? 'Not set' : `Not logged, target ${formatDuration(target)}`;
  return (
    <WheelButton
      label={label}
      valueText={value === null ? unset : formatDuration(value)}
      text={formatDuration(start) || 'Time'}
      muted={value === null}
      title={title}
      columns={[
        { label: 'Hours', options: wheelRange(0, MAX_DURATION_HOURS, hours), value: hours },
        { label: 'Minutes', options: wheelRange(0, 59, minutes), value: minutes },
        { label: 'Seconds', options: wheelRange(0, 59, seconds), value: seconds },
      ]}
      onDone={([h, m, s]) => {
        const next = minutesFromParts(h ?? 0, m ?? 0, s ?? 0);
        // Compare whole seconds, so a saved value more precise than the wheels survives.
        if (durationSeconds(next) !== durationSeconds(value)) onChange(next);
      }}
      style={style}
    />
  );
}
