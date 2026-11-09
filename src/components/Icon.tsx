import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text } from 'react-native';

import type { CategoryKind } from '@/data/types';

export type SymbolName = Extract<SymbolViewProps['name'], object>;

/** An SF Symbol on iOS and its Material Symbols twin on Android and web. */
export const sym = (ios: string, android: string): SymbolName => ({ ios, android, web: android }) as SymbolName;

/** A symbol, or `fallback` text where the platform has no matching symbol. */
export function Icon({ name, size, color, fallback }: { name: SymbolName; size: number; color: string; fallback: string }) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight="semibold"
      fallback={<Text style={{ color, fontSize: size, fontWeight: '700', lineHeight: size * 1.15 }}>{fallback}</Text>}
    />
  );
}

const KIND_ICON: Record<CategoryKind, SymbolName> = {
  strength: sym('dumbbell.fill', 'fitness_center'),
  cardio: sym('figure.run', 'directions_run'),
  mindbody: sym('figure.yoga', 'self_improvement'),
};
/** Categories that share a kind but deserve their own icon. */
const NAME_ICON: Record<string, SymbolName> = { Mobility: sym('figure.flexibility', 'accessibility_new') };

export const categoryIcon = (c: { name: string; kind: CategoryKind }): SymbolName => NAME_ICON[c.name] ?? KIND_ICON[c.kind];
