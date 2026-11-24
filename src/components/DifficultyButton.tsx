import type { TextStyle, ViewStyle } from 'react-native';

import { wheelOptions } from '@/lib/wheel';
import { WheelButton } from './WheelSheet';

/** How hard something felt, 1 to 10, on a wheel whose blank row clears it. */
export function DifficultyButton({
  label, title, value, onChange, style, textStyle,
}: {
  label: string; title: string; value: number | null;
  onChange: (difficulty: number | null) => void; style?: ViewStyle; textStyle?: TextStyle;
}) {
  return (
    <WheelButton
      label={label}
      valueText={value === null ? 'Not logged' : `${value} of 10`}
      text={value === null ? '' : String(value)}
      muted={value === null}
      title={title}
      columns={[{ label: 'Difficulty', options: wheelOptions(1, 10, value), value }]}
      onDone={([next]) => {
        if (next !== value) onChange(next);
      }}
      style={style}
      textStyle={textStyle}
    />
  );
}
