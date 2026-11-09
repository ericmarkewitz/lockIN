import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text, View } from 'react-native';

import type { CategoryKind } from '@/data/types';

export type DayKind = CategoryKind | 'rest';

const ICONS: Record<DayKind, { name: Extract<SymbolViewProps['name'], object>; fallback: string }> = {
  strength: { name: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }, fallback: '🏋️' },
  cardio: { name: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' }, fallback: '🏃' },
  mindbody: { name: { ios: 'figure.yoga', android: 'self_improvement', web: 'self_improvement' }, fallback: '🧘' },
  rest: { name: { ios: 'moon.zzz.fill', android: 'bedtime', web: 'bedtime' }, fallback: '💤' },
};

/** A small glyph for a kind of workout (or a rest day). Sits inside an accessible control whose label carries the meaning. */
export function KindIcon({ kind, size = 16, color }: { kind: DayKind; size?: number; color: string }) {
  const { name, fallback } = ICONS[kind];
  return (
    <View testID={`kind-${kind}`}>
      <SymbolView
        name={name}
        size={size}
        tintColor={color}
        weight="semibold"
        fallback={<Text style={{ fontSize: size * 0.85 }}>{fallback}</Text>}
      />
    </View>
  );
}
