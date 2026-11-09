import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

/** The unit after a number field, as a button that switches that entry to the other unit. */
export function UnitPill({ label, unit, onPress }: { label: string; unit: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: unit }}
      accessibilityHint="Switches to the other unit"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.text, { color: t.text }]}>{unit}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  text: { fontSize: 12, fontWeight: '600' },
});
